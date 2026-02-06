import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const q = getQuery(event);
  
  // Default to current month
  const now = new Date();
  const monthStr = String(q.month || now.toISOString().slice(0, 7)); // YYYY-MM
  
  // Calculate Month Boundaries
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); 
  const totalDaysInMonth = endDate.getDate();

  const db = await useDb();

  // Filter based on role + assignments
  let whereSql = `r.created_at <= ? AND (r.processed_at >= ? OR r.processed_at IS NULL)`;
  const whereParams: any[] = [
    new Date(year, month, 1).toISOString(), 
    startDate.toISOString()
  ];

  if (user.role_name !== 'SUPER_ADMIN') {
    whereSql += ` AND r.plantel_id IN (SELECT plantel_id FROM user_planteles WHERE user_id = ?)`;
    whereParams.push(user.id);
  }

  // Fetch ALL items that overlap with this month
  const [rows]: any = await db.execute(`
    SELECT 
      r.id, r.status, r.total_amount, r.created_at, r.processed_at, r.reimbursement_date,
      r.is_deducible,
      p.id as plantel_id, p.nombre as plantel_nombre, p.codigo as plantel_codigo,
      u.nombre as solicitante_nombre
    FROM reimbursements r
    LEFT JOIN planteles p ON r.plantel_id = p.id
    JOIN users u ON r.user_id = u.id
    WHERE ${whereSql}
    ORDER BY p.nombre ASC, r.created_at ASC
  `, whereParams);

  // Group by Plantel
  const matrix: Record<string, any> = {};

  for (const r of rows) {
    const pId = r.plantel_id || 0;
    const pName = r.plantel_nombre || 'Sin Plantel';

    if (!matrix[pId]) {
      matrix[pId] = {
        id: pId,
        name: pName,
        items: []
      };
    }

    // --- Timeline Math ---
    const created = new Date(r.created_at);
    let end = r.processed_at ? new Date(r.processed_at) : new Date(); 
    
    const viewStart = startDate.getTime();
    const viewEnd = endDate.getTime();
    const itemStart = created.getTime();
    const itemEnd = end.getTime();

    if (itemEnd < viewStart || itemStart > viewEnd) continue;

    const startPct = Math.max(0, ((itemStart - viewStart) / (viewEnd - viewStart)) * 100);
    let endPct = Math.min(100, ((itemEnd - viewStart) / (viewEnd - viewStart)) * 100);
    if (endPct - startPct < 1) endPct = startPct + 1;

    const diffTime = Math.abs(itemEnd - itemStart);
    const lagDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    matrix[pId].items.push({
      id: r.id,
      folio: `R-${String(r.id).padStart(5, '0')}`,
      status: r.status,
      amount: r.total_amount,
      solicitante: r.solicitante_nombre,
      is_deducible: !!r.is_deducible,
      startPct,
      widthPct: endPct - startPct,
      lagDays,
      dateStr: created.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    });
  }

  return {
    monthStr,
    totalDaysInMonth,
    swimlanes: Object.values(matrix)
  };
});