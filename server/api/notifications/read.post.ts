import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

type Body = { id?: number; all?: boolean };

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<Body>(event);
  const db = await useDb();

  // Schema: is_read tinyint(1)
  if (body?.all) {
    await db.execute(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [user.id]
    );
    return { success: true };
  }

  const id = Number(body?.id || 0);
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  await db.execute(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
    [id, user.id]
  );

  return { success: true };
});