import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const q = getQuery(event);

  const limit = Math.min(Number(q.limit || 50), 200);
  const offset = Math.max(Number(q.offset || 0), 0);
  const unreadOnly = String(q.unread || '') === '1';

  const db = await useDb();

  const params: any[] = [user.id];
  let where = 'WHERE user_id = ?';

  if (unreadOnly) where += ' AND read_at IS NULL';

  const [rows]: any = await db.execute(
    `
    SELECT *
    FROM notifications
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return rows || [];
});
