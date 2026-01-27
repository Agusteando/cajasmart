import { readMultipartFormData } from 'h3';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers, createNotification } from '~/server/utils/notifications';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function pickField(parts: any[], name: string) {
  return parts.find((p) => p.name === name)?.data?.toString?.() || '';
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);

  // Only requester or super admin can update/resubmit
  if (user.role_name !== 'ADMIN_PLANTEL' && user.role_name !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  const parts = await readMultipartFormData(event);
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'No data' });

  const id = Number(pickField(parts, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' });
  }

  const invoiceDate = pickField(parts, 'date');
  const invoiceNumber = pickField(parts, 'invoice');
  const provider = pickField(parts, 'provider');
  const amountRaw = pickField(parts, 'amount');
  const concept = pickField(parts, 'concept');
  const description = pickField(parts, 'desc');
  const action = (pickField(parts, 'action') || 'DRAFT').toUpperCase(); // DRAFT | SUBMIT

  const amount = Number.parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Monto inválido' });
  }

  if (action !== 'DRAFT' && action !== 'SUBMIT') {
    throw createError({ statusCode: 400, statusMessage: 'Acción inválida' });
  }

  const db = await useDb();

  const [rows]: any = await db.execute(`SELECT * FROM reimbursements WHERE id = ? LIMIT 1`, [id]);
  const existing = rows?.[0];
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' });

  // Requester can only update their own
  if (user.role_name === 'ADMIN_PLANTEL' && Number(existing.user_id) !== Number(user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  // Only allow editing/resubmitting DRAFT/RETURNED (matches original workflow)
  const currentStatus = String(existing.status || '');
  if (!['DRAFT', 'RETURNED'].includes(currentStatus) && user.role_name !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Solo puedes editar borradores o solicitudes regresadas'
    });
  }

  // File handling (optional replacement)
  const filePart = parts.find((p) => p.name === 'file');
  let fileUrl = String(existing.file_url || '');

  if (filePart && filePart.filename) {
    const config = useRuntimeConfig();
    const ext = path.extname(filePart.filename);
    const safeName = `${randomUUID()}${ext}`;
    const uploadDir = config.uploadDir || './public/uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, safeName), filePart.data);
    fileUrl = safeName;
  }

  // If submitting, require some file (existing or new)
  if (action === 'SUBMIT' && !fileUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Archivo de factura requerido para enviar' });
  }

  const nextStatus = action === 'DRAFT' ? 'DRAFT' : 'PENDING_OPS_REVIEW';

  // Update record
  await db.execute(
    `
    UPDATE reimbursements
    SET
      invoice_date = ?,
      invoice_number = ?,
      provider = ?,
      concept = ?,
      description = ?,
      amount = ?,
      file_url = ?,
      status = ?,
      rejection_reason = NULL,
      returned_by = NULL,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      invoiceDate || null,
      invoiceNumber || null,
      provider || null,
      concept || null,
      description || null,
      amount,
      fileUrl || null,
      nextStatus,
      id
    ]
  );

  // Audit
  await createAuditLog({
    entityType: 'reimbursement',
    entityId: id,
    action: action === 'SUBMIT' ? 'RESUBMIT' : 'UPDATE_DRAFT',
    fromStatus: currentStatus,
    toStatus: nextStatus,
    actorUserId: user.id,
    comment: action === 'SUBMIT' ? 'Reenviado a revisión operativa' : 'Actualizado'
  });

  // Notify ops if resubmitted/submitted
  if (action === 'SUBMIT') {
    await notifyRoleUsers(
      'REVISOR_OPS',
      'NEW_REQUEST',
      'Solicitud (re)enviada',
      `Solicitud #${id} reenviada por ${user.nombre} por $${amount.toFixed(2)}`,
      'reimbursement',
      id
    );

    // Optional: notify requester confirmation (nice UX)
    await createNotification({
      userId: Number(existing.user_id),
      type: 'SUBMITTED',
      title: 'Solicitud enviada',
      message: `Tu solicitud #${id} fue enviada a revisión operativa.`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  }

  return { success: true, id, status: nextStatus };
});
