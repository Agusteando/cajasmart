import { readMultipartFormData } from 'h3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers } from '~/server/utils/notifications';

async function saveUpload(file: { filename?: string; data: any }) {
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), cfg.uploadDir || './public/uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}_${(file.filename||'f').replace(/[^a-z0-9.]/gi,'_')}`;
  await fs.writeFile(path.join(uploadsDir, filename), file.data);
  return filename;
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  let body: any = {};
  const parts = (await readMultipartFormData(event)) || [];
  for (const p of parts) {
    if (p.name !== 'file') body[p.name || ''] = p.data.toString('utf8');
  }

  const id = body.id;
  if(!id) throw createError({statusCode:400, statusMessage:'Falta ID'});

  let fileUrl: string | null = null;
  const filePart = parts.find((p: any) => p?.name === 'file' && p?.data?.length);
  if (filePart) fileUrl = await saveUpload(filePart as any);
  else {
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
    await connection.execute(
      `UPDATE reimbursements SET total_amount = ?, reimbursement_date = ?, status = 'PENDING_OPS_REVIEW', rejection_reason = NULL, returned_by = NULL, updated_at = NOW() WHERE id = ?`,
      [totalAmount, fechaISO, id]
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
    await notifyRoleUsers('REVISOR_OPS', 'NEW_REQUEST', 'Solicitud Corregida', `${user.nombre} corrigió #${id}`, 'reimbursement', Number(id));

    return { ok: true, id };
  } catch (e) {
    await connection.rollback();
    throw createError({ statusCode: 500, statusMessage: 'Error Update' });
  } finally {
    connection.release();
  }
});