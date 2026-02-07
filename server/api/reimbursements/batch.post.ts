import { useDb } from '~/server/utils/db';
import { requireAuth, requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  const { action, ids, paymentRef } = body; // action: 'process'

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  const placeholders = ids.map(() => '?').join(',');
  
  if (action === 'process') {
    // 1. Fetch info to determine Payment Method per item
    const [rows]: any = await db.execute(
        `SELECT id, is_deducible FROM reimbursements WHERE id IN (${placeholders})`,
        ids
    );

    // 2. Process each
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        for(const r of rows) {
            // AUTO-INFER: No Deducible = NO CHEQUE, Deducible = CHEQUE
            const method = r.is_deducible ? 'CHEQUE' : 'NO CHEQUE';
            
            await connection.execute(
                `UPDATE reimbursements 
                 SET status = 'PROCESSED', 
                     processed_at = NOW(), 
                     processed_by = ?, 
                     payment_ref = ?,
                     payment_method = ?
                 WHERE id = ? AND status = 'APPROVED'`,
                [user.id, paymentRef || null, method, r.id]
            );
            
            await createAuditLog({
                entityType: 'reimbursement',
                entityId: r.id,
                action: 'BATCH_PROCESS',
                fromStatus: 'APPROVED',
                toStatus: 'PROCESSED',
                actorUserId: user.id,
                comment: `Batch Pay. Method: ${method}`
            });
        }
        await connection.commit();
    } catch(e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }

    return { success: true, message: 'Pagos procesados correctamente' };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción desconocida' });
});