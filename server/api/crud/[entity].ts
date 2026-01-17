import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const entity = event.context.params.entity; // 'users', 'planteles', 'roles'
  const method = event.node.req.method;
  const db = await useDb();

  // Security Check (In prod, check session here)
  const allowedEntities = ['users', 'planteles', 'roles'];
  if (!allowedEntities.includes(entity)) throw createError({ statusCode: 403 });

  if (method === 'GET') {
    // Fetch All
    const [rows] = await db.execute(`SELECT * FROM ${entity} ORDER BY id DESC`);
    return rows;
  }

  if (method === 'POST') {
    // Create New
    const body = await readBody(event);
    const keys = Object.keys(body);
    const values = Object.values(body);
    const placeholders = keys.map(() => '?').join(',');
    
    await db.execute(
      `INSERT INTO ${entity} (${keys.join(',')}) VALUES (${placeholders})`, 
      values
    );
    return { success: true };
  }

  if (method === 'PUT') {
    // Update
    const body = await readBody(event);
    const id = body.id;
    delete body.id; // Don't update ID
    
    const updates = Object.keys(body).map(k => `${k} = ?`).join(',');
    const values = [...Object.values(body), id];

    await db.execute(`UPDATE ${entity} SET ${updates} WHERE id = ?`, values);
    return { success: true };
  }

  if (method === 'DELETE') {
    const query = getQuery(event);
    await db.execute(`DELETE FROM ${entity} WHERE id = ?`, [query.id]);
    return { success: true };
  }
});