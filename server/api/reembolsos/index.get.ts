import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

// Helper to map DB status to Frontend "ReembolsoEstado"
function mapStatus(s: string): string {
  switch (s) {
    case 'DRAFT': return 'borrador';
    case 'PENDING_OPS_REVIEW': return 'en_revision';
    case 'PENDING_FISCAL_REVIEW': return 'en_revision'; // UI simplifies this
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

  const db = await useDb();

  // 1. Build Query for Headers
  let sql = `
    SELECT 
      r.id,
      r.status,
      r.reimbursement_date,
      r.total_amount,
      r.rejection_reason,
      r.created_at,
      u.nombre as solicitante_nombre,
      p.nombre as plantel_nombre
    FROM reimbursements r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN planteles p ON r.plantel_id = p.id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  // Filter by role scope
  if (user.role_name === 'ADMIN_PLANTEL') {
    conditions.push('r.user_id = ?');
    params.push(user.id);
  }

  // Filter by status (frontend sends 'en_revision', 'aprobado', etc.)
  if (estadoFilter) {
    if (estadoFilter === 'borrador') conditions.push("r.status = 'DRAFT'");
    else if (estadoFilter === 'en_revision') conditions.push("r.status IN ('PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW')");
    else if (estadoFilter === 'aprobado') conditions.push("r.status = 'APPROVED'");
    else if (estadoFilter === 'rechazado') conditions.push("r.status = 'RETURNED'");
    else if (estadoFilter === 'pagado') conditions.push("r.status = 'PROCESSED'");
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY r.created_at DESC LIMIT 100';

  const [rows]: any = await db.execute(sql, params);
  if (!rows.length) return { items: [] };

  // 2. Fetch Items (Conceptos) for these headers
  const ids = rows.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  
  const [itemsRows]: any = await db.execute(
    `SELECT * FROM reimbursement_items WHERE reimbursement_id IN (${placeholders})`,
    ids
  );

  // Group items by reimbursement_id
  const itemsMap: Record<number, any[]> = {};
  for (const item of itemsRows) {
    if (!itemsMap[item.reimbursement_id]) itemsMap[item.reimbursement_id] = [];
    itemsMap[item.reimbursement_id].push(item);
  }

  // 3. Assemble response
  const results = rows.map((r: any) => {
    const myItems = itemsMap[r.id] || [];
    
    // Basic search filtering in memory if 'q' is present (simple implementation)
    // For robust search, we'd need more complex SQL joins/likes
    if (search) {
      const haystack = [
        r.id,
        r.plantel_nombre,
        r.solicitante_nombre,
        ...myItems.map((i: any) => `${i.provider} ${i.concept} ${i.invoice_number}`)
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return null;
    }

    // Map to frontend type
    return {
      id: String(r.id),
      folio: `R-${String(r.id).padStart(5, '0')}`,
      plantel: r.plantel_nombre,
      solicitante: r.solicitante_nombre,
      fechaISO: r.reimbursement_date || r.created_at,
      estado: mapStatus(r.status),
      total: Number(r.total_amount),
      notas: r.rejection_reason || null,
      file_url: myItems[0]?.file_url || null, // Take first file as main evidence
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