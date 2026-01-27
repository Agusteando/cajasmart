import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

const ALL_STATUSES = [
  'DRAFT',
  'PENDING_OPS_REVIEW',
  'PENDING_FISCAL_REVIEW',
  'RETURNED',
  'APPROVED',
  'PROCESSED'
];

const DEFAULT_STATUS_BY_ROLE: Record<string, string | null> = {
  ADMIN_PLANTEL: null,
  REVISOR_OPS: 'PENDING_OPS_REVIEW',
  REVISOR_FISCAL: 'PENDING_FISCAL_REVIEW',
  TESORERIA: 'APPROVED',
  SUPER_ADMIN: null
};

const ALLOWED_STATUS_BY_ROLE: Record<string, string[] | 'ALL'> = {
  ADMIN_PLANTEL: 'ALL',
  REVISOR_OPS: ['PENDING_OPS_REVIEW'],
  REVISOR_FISCAL: ['PENDING_FISCAL_REVIEW'],
  TESORERIA: ['APPROVED', 'PROCESSED'],
  SUPER_ADMIN: 'ALL'
};

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const query = getQuery(event);

  let status = query.status ? String(query.status) : null;

  // Default queue per role
  if (!status) {
    const def = DEFAULT_STATUS_BY_ROLE[user.role_name] ?? null;
    if (def) status = def;
  }

  // Validate status value (if provided)
  if (status && !ALL_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Estatus inválido' });
  }

  // Role-based restriction (prevents e.g. ADMIN_PLANTEL listing global queues)
  const allowed = ALLOWED_STATUS_BY_ROLE[user.role_name] ?? [];
  if (allowed !== 'ALL') {
    if (status && !allowed.includes(status)) {
      throw createError({ statusCode: 403, statusMessage: 'No autorizado para ver este estatus' });
    }
  }

  const db = await useDb();

  let sql = `
    SELECT 
      r.*,
      u.nombre as solicitante_nombre,
      u.email as solicitante_email,
      p.nombre as plantel_nombre,
      p.codigo as plantel_codigo
    FROM reimbursements r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
  `;

  const params: any[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  // Scope requesters to their own records
  if (user.role_name === 'ADMIN_PLANTEL') {
    conditions.push('r.user_id = ?');
    params.push(user.id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY r.created_at DESC LIMIT 200';

  const [rows] = await db.execute(sql, params);
  return rows;
});
