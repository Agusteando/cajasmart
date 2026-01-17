export default defineEventHandler(async (event) => {
  // Read params
  const entity = event.context.params?.entity;
  const method = event.node.req.method;
  
  // Security Allowlist (Prevent SQL Injection on table names)
  const allowedEntities = ['users', 'planteles', 'roles'];
  if (!entity || !allowedEntities.includes(entity)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden Entity' });
  }

  const db = await useDb();

  // GET: List all
  if (method === 'GET') {
    const [rows] = await db.execute(`SELECT * FROM ${entity} ORDER BY id DESC`);
    return rows;
  }

  // POST: Create
  if (method === 'POST') {
    const body = await readBody(event);
    const keys = Object.keys(body);
    const values = Object.values(body);
    
    // Construct SQL: INSERT INTO table (col1, col2) VALUES (?, ?)
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${entity} (${keys.join(',')}) VALUES (${placeholders})`;
    
    await db.execute(sql, values);
    return { success: true };
  }

  // PUT: Update
  if (method === 'PUT') {
    const body = await readBody(event);
    const id = body.id;
    delete body.id; // Remove ID from update fields

    const keys = Object.keys(body);
    const values = Object.values(body);
    
    // Construct SQL: UPDATE table SET col1=?, col2=? WHERE id=?
    const setClause = keys.map(k => `${k} = ?`).join(',');
    const sql = `UPDATE ${entity} SET ${setClause} WHERE id = ?`;
    
    await db.execute(sql, [...values, id]);
    return { success: true };
  }

  // DELETE
  if (method === 'DELETE') {
    const query = getQuery(event);
    const id = query.id;
    await db.execute(`DELETE FROM ${entity} WHERE id = ?`, [id]);
    return { success: true };
  }
});