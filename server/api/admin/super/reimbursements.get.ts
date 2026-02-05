import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  const q = getQuery(event);
  const search = String(q.search || '').trim().toLowerCase();
  const plantelId = Number(q.plantelId);

  const db = await useDb();

  // REMOVED r.folio from SELECT list
  let sql = `
    SELECT 
      r.id, r.status, r.reimbursement_date, r.total_amount, 
      p.nombre as plantel_nombre,
      u.nombre as solicitante_nombre,
      (SELECT COUNT(*) FROM reimbursement_items i WHERE i.reimbursement_id = r.id) as items_count,
      (SELECT COUNT(*) FROM reimbursement_items i WHERE i.reimbursement_id = r.id AND i.file_url IS NOT NULL) as files_count
    FROM reimbursements r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (plantelId > 0) {
    sql += ' AND r.plantel_id = ?';
    params.push(plantelId);
  }

  if (search) {
    sql += ` AND (
      r.id LIKE ? OR 
      u.nombre LIKE ? OR 
      p.nombre LIKE ? OR
      r.status LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY r.id DESC LIMIT 100';

  const [rows]: any = await db.execute(sql, params);

  // Computed folio in JS
  return rows.map((r: any) => ({
    ...r,
    folio: `R-${String(r.id).padStart(5, '0')}`
  }));
});