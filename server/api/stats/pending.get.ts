import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  const counts = {
    ops: 0,
    fiscal: 0,
    treasury: 0,
    my_drafts: 0,
    my_returned: 0
  };

  // Determine filtering SQL based on role
  let filterSql = '';
  const filterParams: any[] = [];

  if (user.role_name !== 'SUPER_ADMIN') {
    // If not super admin, restrict to assigned planteles
    filterSql = ` AND plantel_id IN (SELECT plantel_id FROM user_planteles WHERE user_id = ?)`;
    filterParams.push(user.id);
  }

  // 1. Get functional queue counts (For Admins/Reviewers)
  const [queueRows]: any = await db.execute(`
    SELECT status, COUNT(*) as c 
    FROM reimbursements 
    WHERE status IN ('PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW', 'APPROVED')
    ${filterSql}
    GROUP BY status
  `, filterParams);

  for (const row of queueRows) {
    if (row.status === 'PENDING_OPS_REVIEW') counts.ops = Number(row.c);
    if (row.status === 'PENDING_FISCAL_REVIEW') counts.fiscal = Number(row.c);
    if (row.status === 'APPROVED') counts.treasury = Number(row.c); 
  }

  // 2. Get personal counts (For Requesters - purely based on user_id)
  const [myRows]: any = await db.execute(`
    SELECT status, COUNT(*) as c
    FROM reimbursements
    WHERE user_id = ? AND status IN ('DRAFT', 'RETURNED')
    GROUP BY status
  `, [user.id]);

  for (const row of myRows) {
    if (row.status === 'DRAFT') counts.my_drafts = Number(row.c);
    if (row.status === 'RETURNED') counts.my_returned = Number(row.c);
  }

  return counts;
});