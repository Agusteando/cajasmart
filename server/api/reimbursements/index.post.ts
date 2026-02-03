import { readMultipartFormData } from 'h3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers } from '~/server/utils/notifications';

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message });
}

async function saveUpload(file: { filename?: string; data: any }) {
  const cfg = useRuntimeConfig();
  const uploadsDir = path.resolve(process.cwd(), cfg.uploadDir || './public/uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const original = String(file.filename || 'archivo').trim() || 'archivo';
  const safe = original.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`;
  await fs.writeFile(path.join(uploadsDir, filename), file.data);
  return filename;
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  let body: any = {};
  const parts = (await readMultipartFormData(event)) || [];
  for (const p of parts) {
    if (!p?.name) continue;
    if (p.name === 'file') continue;
    body[p.name] = p.data.toString('utf8');
  }

  let fileUrl: string | null = null;
  const filePart = parts.find((p: any) => p?.name === 'file' && p?.data?.length);
  if (filePart) fileUrl = await saveUpload(filePart as any);

  if (body.conceptos && typeof body.conceptos === 'string') {
    try { body.conceptos = JSON.parse(body.conceptos); } catch { bad('JSON inválido'); }
  }

  const plantelId = user.plantel_id; 
  if (!plantelId && user.role_name === 'ADMIN_PLANTEL') bad('Sin plantel asignado.');

  const conceptos = Array.isArray(body.conceptos) ? body.conceptos : [];
  if (!conceptos.length) bad('Faltan conceptos.');

  let totalAmount = 0;
  for (const c of conceptos) {
    const amt = Number(c.amount);
    if (!Number.isFinite(amt) || amt <= 0) bad('Monto inválido.');
    totalAmount += amt;
  }

  const fechaISO = body.fechaISO ? new Date(body.fechaISO).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const status = 'PENDING_OPS_REVIEW';
    const [res]: any = await connection.execute(
      `INSERT INTO reimbursements (user_id, plantel_id, status, reimbursement_date, total_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [user.id, plantelId, status, fechaISO, totalAmount]
    );
    const reimbursementId = res.insertId;

    for (const c of conceptos) {
      await connection.execute(
        `INSERT INTO reimbursement_items (reimbursement_id, invoice_date, invoice_number, provider, concept, description, amount, file_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [reimbursementId, c.invoice_date || null, c.invoice_number || null, c.provider || null, c.concept || '', c.description || null, Number(c.amount), fileUrl]
      );
    }

    await connection.commit();
    
    await createAuditLog({ entityType: 'reimbursement', entityId: reimbursementId, action: 'CREATE', toStatus: status, actorUserId: user.id });
    await notifyRoleUsers('REVISOR_OPS', 'NEW_PENDING', 'Nueva Solicitud', `${user.nombre} envió solicitud por $${totalAmount.toFixed(2)}`, 'reimbursement', reimbursementId);

    // Return format matching what UI expects (data: Reembolso)
    return { ok: true, data: { id: String(reimbursementId), folio: `R-${String(reimbursementId).padStart(5,'0')}` } };
  } catch (e) {
    await connection.rollback();
    throw createError({ statusCode: 500, statusMessage: 'Error DB' });
  } finally {
    connection.release();
  }
});