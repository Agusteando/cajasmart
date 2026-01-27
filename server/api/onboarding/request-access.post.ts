import { requireAuth } from '~/server/utils/auth';
import { createNotification, notifyRoleUsers } from '~/server/utils/notifications';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<{
    reason?: string;
    requestedRole?: string;
    requestedPlantelId?: number | null;
  }>(event);

  const requestedRole = String(body?.requestedRole || '').trim() || 'ADMIN_PLANTEL';
  const requestedPlantelId =
    body?.requestedPlantelId == null ? null : Number(body.requestedPlantelId);
  const reason = String(body?.reason || '').trim();

  let plantelInfo = '';
  if (requestedPlantelId && Number.isFinite(requestedPlantelId)) {
    try {
      const db = await useDb();
      const [pRows]: any = await db.execute(
        'SELECT codigo, nombre FROM planteles WHERE id = ? LIMIT 1',
        [requestedPlantelId]
      );
      const p = pRows?.[0];
      if (p) plantelInfo = ` · Plantel: ${p.codigo} (${p.nombre})`;
    } catch {
      // ignore
    }
  }

  const msg =
    `El usuario ${user.nombre} (${user.email}) solicita acceso.` +
    `\nRol solicitado: ${requestedRole}${plantelInfo}` +
    (reason ? `\nMotivo: ${reason}` : '');

  await notifyRoleUsers(
    'SUPER_ADMIN',
    'ACCESS_REQUEST',
    'Solicitud de Acceso',
    msg,
    'user',
    user.id,
    { url: '/admin/usuarios', actorUserId: user.id }
  );

  await createNotification({
    userId: user.id,
    type: 'ACCESS_REQUEST',
    title: 'Solicitud Enviada',
    message: 'Tu solicitud fue enviada. Un administrador la revisará.',
    referenceType: 'user',
    referenceId: user.id,
    url: '/onboarding',
    actorUserId: user.id
  });

  return { success: true };
});
