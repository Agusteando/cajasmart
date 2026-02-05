import { useDb } from '~/server/utils/db';
import { requireSuperAdminReal } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  requireSuperAdminReal(event);
  const q = getQuery(event);
  
  // Default to current month
  const now = new Date();
  const monthStr = String(q.month || now.toISOString().slice(0, 7)); // YYYY-MM
  
  // Calculate Month Boundaries for Timeline Math
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  const totalDaysInMonth = endDate.getDate();

  const db = await useDb();

  // Fetch ALL items that overlap with this month
  // Logic: Created before end of month AND (Processed after start of month OR Not processed yet)
  const [rows]: any = await db.execute(`
    SELECT 
      r.id, r.status, r.total_amount, r.created_at, r.processed_at, r.reimbursement_date,
      r.is_deducible,
      p.id as plantel_id, p.nombre as plantel_nombre, p.codigo as plantel_codigo,
      u.nombre as solicitante_nombre
    FROM reimbursements r
    LEFT JOIN planteles p ON r.plantel_id = p.id
    JOIN users u ON r.user_id = u.id
    WHERE 
      r.created_at <= ? 
      AND (r.processed_at >= ? OR r.processed_at IS NULL)
    ORDER BY p.nombre ASC, r.created_at ASC
  `, [
    new Date(year, month, 1).toISOString(), // End of target month (approx, purely distinct overlap logic usually handled in JS for precision)
    startDate.toISOString()
  ]);
  // Note: SQL overlap logic can be tricky, fetching a bit wider range is safer, filtering in JS below.

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
    
    // Determine "End" point for the bar
    let end = r.processed_at ? new Date(r.processed_at) : new Date(); // If pending, it "ends" today (continues lagging)
    
    // Clamp to view window (The selected month)
    // If it started before this month, visually it starts at day 1 (0%)
    // If it ends after this month, visually it ends at day 30 (100%)
    
    const viewStart = startDate.getTime();
    const viewEnd = endDate.getTime();
    const itemStart = created.getTime();
    const itemEnd = end.getTime();

    // Skip if completely out of range (double check)
    if (itemEnd < viewStart || itemStart > viewEnd) continue;

    // Calculate visual percentages (0 to 100)
    const startPct = Math.max(0, ((itemStart - viewStart) / (viewEnd - viewStart)) * 100);
    let endPct = Math.min(100, ((itemEnd - viewStart) / (viewEnd - viewStart)) * 100);
    
    // Ensure minimum visibility width (1%)
    if (endPct - startPct < 1) endPct = startPct + 1;

    // Calculate Lag Days (Real duration)
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

  // Convert map to array
  const swimlanes = Object.values(matrix);

  return {
    monthStr,
    totalDaysInMonth,
    swimlanes
  };
});