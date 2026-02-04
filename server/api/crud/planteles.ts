import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  const method = event.node.req.method;
  const db = await useDb();

  if (method === 'GET') {
    const [rows] = await db.execute(`
      SELECT p.*, rs.nombre as razon_social_nombre 
      FROM planteles p 
      LEFT JOIN razones_sociales rs ON p.razon_social_id = rs.id 
      ORDER BY p.nombre ASC
    `);
    return rows;
  }

  if (method === 'POST') {
    const body = await readBody(event);
    // Explicit fields
    await db.execute(
      `INSERT INTO planteles (codigo, nombre, presupuesto_mensual, razon_social_id, activo) VALUES (?, ?, ?, ?, ?)`,
      [body.codigo, body.nombre, body.presupuesto_mensual || 0, body.razon_social_id || null, body.activo ? 1 : 0]
    );
    return { success: true };
  }

  if (method === 'PUT') {
    const body = await readBody(event);
    const id = body.id;
    if (!id) throw createError({ statusCode: 400 });

    await db.execute(
      `UPDATE planteles SET codigo=?, nombre=?, presupuesto_mensual=?, razon_social_id=?, activo=? WHERE id=?`,
      [body.codigo, body.nombre, body.presupuesto_mensual || 0, body.razon_social_id || null, body.activo ? 1 : 0, id]
    );
    return { success: true };
  }
});