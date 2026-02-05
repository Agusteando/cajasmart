import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  // Define counts object
  const counts = {
    ops: 0,
    fiscal: 0,
    treasury: 0,
    my_drafts: 0,
    my_returned: 0
  };

  // 1. Get functional queue counts (For Admins/Reviewers)
  const [queueRows]: any = await db.execute(`
    SELECT status, COUNT(*) as c 
    FROM reimbursements 
    WHERE status IN ('PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW', 'APPROVED')
    GROUP BY status
  `);

  for (const row of queueRows) {
    if (row.status === 'PENDING_OPS_REVIEW') counts.ops = Number(row.c);
    if (row.status === 'PENDING_FISCAL_REVIEW') counts.fiscal = Number(row.c);
    if (row.status === 'APPROVED') counts.treasury = Number(row.c); // Approved = Pending Payment
  }

  // 2. Get personal counts (For Requesters)
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