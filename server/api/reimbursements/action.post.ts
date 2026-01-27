import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { createNotification, notifyRoleUsers } from '~/server/utils/notifications';

interface WorkflowAction {
  id: number;
  action: 'APPROVE' | 'RETURN' | 'PROCESS';
  reason?: string;
  paymentRef?: string;
}

const VALID_TRANSITIONS: Record<string, Record<string, { requiredRole: string; nextStatus: string }>> = {
  PENDING_OPS_REVIEW: {
    APPROVE: { requiredRole: 'REVISOR_OPS', nextStatus: 'PENDING_FISCAL_REVIEW' },
    RETURN: { requiredRole: 'REVISOR_OPS', nextStatus: 'RETURNED' }
  },
  PENDING_FISCAL_REVIEW: {
    APPROVE: { requiredRole: 'REVISOR_FISCAL', nextStatus: 'APPROVED' },
    RETURN: { requiredRole: 'REVISOR_FISCAL', nextStatus: 'RETURNED' }
  },
  APPROVED: {
    PROCESS: { requiredRole: 'TESORERIA', nextStatus: 'PROCESSED' }
  }
};

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<WorkflowAction>(event);

  const { id, action, reason, paymentRef } = body;

  if (!id || !action) {
    throw createError({ statusCode: 400, statusMessage: 'ID y acción son requeridos' });
  }

  if (action === 'RETURN' && !reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'El motivo/observaciones es requerido' });
  }

  const db = await useDb();

  const [rows]: any = await db.execute(
    `SELECT r.*, u.nombre as solicitante_nombre, u.email as solicitante_email
     FROM reimbursements r
     JOIN users u ON r.user_id = u.id
     WHERE r.id = ?`,
    [id]
  );

  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' });
  }

  const item = rows[0];
  const currentStatus = String(item.status || '');

  const transitions = VALID_TRANSITIONS[currentStatus];
  const transition = transitions?.[action];

  if (!transition) {
    throw createError({ statusCode: 400, statusMessage: 'Acción no válida para el estado actual' });
  }

  // Permission Check
  if (user.role_name !== 'SUPER_ADMIN' && user.role_name !== transition.requiredRole) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  const updates: string[] = ['status = ?', 'updated_at = NOW()'];
  const params: any[] = [transition.nextStatus];

  if (action === 'RETURN') {
    updates.push('rejection_reason = ?', 'returned_by = ?');
    params.push(reason, user.id);
  } else if (action === 'PROCESS') {
    updates.push('processed_at = NOW()', 'processed_by = ?', 'payment_ref = ?');
    params.push(user.id, paymentRef || null);
  } else if (action === 'APPROVE') {
    // Clear rejection info when approving
    updates.push('rejection_reason = NULL', 'returned_by = NULL');
  }

  params.push(id);
  await db.execute(`UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`, params);

  // Audit
  await createAuditLog({
    entityType: 'reimbursement',
    entityId: id,
    action,
    fromStatus: currentStatus,
    toStatus: transition.nextStatus,
    actorUserId: user.id,
    comment:
      action === 'RETURN'
        ? reason
        : action === 'PROCESS' && paymentRef
          ? `Ref: ${paymentRef}`
          : undefined
  });

  // Notifications
  const amountStr = Number.parseFloat(item.amount || 0).toFixed(2);

  if (action === 'APPROVE' && transition.nextStatus === 'PENDING_FISCAL_REVIEW') {
    await notifyRoleUsers(
      'REVISOR_FISCAL',
      'NEW_PENDING',
      'Nueva solicitud para revisión fiscal',
      `Solicitud #${id} de $${amountStr} aprobada operativamente`,
      'reimbursement',
      id
    );
  }

  if (action === 'APPROVE' && transition.nextStatus === 'APPROVED') {
    await notifyRoleUsers(
      'TESORERIA',
      'APPROVED',
      'Solicitud lista para pago',
      `Solicitud #${id} de $${amountStr} aprobada para pago`,
      'reimbursement',
      id
    );

    await createNotification({
      userId: item.user_id,
      type: 'APPROVED',
      title: 'Solicitud aprobada',
      message: `Tu solicitud #${id} de $${amountStr} ha sido aprobada y está lista para pago`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  }

  if (action === 'RETURN') {
    await createNotification({
      userId: item.user_id,
      type: 'RETURNED',
      title: 'Solicitud regresada',
      message: `Tu solicitud #${id} fue regresada. Observaciones: ${reason}`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  }

  if (action === 'PROCESS') {
    await createNotification({
      userId: item.user_id,
      type: 'PROCESSED',
      title: 'Reembolso procesado',
      message: `Tu solicitud #${id} de $${amountStr} ha sido procesada${paymentRef ? ` (Ref: ${paymentRef})` : ''}`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  }

  return { success: true, id, newStatus: transition.nextStatus };
});
