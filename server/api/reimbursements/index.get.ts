import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const query = getQuery(event);
  const status = query.status ? String(query.status) : null;
  
  const db = await useDb();
  
  // Base query
  let sql = `
    SELECT 
      r.*,
      u.nombre as solicitante_nombre,
      p.nombre as plantel_nombre,
      p.codigo as plantel_codigo
    FROM reimbursements r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
  `;
  
  const params: any[] = [];
  const conditions: string[] = [];
  
  // 1. Filter by Status if provided
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  // 2. Security Scoping based on Role
  if (user.role_name === 'ADMIN_PLANTEL') {
    // Requesters see only their own branch's requests (or only their own)
    // "Requester can create/edit... for their plantel". 
    // We scope to plantel_id to allow seeing history of the branch if desired, 
    // or user_id if strict. Using user_id for strict safety on "My Reimbursements".
    conditions.push('r.user_id = ?');
    params.push(user.id);
  } 
  else if (user.role_name === 'REVISOR_OPS') {
    // Ops generally see Pending Ops, but if no status filter, maybe they see all?
    // Usually they just need their queue.
    if (!status) {
        // If no specific filter, show them things relevant to ops + history
        // or just everything. Let's allow everything but filtered by UI.
    }
  }
  // Other roles (FISCAL, TESORERIA, SUPER_ADMIN) see global list (filtered by status in UI)

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  sql += ' ORDER BY r.created_at DESC LIMIT 100';

  const [rows] = await db.execute(sql, params);
  return rows;
});