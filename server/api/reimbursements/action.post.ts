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
  },
  // Allow resubmitting from RETURNED
  RETURNED: {
    SUBMIT: { requiredRole: 'ADMIN_PLANTEL', nextStatus: 'PENDING_OPS_REVIEW' } 
  }
};

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<WorkflowAction>(event);
  const { id, action, reason, paymentRef } = body;

  if (!id || !action) throw createError({ statusCode: 400, statusMessage: 'Faltan datos' });

  const db = await useDb();
  const [rows]: any = await db.execute('SELECT * FROM reimbursements WHERE id = ?', [id]);
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' });

  const item = rows[0];
  
  // Special case: Resubmit (handled separately or via update, but simple state change here)
  if (item.status === 'RETURNED' && action === 'APPROVE') {
    // If frontend sends APPROVE for a returned item by requester, map it to resubmit? 
    // Usually resubmit is an edit. Let's assume standard flow here.
  }

  const transitions = VALID_TRANSITIONS[item.status];
  const transition = transitions?.[action];

  if (!transition) {
    throw createError({ statusCode: 400, statusMessage: 'Acción no válida para el estado actual' });
  }

  // Permission Check
  if (user.role_name !== 'SUPER_ADMIN' && user.role_name !== transition.requiredRole) {
    // Special case: Requester resubmitting own item
    if (transition.requiredRole === 'ADMIN_PLANTEL' && item.user_id !== user.id) {
       throw createError({ statusCode: 403 });
    }
    if (transition.requiredRole !== 'ADMIN_PLANTEL') {
       throw createError({ statusCode: 403 });
    }
  }

  if (action === 'RETURN' && !reason) throw createError({ statusCode: 400, statusMessage: 'Motivo requerido' });

  const updates: string[] = ['status = ?', 'updated_at = NOW()'];
  const params: any[] = [transition.nextStatus];

  if (action === 'RETURN') {
    updates.push('rejection_reason = ?', 'returned_by = ?');
    params.push(reason, user.id);
  } else if (action === 'PROCESS') {
    updates.push('processed_at = NOW()', 'processed_by = ?', 'payment_ref = ?');
    params.push(user.id, paymentRef || null);
  } else if (action === 'APPROVE') {
    // Clear rejection info
    updates.push('rejection_reason = NULL', 'returned_by = NULL');
  }

  params.push(id);
  await db.execute(`UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`, params);

  // Audit
  await createAuditLog({
    entityType: 'reimbursement',
    entityId: id,
    action,
    fromStatus: item.status,
    toStatus: transition.nextStatus,
    actorUserId: user.id,
    comment: reason || paymentRef
  });

  // Notifications
  const amountStr = parseFloat(item.amount).toFixed(2);
  
  if (action === 'RETURN') {
    await createNotification({
      userId: item.user_id,
      type: 'RETURNED',
      title: 'Solicitud Devuelta',
      message: `Tu solicitud #${id} fue devuelta: ${reason}`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  } else if (transition.nextStatus === 'APPROVED') {
    await notifyRoleUsers('TESORERIA', 'PAYMENT_READY', 'Pago Pendiente', `Solicitud #${id} ($${amountStr}) aprobada`, 'reimbursement', id);
  } else if (transition.nextStatus === 'PROCESSED') {
    await createNotification({
      userId: item.user_id,
      type: 'PAID',
      title: 'Reembolso Pagado',
      message: `Solicitud #${id} ha sido pagada.`,
      referenceType: 'reimbursement',
      referenceId: id
    });
  }

  return { success: true };
});