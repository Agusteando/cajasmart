import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

type Body = { endpoint?: string };

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<Body>(event);

  const db = await useDb();

  if (body?.endpoint) {
    await db.execute(
      `UPDATE push_subscriptions SET is_active = 0 WHERE user_id = ? AND endpoint = ?`,
      [user.id, body.endpoint]
    );
  } else {
    await db.execute(`UPDATE push_subscriptions SET is_active = 0 WHERE user_id = ?`, [user.id]);
  }

  return { success: true };
});
