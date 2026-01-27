import { readMultipartFormData } from 'h3';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers } from '~/server/utils/notifications';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  
  // Only Admin Plantel (Requester) or Super Admin can create
  if (user.role_name !== 'ADMIN_PLANTEL' && user.role_name !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado para crear solicitudes' });
  }

  if (!user.plantel_id) {
    throw createError({ statusCode: 400, statusMessage: 'Usuario no tiene plantel asignado' });
  }

  const parts = await readMultipartFormData(event);
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'No data' });

  // Extract fields
  const getField = (name: string) => parts.find(p => p.name === name)?.data.toString() || '';
  
  const invoiceDate = getField('date');
  const invoiceNumber = getField('invoice');
  const provider = getField('provider');
  const amount = parseFloat(getField('amount'));
  const concept = getField('concept');
  const description = getField('desc');
  const action = getField('action') || 'SUBMIT'; // 'DRAFT' or 'SUBMIT'

  if (!amount || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Monto inválido' });
  }

  // Handle File
  const filePart = parts.find(p => p.name === 'file');
  let fileUrl = '';

  if (filePart && filePart.filename) {
    const config = useRuntimeConfig();
    const ext = path.extname(filePart.filename);
    const safeName = `${randomUUID()}${ext}`;
    // Ensure dir exists
    const uploadDir = config.uploadDir || './public/uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    
    await fs.writeFile(path.join(uploadDir, safeName), filePart.data);
    fileUrl = safeName;
  } else if (action === 'SUBMIT') {
    throw createError({ statusCode: 400, statusMessage: 'Archivo de factura requerido' });
  }

  const status = action === 'DRAFT' ? 'DRAFT' : 'PENDING_OPS_REVIEW';
  const db = await useDb();

  const [res]: any = await db.execute(
    `INSERT INTO reimbursements 
     (user_id, plantel_id, status, invoice_date, invoice_number, provider, concept, description, amount, file_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [user.id, user.plantel_id, status, invoiceDate, invoiceNumber, provider, concept, description, amount, fileUrl]
  );

  const newId = res.insertId;

  await createAuditLog({
    entityType: 'reimbursement',
    entityId: newId,
    action: 'CREATE',
    toStatus: status,
    actorUserId: user.id,
    comment: `Creado como ${status}`
  });

  if (status === 'PENDING_OPS_REVIEW') {
    await notifyRoleUsers(
      'REVISOR_OPS',
      'NEW_REQUEST',
      'Nueva Solicitud',
      `${user.nombre} ha enviado una solicitud de $${amount}`,
      'reimbursement',
      newId
    );
  }

  return { success: true, id: newId };
});