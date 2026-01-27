import { useDb } from '~/server/utils/db';
import { requireAuth, createNotification } from '~/server/utils/notifications'; // actually import createNotification from utils
import { requireAuth as auth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = auth(event); // Alias to avoid name clash
  const body = await readBody(event);
  const reason = body.reason || '';

  // Notify Super Admins
  await notifyRoleUsers(
    'SUPER_ADMIN',
    'ACCESS_REQUEST',
    'Solicitud de Acceso',
    `El usuario ${user.nombre} (${user.email}) solicita activación. Motivo: ${reason}`,
    'user',
    user.id
  );

  // Log self notification for UI state
  await createNotification({
    userId: user.id,
    type: 'ACCESS_REQUEST',
    title: 'Solicitud Enviada',
    message: 'Esperando aprobación del administrador.',
    referenceType: 'user',
    referenceId: user.id
  });

  return { success: true };
});