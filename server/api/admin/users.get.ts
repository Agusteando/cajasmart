import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);

  const db = await useDb();

  const [rows]: any = await db.execute(
    `SELECT
       u.id, u.nombre, u.email, u.activo, u.plantel_id, u.avatar_url,
       p.codigo as plantel_codigo, p.nombre as plantel_nombre,
       r.nombre as role_name, r.nivel_permiso as role_level
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN planteles p ON u.plantel_id = p.id
     ORDER BY u.id DESC
     LIMIT 500`
  );

  return rows || [];
});
