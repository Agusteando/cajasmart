import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

type Body = { id?: number; all?: boolean };

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<Body>(event);
  const db = await useDb();

  if (body?.all) {
    await db.execute(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
      [user.id]
    );
    return { success: true };
  }

  const id = Number(body?.id || 0);
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  await db.execute(
    `UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?`,
    [id, user.id]
  );

  return { success: true };
});
