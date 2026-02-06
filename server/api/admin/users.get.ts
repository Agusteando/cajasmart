import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);

  const db = await useDb();

  // 1. Fetch Users
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

  // 2. Fetch User Plantel Assignments (Junction Table)
  const userIds = rows.map((u: any) => u.id);
  let assignments: any[] = [];
  
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    const [aRows]: any = await db.execute(
      `SELECT user_id, plantel_id FROM user_planteles WHERE user_id IN (${placeholders})`,
      userIds
    );
    assignments = aRows;
  }

  // 3. Map assignments to users
  const assignmentMap: Record<number, number[]> = {};
  for (const a of assignments) {
    if (!assignmentMap[a.user_id]) assignmentMap[a.user_id] = [];
    assignmentMap[a.user_id].push(a.plantel_id);
  }

  // 4. Attach to user objects
  return rows.map((u: any) => ({
    ...u,
    assigned_plantel_ids: assignmentMap[u.id] || []
  }));
});