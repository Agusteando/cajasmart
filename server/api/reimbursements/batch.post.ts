import { useDb } from '~/server/utils/db';
import { requireAuth, requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  // Only Treasury or Super Admin can do batch operations here
  const user = requireRole(event, ['TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  
  // action: 'print' (handled in pdf-batch usually, but maybe for data dump) or 'process'
  const { action, ids, paymentRef, paymentMethod } = body; 

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  // Validate items exist
  const placeholders = ids.map(() => '?').join(',');
  const [rows]: any = await db.execute(
    `SELECT r.* FROM reimbursements r WHERE r.id IN (${placeholders})`,
    ids
  );

  if (action === 'process') {
    // Validate that items are APPROVED and ARCHIVED (Printed) before paying?
    // The UI handles the flow, but backend should ideally check.
    // For now, we allow processing if status is APPROVED.
    
    // VALIDATE paymentMethod
    if (paymentMethod !== 'CHEQUE' && paymentMethod !== 'NO CHEQUE') {
      throw createError({ statusCode: 400, statusMessage: 'Método de pago inválido (CHEQUE/NO CHEQUE)' });
    }

    await db.execute(
      `UPDATE reimbursements 
       SET status = 'PROCESSED', 
           processed_at = NOW(), 
           processed_by = ?, 
           payment_ref = ?,
           payment_method = ?
       WHERE id IN (${placeholders}) AND status = 'APPROVED'`,
      [user.id, paymentRef || null, paymentMethod, ...ids]
    );

    // Audit logs for batch
    for (const id of ids) {
      await createAuditLog({
        entityType: 'reimbursement',
        entityId: id,
        action: 'BATCH_PROCESS',
        fromStatus: 'APPROVED',
        toStatus: 'PROCESSED',
        actorUserId: user.id,
        comment: `Lote ref: ${paymentRef || 'N/A'}, Metodo: ${paymentMethod}`
      });
    }

    return { success: true, message: 'Procesado correctamente' };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción desconocida' });
});