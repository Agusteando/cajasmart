import { useDb } from '~/server/utils/db';
import { requireAuth, requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  const { action, ids, paymentRef } = body; // action: 'print' | 'process'

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  // Fetch details for both actions
  // Need placeholder string for IN clause
  const placeholders = ids.map(() => '?').join(',');
  const [rows]: any = await db.execute(
    `SELECT r.*, p.codigo as plantelCodigo, p.nombre as plantelNombre
     FROM reimbursements r
     JOIN planteles p ON r.plantel_id = p.id
     WHERE r.id IN (${placeholders})`,
    ids
  );

  if (action === 'print') {
    // Return data structured for the print view
    const totalAmount = rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);
    return {
      success: true,
      data: {
        generatedBy: user.nombre,
        totalItems: rows.length,
        totalAmount: totalAmount.toFixed(2),
        items: rows.map((r: any) => ({
          id: r.id,
          invoiceNumber: r.invoice_number,
          provider: r.provider,
          concept: r.concept,
          amount: parseFloat(r.amount).toFixed(2),
          plantelCodigo: r.plantelCodigo
        }))
      }
    };
  }

  if (action === 'process') {
    // Update all to PROCESSED
    await db.execute(
      `UPDATE reimbursements 
       SET status = 'PROCESSED', processed_at = NOW(), processed_by = ?, payment_ref = ?
       WHERE id IN (${placeholders}) AND status = 'APPROVED'`,
      [user.id, paymentRef || null, ...ids]
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
        comment: `Lote ref: ${paymentRef || 'N/A'}`
      });
    }

    return { success: true, message: 'Procesado correctamente' };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción desconocida' });
});