import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody(event);

  if (!body.plantelId) throw createError({ statusCode: 400 });

  const db = await useDb();
  
  // Update DB
  await db.execute('UPDATE users SET plantel_id = ? WHERE id = ?', [body.plantelId, user.id]);
  
  // Fetch fresh user data including plantel name
  const [rows]: any = await db.execute(
    `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
     FROM users u
     LEFT JOIN planteles p ON u.plantel_id = p.id
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [user.id]
  );
  
  const freshUser = rows[0];

  // Update session object
  const sessionUser = {
    id: freshUser.id,
    nombre: freshUser.nombre,
    email: freshUser.email,
    role_name: freshUser.role_name,
    role_level: freshUser.nivel_permiso,
    plantel_id: freshUser.plantel_id,
    plantel_nombre: freshUser.plantel_nombre,
    avatar: user.avatar
  };

  return { success: true, user: sessionUser };
});