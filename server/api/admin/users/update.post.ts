import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);

  const body = await readBody<{
    userId?: number;
    roleName?: string;
    plantelId?: number | null; // Primary/Default (Legacy column)
    plantelIds?: number[];     // New Multi-select
    activo?: boolean | number;
  }>(event);

  const userId = Number(body?.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId inválido' });
  }

  const roleName = String(body?.roleName || '').trim();
  const primaryPlantelId = body?.plantelId == null ? null : Number(body.plantelId);
  const plantelIds = Array.isArray(body?.plantelIds) ? body.plantelIds : [];
  const activoRaw = body?.activo;

  const db = await useDb();
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Validate User
    const [uRows]: any = await connection.execute(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!uRows?.[0]) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' });

    // 2. Resolve Role
    let roleId: number | null = null;
    if (roleName) {
      const [rRows]: any = await connection.execute(`SELECT id FROM roles WHERE nombre = ? LIMIT 1`, [roleName]);
      if (rRows?.[0]) roleId = Number(rRows[0].id);
      else throw createError({ statusCode: 400, statusMessage: `Rol inválido: ${roleName}` });
    }

    // 3. Prepare Update Fields (Basic Info)
    const updates: string[] = [];
    const params: any[] = [];

    if (roleId != null) {
      updates.push('role_id = ?');
      params.push(roleId);
    }

    if (body?.plantelId !== undefined) {
      updates.push('plantel_id = ?');
      params.push(primaryPlantelId);
    }

    if (activoRaw !== undefined) {
      updates.push('activo = ?');
      params.push(activoRaw ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(userId);
      await connection.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // 4. Update Multi-Plantel Assignments
    // Logic: If plantelIds is provided (even empty array), we overwrite.
    if (body.plantelIds !== undefined) {
      // Clear existing
      await connection.execute('DELETE FROM user_planteles WHERE user_id = ?', [userId]);

      // Insert new
      if (plantelIds.length > 0) {
        // Dedup and validate numbers
        const uniqueIds = [...new Set(plantelIds.map(Number).filter(n => n > 0))];
        if (uniqueIds.length > 0) {
          const values = uniqueIds.map(() => `(?, ?)`).join(',');
          const flatParams = uniqueIds.flatMap(pid => [userId, pid]);
          await connection.execute(
            `INSERT INTO user_planteles (user_id, plantel_id) VALUES ${values}`,
            flatParams
          );
        }
      }
    }

    await connection.commit();

    // 5. Return Fresh User Data (Re-query to get join table data)
    const [rows]: any = await connection.execute(
      `SELECT
         u.id, u.nombre, u.email, u.activo, u.plantel_id, u.avatar_url,
         p.codigo as plantel_codigo, p.nombre as plantel_nombre,
         r.nombre as role_name, r.nivel_permiso as role_level
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN planteles p ON u.plantel_id = p.id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    const [aRows]: any = await connection.execute(
      `SELECT plantel_id FROM user_planteles WHERE user_id = ?`,
      [userId]
    );

    const freshUser = rows?.[0];
    if (freshUser) {
      freshUser.assigned_plantel_ids = aRows.map((x: any) => x.plantel_id);
    }

    return { success: true, user: freshUser || null };

  } catch (e: any) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
});