import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  const q = getQuery(event);
  const search = String(q.search || '').trim().toLowerCase();

  const db = await useDb();

  let sql = `
    SELECT 
      i.id as item_id, 
      i.file_url, 
      i.concept,
      r.id as reimbursement_id,
      r.status,
      u.nombre as user_name,
      p.nombre as plantel_name
    FROM reimbursement_items i
    JOIN reimbursements r ON i.reimbursement_id = r.id
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
    WHERE i.file_url IS NOT NULL
  `;

  const params: any[] = [];

  if (search) {
    sql += ` AND (
      i.file_url LIKE ? OR 
      u.nombre LIKE ? OR 
      p.nombre LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY i.id DESC LIMIT 50';

  const [rows]: any = await db.execute(sql, params);
  return rows;
});