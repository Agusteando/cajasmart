import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

function mapStatus(s: string): string {
  switch (s) {
    case 'DRAFT': return 'borrador';
    case 'PENDING_OPS_REVIEW': return 'en_revision';
    case 'PENDING_FISCAL_REVIEW': return 'en_revision';
    case 'RETURNED': return 'rechazado';
    case 'APPROVED': return 'aprobado';
    case 'PROCESSED': return 'pagado';
    default: return 'borrador';
  }
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const q = getQuery(event);
  
  const search = String(q.q || '').trim().toLowerCase();
  const estadoFilter = String(q.estado || '').trim();
  const rawStatusFilter = String(q.status || '').trim(); // For Ops/Fiscal specific queries
  
  // New Filters for RH
  const monthFilter = String(q.month || '').trim(); // YYYY-MM
  const archivedFilter = q.archived; // 'true', 'false', or undefined

  const db = await useDb();

  let sql = `
    SELECT 
      r.id, r.status, r.reimbursement_date, r.total_amount, r.rejection_reason, 
      r.created_at, r.archived_at, r.is_deducible,
      u.nombre as solicitante_nombre,
      p.nombre as plantel_nombre
    FROM reimbursements r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  // 1. Role Scoping
  if (user.role_name === 'ADMIN_PLANTEL') {
    conditions.push('r.user_id = ?');
    params.push(user.id);
  }

  // 2. Status Mapping Filter (Frontend friendly)
  if (estadoFilter) {
    if (estadoFilter === 'borrador') conditions.push("r.status = 'DRAFT'");
    else if (estadoFilter === 'en_revision') conditions.push("r.status IN ('PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW')");
    else if (estadoFilter === 'aprobado') conditions.push("r.status = 'APPROVED'");
    else if (estadoFilter === 'rechazado') conditions.push("r.status = 'RETURNED'");
    else if (estadoFilter === 'pagado') conditions.push("r.status = 'PROCESSED'");
  }

  // 3. Raw Status Filter (Backend specific)
  if (rawStatusFilter) {
    conditions.push('r.status = ?');
    params.push(rawStatusFilter);
  }

  // 4. Month Filter (YYYY-MM)
  if (monthFilter) {
    conditions.push("DATE_FORMAT(r.reimbursement_date, '%Y-%m') = ?");
    params.push(monthFilter);
  }

  // 5. Archived/Printed Filter (For RH)
  if (archivedFilter === 'true') {
    conditions.push('r.archived_at IS NOT NULL');
  } else if (archivedFilter === 'false') {
    conditions.push('r.archived_at IS NULL');
  }

  // 6. Text Search
  if (search) {
    conditions.push(`(
      r.id LIKE ? OR 
      u.nombre LIKE ? OR 
      p.nombre LIKE ?
    )`);
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  
  sql += ' ORDER BY r.reimbursement_date DESC, r.created_at DESC LIMIT 300';

  const [rows]: any = await db.execute(sql, params);
  if (!rows.length) return { items: [] };

  // Fetch Items for the result set
  const ids = rows.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const [itemsRows]: any = await db.execute(
    `SELECT * FROM reimbursement_items WHERE reimbursement_id IN (${placeholders})`, ids
  );

  const itemsMap: Record<number, any[]> = {};
  for (const item of itemsRows) {
    if (!itemsMap[item.reimbursement_id]) itemsMap[item.reimbursement_id] = [];
    itemsMap[item.reimbursement_id].push(item);
  }

  const results = rows.map((r: any) => {
    const myItems = itemsMap[r.id] || [];
    
    // In-memory search for items details (provider, concept)
    if (search) {
      const haystack = [
        r.id, 
        r.plantel_nombre, 
        r.solicitante_nombre,
        ...myItems.map((i: any) => `${i.provider} ${i.concept} ${i.invoice_number} ${i.description}`)
      ].join(' ').toLowerCase();
      
      if (!haystack.includes(search)) return null;
    }

    return {
      id: String(r.id),
      folio: `R-${String(r.id).padStart(5, '0')}`,
      plantel: r.plantel_nombre,
      solicitante: r.solicitante_nombre,
      fechaISO: r.reimbursement_date || r.created_at,
      estado: mapStatus(r.status),
      total: Number(r.total_amount),
      is_deducible: !!r.is_deducible,
      notas: r.rejection_reason || null,
      archived_at: r.archived_at,
      file_url: myItems[0]?.file_url || null,
      conceptos: myItems.map((i: any) => ({
        id: String(i.id),
        invoice_date: i.invoice_date,
        invoice_number: i.invoice_number,
        provider: i.provider,
        concept: i.concept,
        description: i.description,
        amount: Number(i.amount)
      }))
    };
  }).filter(Boolean);

  return { items: results };
});