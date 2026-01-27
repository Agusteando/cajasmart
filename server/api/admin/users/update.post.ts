import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);

  const body = await readBody<{
    userId?: number;
    roleName?: string;
    plantelId?: number | null;
    activo?: boolean | number;
  }>(event);

  const userId = Number(body?.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId inválido' });
  }

  const roleName = String(body?.roleName || '').trim();
  const plantelIdRaw = body?.plantelId == null ? null : Number(body.plantelId);
  const activoRaw = body?.activo;

  const db = await useDb();

  // Validate target exists
  const [uRows]: any = await db.execute(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (!uRows?.[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' });
  }

  let roleId: number | null = null;
  if (roleName) {
    const [rRows]: any = await db.execute(
      `SELECT id FROM roles WHERE nombre = ? LIMIT 1`,
      [roleName]
    );
    roleId = rRows?.[0]?.id ? Number(rRows[0].id) : null;
    if (!roleId) {
      throw createError({ statusCode: 400, statusMessage: `Rol inválido: ${roleName}` });
    }
  }

  let plantelId: number | null = null;
  if (plantelIdRaw != null) {
    if (!Number.isFinite(plantelIdRaw) || plantelIdRaw <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'plantelId inválido' });
    }
    const [pRows]: any = await db.execute(
      `SELECT id FROM planteles WHERE id = ? LIMIT 1`,
      [plantelIdRaw]
    );
    if (!pRows?.[0]) {
      throw createError({ statusCode: 400, statusMessage: 'Plantel no encontrado' });
    }
    plantelId = plantelIdRaw;
  } else if (body?.plantelId === null) {
    plantelId = null; // explicit clear
  } else {
    plantelId = null; // means "not provided" unless we detect below
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (roleId != null) {
    updates.push('role_id = ?');
    params.push(roleId);
  }

  if (body?.plantelId !== undefined) {
    updates.push('plantel_id = ?');
    params.push(plantelId);
  }

  if (activoRaw !== undefined) {
    const activo = typeof activoRaw === 'boolean' ? (activoRaw ? 1 : 0) : Number(activoRaw) ? 1 : 0;
    updates.push('activo = ?');
    params.push(activo);
  }

  if (updates.length === 0) {
    return { success: true };
  }

  params.push(userId);

  await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  // Return fresh user row
  const [rows]: any = await db.execute(
    `SELECT
       u.id, u.nombre, u.email, u.activo, u.plantel_id, u.avatar_url,
       p.codigo as plantel_codigo, p.nombre as plantel_nombre,
       r.nombre as role_name, r.nivel_permiso as role_level
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN planteles p ON u.plantel_id = p.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  return { success: true, user: rows?.[0] || null };
});
