import { readMultipartFormData } from 'h3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers } from '~/server/utils/notifications';

async function saveUpload(file: { filename?: string; data: Buffer }) {
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  await fs.mkdir(uploadsDir, { recursive: true });
  
  const original = String(file.filename || 'f').trim();
  const safe = original.replace(/[^a-z0-9.]/gi, '_').slice(0, 100);
  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`;
  
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, file.data);
  return filename;
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  let body: any = {};
  const parts = (await readMultipartFormData(event)) || [];
  let filePart: any = null;

  for (const p of parts) {
    if (p.name === 'file' && p.data && p.data.length > 0) {
      filePart = p;
    } else if (p.name) {
      body[p.name] = p.data.toString('utf8');
    }
  }

  const id = body.id;
  if(!id) throw createError({statusCode:400, statusMessage:'Falta ID'});

  // --- CHECK PERMISSIONS AND STATUS ---
  const [rRows]: any = await db.execute('SELECT status, user_id FROM reimbursements WHERE id = ?', [id]);
  const record = rRows?.[0];
  
  if (!record) throw createError({statusCode: 404});
  
  if (user.role_name !== 'SUPER_ADMIN' && Number(record.user_id) !== Number(user.id)) {
    throw createError({statusCode: 403});
  }

  // ✅ ALLOW 'PENDING_OPS_REVIEW' so they can fix mistakes before Ops approves
  const allowed = ['DRAFT', 'RETURNED', 'PENDING_OPS_REVIEW'];
  if (!allowed.includes(record.status) && user.role_name !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 400, statusMessage: 'No se puede editar en este estado.' });
  }
  // ------------------------------------

  const isDeducible = body.is_deducible === 'true' || body.is_deducible === '1' || body.is_deducible === true;

  let fileUrl: string | null = null;
  if (filePart) {
    try {
      fileUrl = await saveUpload(filePart as any);
    } catch(e) {
      console.error('Error saving file update', e);
    }
  } else {
    const [rows]: any = await db.execute('SELECT file_url FROM reimbursement_items WHERE reimbursement_id = ? LIMIT 1', [id]);
    fileUrl = rows?.[0]?.file_url;
  }

  if (body.conceptos && typeof body.conceptos === 'string') {
    try { body.conceptos = JSON.parse(body.conceptos); } catch {}
  }

  const conceptos = Array.isArray(body.conceptos) ? body.conceptos : [];
  let totalAmount = 0;
  conceptos.forEach((c:any) => totalAmount += Number(c.amount));

  const fechaISO = body.fechaISO ? new Date(body.fechaISO).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Reset status to PENDING_OPS_REVIEW if it was returned or edited
    await connection.execute(
      `UPDATE reimbursements 
       SET total_amount = ?, reimbursement_date = ?, is_deducible = ?, status = 'PENDING_OPS_REVIEW', rejection_reason = NULL, returned_by = NULL, updated_at = NOW() 
       WHERE id = ?`,
      [totalAmount, fechaISO, isDeducible ? 1 : 0, id]
    );

    await connection.execute('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);

    for (const c of conceptos) {
      await connection.execute(
        `INSERT INTO reimbursement_items (reimbursement_id, invoice_date, invoice_number, provider, concept, description, amount, file_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [id, c.invoice_date||null, c.invoice_number||null, c.provider||null, c.concept||'', c.description||null, Number(c.amount), fileUrl]
      );
    }

    await connection.commit();
    await createAuditLog({ entityType: 'reimbursement', entityId: id, action: 'UPDATE', toStatus: 'PENDING_OPS_REVIEW', actorUserId: user.id });
    
    // Notify OPS that it was updated/corrected
    await notifyRoleUsers('REVISOR_OPS', 'NEW_REQUEST', 'Solicitud Actualizada', `${user.nombre} actualizó la solicitud #${id}`, 'reimbursement', Number(id));

    return { ok: true, id };
  } catch (e: any) {
    await connection.rollback();
    console.error('Error Update:', e.message);
    throw createError({ statusCode: 500, statusMessage: 'Error Update' });
  } finally {
    connection.release();
  }
});