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

// Define valid transitions
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
    throw createError({
      statusCode: 400,
      statusMessage: 'ID y acción son requeridos'
    });
  }

  if (action === 'RETURN' && !reason?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El motivo de devolución es requerido'
    });
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
    throw createError({
      statusCode: 404,
      statusMessage: 'Solicitud no encontrada'
    });
  }

  const reimbursement = rows[0];
  const currentStatus = reimbursement.status;

  const transitions = VALID_TRANSITIONS[currentStatus];
  if (!transitions || !transitions[action]) {
    throw createError({
      statusCode: 400,
      statusMessage: `Acción '${action}' no válida para estado '${currentStatus}'`
    });
  }

  const transition = transitions[action];

  if (user.role_name !== 'SUPER_ADMIN' && user.role_name !== transition.requiredRole) {
    throw createError({
      statusCode: 403,
      statusMessage: `Solo ${transition.requiredRole} puede realizar esta acción`
    });
  }

  const newStatus = transition.nextStatus;

  let updateFields: string[] = ['status = ?'];
  let updateParams: any[] = [newStatus];

  if (action === 'RETURN') {
    updateFields.push('rejection_reason = ?', 'returned_by = ?');
    updateParams.push(reason, user.id);
  } else if (action === 'PROCESS') {
    updateFields.push('processed_at = NOW()', 'processed_by = ?', 'payment_ref = ?');
    updateParams.push(user.id, paymentRef || null);
  }

  if (action === 'APPROVE') {
    updateFields.push('rejection_reason = NULL', 'returned_by = NULL');
  }

  updateParams.push(id);

  await db.execute(`UPDATE reimbursements SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

  await createAuditLog({
    entityType: 'reimbursement',
    entityId: id,
    action: action,
    fromStatus: currentStatus,
    toStatus: newStatus,
    actorUserId: user.id,
    comment:
      action === 'RETURN'
        ? reason
        : action === 'PROCESS' && paymentRef
          ? `Ref: ${paymentRef}`
          : undefined
  });

  const amount = parseFloat(reimbursement.amount).toFixed(2);

  switch (action) {
    case 'APPROVE':
      if (newStatus === 'PENDING_FISCAL_REVIEW') {
        // FIX: Passed actorUserId
        await notifyRoleUsers(
          'REVISOR_FISCAL',
          'NEW_PENDING',
          'Nueva solicitud para revisión fiscal',
          `Solicitud #${id} de $${amount} aprobada operativamente`,
          'reimbursement',
          id,
          { url: '/fiscal', actorUserId: user.id }
        );
      } else if (newStatus === 'APPROVED') {
        // FIX: Passed actorUserId
        await notifyRoleUsers(
          'TESORERIA',
          'APPROVED',
          'Solicitud lista para pago',
          `Solicitud #${id} de $${amount} aprobada para pago`,
          'reimbursement',
          id,
          { url: '/tesoreria', actorUserId: user.id }
        );

        await createNotification({
          userId: reimbursement.user_id,
          type: 'APPROVED',
          title: 'Solicitud aprobada',
          message: `Tu solicitud #${id} de $${amount} ha sido aprobada y está lista para pago`,
          referenceType: 'reimbursement',
          referenceId: id,
          url: '/reembolsos',
          actorUserId: user.id
        });
      }
      break;

    case 'RETURN':
      await createNotification({
        userId: reimbursement.user_id,
        type: 'RETURNED',
        title: 'Solicitud devuelta',
        message: `Tu solicitud #${id} fue devuelta. Motivo: ${reason}`,
        referenceType: 'reimbursement',
        referenceId: id,
        url: '/reembolsos',
        actorUserId: user.id
      });
      break;

    case 'PROCESS':
      await createNotification({
        userId: reimbursement.user_id,
        type: 'PROCESSED',
        title: 'Reembolso procesado',
        message: `Tu solicitud #${id} de $${amount} ha sido procesada${paymentRef ? ` (Ref: ${paymentRef})` : ''}`,
        referenceType: 'reimbursement',
        referenceId: id,
        url: '/reembolsos',
        actorUserId: user.id
      });
      break;
  }

  return {
    success: true,
    id,
    previousStatus: currentStatus,
    newStatus,
    message: getActionMessage(action, newStatus)
  };
});

function getActionMessage(action: string, newStatus: string): string {
  switch (action) {
    case 'APPROVE':
      if (newStatus === 'PENDING_FISCAL_REVIEW') return 'Aprobado operativamente, enviado a revisión fiscal';
      if (newStatus === 'APPROVED') return 'Aprobado para pago';
      break;
    case 'RETURN':
      return 'Devuelto al solicitante';
    case 'PROCESS':
      return 'Marcado como procesado/pagado';
  }
  return 'Acción completada';
}