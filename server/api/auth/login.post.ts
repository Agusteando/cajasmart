import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const db = await useDb();

  // 1. Check if user exists
  const [rows] = await db.execute(
    'SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso FROM users u LEFT JOIN planteles p ON u.plantel_id = p.id JOIN roles r ON u.role_id = r.id WHERE email = ?',
    [body.email]
  );

  const user = rows[0];

  // 2. Validate Password (Simple check for demo - use bcrypt in real prod)
  if (!user || user.password_hash !== body.password) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  // 3. Return user info (excluding password)
  const { password_hash, ...safeUser } = user;
  return { user: safeUser };
});