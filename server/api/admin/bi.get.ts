import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  const q = getQuery(event);
  
  const monthStr = String(q.month || new Date().toISOString().slice(0, 7)); // YYYY-MM
  const plantelId = q.plantel_id ? Number(q.plantel_id) : null;

  const db = await useDb();

  // Base conditions
  const conditions = ["DATE_FORMAT(r.reimbursement_date, '%Y-%m') = ?"];
  const params: any[] = [monthStr];

  if (plantelId) {
    conditions.push("r.plantel_id = ?");
    params.push(plantelId);
  }

  const whereSql = conditions.join(' AND ');

  // 1. KPI Aggregates
  const [kpiRows]: any = await db.execute(`
    SELECT 
      COUNT(*) as total_count,
      SUM(total_amount) as total_money,
      AVG(DATEDIFF(IFNULL(r.processed_at, NOW()), r.created_at)) as avg_days,
      SUM(CASE WHEN r.status = 'PROCESSED' THEN total_amount ELSE 0 END) as paid_money,
      SUM(CASE WHEN r.status IN ('PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW') THEN total_amount ELSE 0 END) as pending_money,
      SUM(CASE WHEN r.is_deducible = 1 THEN total_amount ELSE 0 END) as deducible_money,
      SUM(CASE WHEN r.is_deducible = 0 THEN total_amount ELSE 0 END) as no_deducible_money
    FROM reimbursements r
    WHERE ${whereSql}
  `, params);

  // 2. Timeline / Gantt Data
  // FIX: Removed 'r.folio' from SQL as it doesn't exist. We generate it below.
  const [timelineRows]: any = await db.execute(`
    SELECT 
      r.id, r.status, r.total_amount, r.created_at, r.processed_at, r.updated_at, r.reimbursement_date,
      p.nombre as plantel_nombre,
      u.nombre as solicitante_nombre
    FROM reimbursements r
    LEFT JOIN planteles p ON r.plantel_id = p.id
    JOIN users u ON r.user_id = u.id
    WHERE ${whereSql}
    ORDER BY r.reimbursement_date DESC
  `, params);

  // Generate dynamic Folio
  const timeline = timelineRows.map((r: any) => ({
    ...r,
    folio: `R-${String(r.id).padStart(5, '0')}`
  }));

  // 3. Status Breakdown (Funnel)
  const [statusRows]: any = await db.execute(`
    SELECT status, COUNT(*) as c, SUM(total_amount) as m
    FROM reimbursements r
    WHERE ${whereSql}
    GROUP BY status
  `, params);

  // 4. Plantel Comparison (if global view)
  let plantelStats: any[] = [];
  if (!plantelId) {
    const [pRows]: any = await db.execute(`
      SELECT p.nombre, SUM(r.total_amount) as total, COUNT(*) as count
      FROM reimbursements r
      JOIN planteles p ON r.plantel_id = p.id
      WHERE ${whereSql}
      GROUP BY p.id, p.nombre
      ORDER BY total DESC
      LIMIT 10
    `, params);
    plantelStats = pRows;
  }

  return {
    kpi: kpiRows[0],
    timeline: timeline, // Return the processed array
    statusBreakdown: statusRows,
    plantelStats
  };
});