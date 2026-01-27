import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<{ plantelId?: number }>(event);

  const plantelId = Number(body?.plantelId);
  if (!Number.isFinite(plantelId) || plantelId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Plantel inválido' });
  }

  // Only requester or super admin should do this
  if (user.role_name !== 'ADMIN_PLANTEL' && user.role_name !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  const db = await useDb();

  // Validate plantel exists + active
  const [pRows]: any = await db.execute(
    'SELECT id, nombre FROM planteles WHERE id = ? AND activo = 1 LIMIT 1',
    [plantelId]
  );
  const plantel = pRows?.[0];
  if (!plantel) {
    throw createError({ statusCode: 400, statusMessage: 'Plantel no disponible' });
  }

  // Update DB
  await db.execute('UPDATE users SET plantel_id = ? WHERE id = ?', [plantelId, user.id]);

  // Fetch fresh user data
  const [rows]: any = await db.execute(
    `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
     FROM users u
     LEFT JOIN planteles p ON u.plantel_id = p.id
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?
     LIMIT 1`,
    [user.id]
  );

  const fresh = rows?.[0];
  if (!fresh) throw createError({ statusCode: 500, statusMessage: 'No se pudo actualizar usuario' });

  const sessionUser = {
    id: fresh.id,
    nombre: fresh.nombre,
    email: fresh.email,
    role_name: fresh.role_name,
    role_level: fresh.nivel_permiso,
    plantel_id: fresh.plantel_id,
    plantel_nombre: fresh.plantel_nombre || 'Sin Asignar',
    avatar: user.avatar || null
  };

  // ✅ refresh cookie
  setUserSessionCookie(event, sessionUser);

  return { success: true, user: sessionUser };
});
