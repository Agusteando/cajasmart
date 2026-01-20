import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const role = query.role ? String(query.role) : '';
  const plantelIdRaw = query.plantelId ? String(query.plantelId) : '';
  const plantelId = plantelIdRaw ? Number.parseInt(plantelIdRaw, 10) : NaN;

  const db = await useDb();

  // Scope for ADMIN_PLANTEL
  const scoped = role === 'ADMIN_PLANTEL' && Number.isFinite(plantelId);

  const whereSql = scoped ? 'WHERE plantel_id = ?' : '';
  const whereArgs = scoped ? [plantelId] : [];

  const [stats]: any = await db.execute(
    `
    SELECT 
      COUNT(*) as total_count,
      SUM(CASE WHEN estatus = 'PAGADO' THEN monto ELSE 0 END) as total_pagado,
      SUM(CASE WHEN estatus IN ('REVISION_OPS', 'REVISION_FISCAL') THEN monto ELSE 0 END) as total_pendiente,
      SUM(CASE WHEN estatus = 'RECHAZADO' THEN 1 ELSE 0 END) as total_rechazados
    FROM solicitudes
    ${whereSql}
  `,
    whereArgs
  );

  let byPlantel: any[] = [];
  if (role !== 'ADMIN_PLANTEL') {
    const [rows]: any = await db.execute(
      `
      SELECT p.nombre, SUM(s.monto) as total
      FROM solicitudes s
      JOIN planteles p ON s.plantel_id = p.id
      WHERE s.estatus = 'PAGADO'
      GROUP BY p.nombre
    `
    );
    byPlantel = rows;
  }

  return {
    global: stats?.[0] || {},
    charts: byPlantel
  };
});
