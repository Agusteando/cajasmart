import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId;
  const role = query.role; // 'SUPER_ADMIN', 'ADMIN_PLANTEL', etc.
  const plantelId = query.plantelId;

  const db = await useDb();
  let whereClause = "";

  // Scope Data: If user is strictly local (Admin Plantel), limit data
  if (role === 'ADMIN_PLANTEL') {
    whereClause = `WHERE plantel_id = ${plantelId}`;
  }

  // KPI 1: Totals by Status
  const [stats] = await db.execute(`
    SELECT 
      COUNT(*) as total_count,
      SUM(CASE WHEN estatus = 'PAGADO' THEN amount ELSE 0 END) as total_pagado,
      SUM(CASE WHEN estatus IN ('REVISION_OPS', 'REVISION_FISCAL') THEN amount ELSE 0 END) as total_pendiente,
      COUNT(CASE WHEN estatus = 'RECHAZADO' THEN 1 END) as total_rechazados
    FROM solicitudes ${whereClause}
  `);

  // KPI 2: Spending by Plantel (For Global Viewers)
  let byPlantel = [];
  if (role !== 'ADMIN_PLANTEL') {
    const [rows] = await db.execute(`
      SELECT p.nombre, SUM(s.monto) as total 
      FROM solicitudes s 
      JOIN planteles p ON s.plantel_id = p.id 
      WHERE s.estatus = 'PAGADO' 
      GROUP BY p.nombre
    `);
    byPlantel = rows;
  }

  await db.end();
  return { 
    global: stats[0], 
    charts: byPlantel 
  };
});