import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  
  try {
    const db = await useDb();

    // Schema: is_read tinyint(1)
    const [rows]: any = await db.execute(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0`,
      [user.id]
    );

    return { unread: Number(rows?.[0]?.c || 0) };
  } catch (e) {
    // Suppress DB connection errors during polling to prevent 502 spam in browser console
    // Return 0 so UI continues working
    console.error('Notification poll error:', e);
    return { unread: 0 };
  }
});