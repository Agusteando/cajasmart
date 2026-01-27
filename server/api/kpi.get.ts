import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const role = query.role ? String(query.role) : '';
  const plantelIdRaw = query.plantelId ? String(query.plantelId) : '';
  const plantelId = plantelIdRaw ? Number.parseInt(plantelIdRaw, 10) : NaN;

  const db = await useDb();

  // Scope for ADMIN_PLANTEL
  const scoped = role === 'ADMIN_PLANTEL' && Number.isFinite(plantelId);

  const whereSql = scoped ? 'WHERE r.plantel_id = ?' : '';
  const whereArgs = scoped ? [plantelId] : [];

  const [stats]: any = await db.execute(
    `
    SELECT 
      COUNT(*) as total_count,
      SUM(CASE WHEN r.status IN ('PROCESSED','APPROVED') THEN CAST(r.amount AS DECIMAL(12,2)) ELSE 0 END) as total_pagado,
      SUM(CASE WHEN r.status IN ('PENDING_OPS_REVIEW','PENDING_FISCAL_REVIEW') THEN CAST(r.amount AS DECIMAL(12,2)) ELSE 0 END) as total_pendiente,
      SUM(CASE WHEN r.status = 'RETURNED' THEN 1 ELSE 0 END) as total_rechazados
    FROM reimbursements r
    ${whereSql}
    `,
    whereArgs
  );

  let byPlantel: any[] = [];
  if (role !== 'ADMIN_PLANTEL') {
    const [rows]: any = await db.execute(
      `
      SELECT p.nombre, SUM(CAST(r.amount AS DECIMAL(12,2))) as total
      FROM reimbursements r
      JOIN planteles p ON r.plantel_id = p.id
      WHERE r.status = 'PROCESSED'
      GROUP BY p.nombre
      ORDER BY total DESC
      `
    );
    byPlantel = rows;
  }

  return {
    global: stats?.[0] || {},
    charts: byPlantel
  };
});
