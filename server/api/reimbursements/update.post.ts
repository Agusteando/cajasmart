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
  // Fix: Safe filename
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

  let fileUrl: string | null = null;
  if (filePart) {
    try {
      fileUrl = await saveUpload(filePart as any);
    } catch(e) {
      console.error('Error saving file update', e);
    }
  } else {
    // Keep existing if not replaced
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
    // Note: We generally don't update plantel_id on edit to avoid moving items between budgets accidentally
    await connection.execute(
      `UPDATE reimbursements SET total_amount = ?, reimbursement_date = ?, status = 'PENDING_OPS_REVIEW', rejection_reason = NULL, returned_by = NULL, updated_at = NOW() WHERE id = ?`,
      [totalAmount, fechaISO, id]
    );

    // Replace items logic (simplified for this app structure)
    await connection.execute('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);

    for (const c of conceptos) {
      await connection.execute(
        `INSERT INTO reimbursement_items (reimbursement_id, invoice_date, invoice_number, provider, concept, description, amount, file_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [id, c.invoice_date||null, c.invoice_number||null, c.provider||null, c.concept||'', c.description||null, Number(c.amount), fileUrl]
      );
    }

    await connection.commit();
    await createAuditLog({ entityType: 'reimbursement', entityId: id, action: 'UPDATE', toStatus: 'PENDING_OPS_REVIEW', actorUserId: user.id });
    await notifyRoleUsers('REVISOR_OPS', 'NEW_REQUEST', 'Solicitud Corregida', `${user.nombre} corrigió #${id}`, 'reimbursement', Number(id));

    return { ok: true, id };
  } catch (e: any) {
    await connection.rollback();
    console.error('Error Update:', e.message);
    throw createError({ statusCode: 500, statusMessage: 'Error Update' });
  } finally {
    connection.release();
  }
});