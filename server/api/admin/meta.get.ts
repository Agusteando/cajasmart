import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);

  const db = await useDb();

  const [roles]: any = await db.execute(
    `SELECT id, nombre, nivel_permiso
     FROM roles
     ORDER BY nivel_permiso DESC, nombre ASC`
  );

  const [planteles]: any = await db.execute(
    `SELECT id, codigo, nombre, activo
     FROM planteles
     ORDER BY nombre ASC`
  );
  
  const [razones]: any = await db.execute(
    `SELECT id, nombre FROM razones_sociales ORDER BY nombre ASC`
  );

  return {
    roles: roles || [],
    planteles: planteles || [],
    razones_sociales: razones || []
  };
});