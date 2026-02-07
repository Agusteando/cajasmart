import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import { createNotification, notifyRoleUsers } from '~/server/utils/notifications';

interface WorkflowAction {
  id: number;
  action: 'APPROVE' | 'RETURN' | 'PROCESS' | 'CONFIRM_RECEIPT';
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
    PROCESS: { requiredRole: 'TESORERIA', nextStatus: 'PROCESSED' },
    RETURN: { requiredRole: 'TESORERIA', nextStatus: 'RETURNED' }
  },
  PROCESSED: {
    // NEW: Final confirmation by the requester (Admin Plantel)
    CONFIRM_RECEIPT: { requiredRole: 'ADMIN_PLANTEL', nextStatus: 'RECEIVED' }
  }
};

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<WorkflowAction>(event);

  const { id, action, reason, paymentRef } = body;

  if (!id || !action) {
    throw createError({ statusCode: 400, statusMessage: 'ID y acción son requeridos' });
  }

  if (action === 'RETURN' && !String(reason || '').trim()) {
    throw createError({ statusCode: 400, statusMessage: 'El motivo de devolución es requerido' });
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

  // Role Check
  // Special case: CONFIRM_RECEIPT requires user to be the owner (ADMIN_PLANTEL) OR Super Admin
  if (action === 'CONFIRM_RECEIPT') {
    if (user.role_name !== 'SUPER_ADMIN') {
      // Must be the owner
      if (Number(reimbursement.user_id) !== Number(user.id)) {
        throw createError({ statusCode: 403, statusMessage: 'Solo el solicitante puede confirmar la recepción' });
      }
    }
  } else {
    // Standard Role Check
    if (user.role_name !== 'SUPER_ADMIN' && user.role_name !== transition.requiredRole) {
      throw createError({ statusCode: 403, statusMessage: `Solo ${transition.requiredRole} puede realizar esta acción` });
    }
  }

  const newStatus = transition.nextStatus;

  // Build update query
  let updateFields: string[] = ['status = ?', 'updated_at = NOW()'];
  let updateParams: any[] = [newStatus];

  if (action === 'RETURN') {
    updateFields.push('rejection_reason = ?', 'returned_by = ?');
    updateParams.push(reason, user.id);
  } else if (action === 'PROCESS') {
    // Auto-infer payment method
    const isDeducible = !!reimbursement.is_deducible;
    const paymentMethod = isDeducible ? 'CHEQUE' : 'NO CHEQUE';

    updateFields.push('processed_at = NOW()', 'processed_by = ?', 'payment_ref = ?', 'payment_method = ?');
    updateParams.push(user.id, paymentRef || null, paymentMethod);
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
        : action === 'PROCESS'
          ? `Ref: ${paymentRef || 'N/A'}`
          : undefined
  });

  const amount = parseFloat(reimbursement.total_amount).toFixed(2);

  // NOTIFICATIONS
  switch (action) {
    case 'APPROVE':
      if (newStatus === 'PENDING_FISCAL_REVIEW') {
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
        await notifyRoleUsers(
          'TESORERIA',
          'APPROVED',
          'Solicitud lista para impresión y pago',
          `Solicitud #${id} de $${amount} aprobada para pago`,
          'reimbursement',
          id,
          { url: '/tesoreria', actorUserId: user.id }
        );

        await createNotification({
          userId: reimbursement.user_id,
          type: 'APPROVED',
          title: 'Solicitud aprobada',
          message: `Tu solicitud #${id} de $${amount} ha sido aprobada. Espera el pago.`,
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
        title: 'Pago Enviado',
        message: `Se ha procesado el pago de la solicitud #${id}. Por favor confirma cuando recibas el dinero.`,
        referenceType: 'reimbursement',
        referenceId: id,
        url: '/reembolsos',
        actorUserId: user.id
      });
      break;
      
    case 'CONFIRM_RECEIPT':
        // Notify Treasury that the loop is closed
        await notifyRoleUsers(
          'TESORERIA',
          'COMPLETED',
          'Reembolso Completado',
          `El usuario confirmó la recepción del reembolso #${id}`,
          'reimbursement',
          id,
          { url: '/tesoreria', actorUserId: user.id }
        );
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
      if (newStatus === 'PENDING_FISCAL_REVIEW') return 'Enviado a revisión fiscal';
      if (newStatus === 'APPROVED') return 'Aprobado para Tesorería';
      break;
    case 'RETURN':
      return 'Devuelto al solicitante';
    case 'PROCESS':
      return 'Marcado como PAGADO';
    case 'CONFIRM_RECEIPT':
      return 'Recepción confirmada. Proceso finalizado.';
  }
  return 'Acción completada';
}