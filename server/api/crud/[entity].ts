import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  // ✅ Admin-only (real SUPER_ADMIN, even if impersonating)
  requireSuperAdminReal(event);

  const entity = event.context.params?.entity;
  const method = event.node.req.method;

  const allowedEntities = ['users', 'planteles', 'roles'];
  if (!entity || !allowedEntities.includes(entity)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden Entity' });
  }

  const db = await useDb();

  if (method === 'GET') {
    const [rows] = await db.execute(`SELECT * FROM ${entity} ORDER BY id DESC`);
    return rows;
  }

  if (method === 'POST') {
    const body = await readBody(event);
    const keys = Object.keys(body);
    const values = Object.values(body);

    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${entity} (${keys.join(',')}) VALUES (${placeholders})`;

    await db.execute(sql, values);
    return { success: true };
  }

  if (method === 'PUT') {
    const body = await readBody(event);
    const id = body.id;
    delete body.id;

    const keys = Object.keys(body);
    const values = Object.values(body);

    const setClause = keys.map((k) => `${k} = ?`).join(',');
    const sql = `UPDATE ${entity} SET ${setClause} WHERE id = ?`;

    await db.execute(sql, [...values, id]);
    return { success: true };
  }

  if (method === 'DELETE') {
    const query = getQuery(event);
    const id = query.id;
    await db.execute(`DELETE FROM ${entity} WHERE id = ?`, [id]);
    return { success: true };
  }
});
