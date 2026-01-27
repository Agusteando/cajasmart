import { useDb } from '~/server/utils/db';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string; password: string }>(event);
  const db = await useDb();

  const [rows]: any = await db.execute(
    `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
     FROM users u
     LEFT JOIN planteles p ON u.plantel_id = p.id
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = ?`,
    [body.email]
  );

  const user = rows?.[0];

  if (!user || user.password_hash !== body.password) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const sessionUser = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    role_name: user.role_name,
    role_level: user.nivel_permiso,
    plantel_id: user.plantel_id || null,
    plantel_nombre: user.plantel_nombre || 'Sin Asignar',
    avatar: user.avatar_url || null
  };

  setUserSessionCookie(event, sessionUser);
  return { user: sessionUser };
});
