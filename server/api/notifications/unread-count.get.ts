import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = await useDb();

  const [rows]: any = await db.execute(
    `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [user.id]
  );

  return { unread: Number(rows?.[0]?.c || 0) };
});
