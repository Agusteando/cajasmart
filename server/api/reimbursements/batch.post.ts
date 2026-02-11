import { useDb } from '~/server/utils/db';
import { requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { notifyRoleUsers, createNotification } from '~/server/utils/notifications';

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  
  // action: 'update_treasury'
  // ids: number[]
  // updates: { is_deducible?: boolean, treasury_status?: 'RETENIDO' | 'CHEQUE' | 'EFECTIVO' | null, payment_ref?: string }
  
  const { action, ids, updates } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();
  const placeholders = ids.map(() => '?').join(',');

  if (action === 'update_treasury') {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        for (const id of ids) {
            const updateFields: string[] = [];
            const updateParams: any[] = [];
            const auditChanges: string[] = [];

            // 1. Update Source Type (Independent)
            if (typeof updates.is_deducible === 'boolean') {
                updateFields.push('is_deducible = ?');
                updateParams.push(updates.is_deducible ? 1 : 0);
                auditChanges.push(`Type -> ${updates.is_deducible ? 'Deducible' : 'No Deducible'}`);
            }

            // 2. Update Status / Payment Method
            // Options: 'RETENIDO', 'CHEQUE', 'EFECTIVO'
            if (updates.treasury_status) {
                if (updates.treasury_status === 'RETENIDO') {
                    updateFields.push('status = ?');
                    updateParams.push('ON_HOLD');
                    auditChanges.push('Status -> ON_HOLD (Retenido)');
                } 
                else if (updates.treasury_status === 'CHEQUE') {
                    updateFields.push('status = ?, payment_method = ?, processed_at = NOW(), processed_by = ?, payment_ref = ?');
                    updateParams.push('PROCESSED', 'CHEQUE', user.id, updates.payment_ref || null);
                    auditChanges.push('Status -> PROCESSED (Cheque emitido)');
                }
                else if (updates.treasury_status === 'EFECTIVO') {
                    updateFields.push('status = ?, payment_method = ?, processed_at = NOW(), processed_by = ?, payment_ref = ?');
                    updateParams.push('PROCESSED', 'EFECTIVO', user.id, updates.payment_ref || null);
                    auditChanges.push('Status -> PROCESSED (Envío de efectivo)');
                }
            }

            if (updateFields.length > 0) {
                updateParams.push(id);
                await connection.execute(
                    `UPDATE reimbursements SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateParams
                );

                await createAuditLog({
                    entityType: 'reimbursement',
                    entityId: id,
                    action: 'TREASURY_UPDATE',
                    actorUserId: user.id,
                    comment: auditChanges.join(', ')
                });

                // Notifications for final status
                if (updates.treasury_status === 'CHEQUE' || updates.treasury_status === 'EFECTIVO') {
                    // Fetch user_id to notify
                    const [rows]: any = await connection.execute('SELECT user_id, total_amount FROM reimbursements WHERE id = ?', [id]);
                    if (rows[0]) {
                        await createNotification({
                            userId: rows[0].user_id,
                            type: 'PROCESSED',
                            title: 'Pago Enviado',
                            message: `Tu solicitud #${id} ha sido pagada vía ${updates.treasury_status}. Por favor confirma recepción.`,
                            referenceType: 'reimbursement',
                            referenceId: id,
                            url: '/reembolsos'
                        });
                    }
                }
            }
        }
        await connection.commit();
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }

    return { success: true, message: 'Actualización exitosa' };
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción desconocida' });
});