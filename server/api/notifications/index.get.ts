import { getQuery } from 'h3';
import { useDb } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

function toInt(val: unknown, fallback: number) {
  const n = typeof val === 'string' ? Number.parseInt(val, 10) : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const q = getQuery(event);

  const limit = clampInt(toInt(q.limit, 20), 1, 100);

  let offset = toInt(q.offset, -1);
  if (offset < 0) {
    const page = clampInt(toInt(q.page, 1), 1, 1_000_000);
    offset = (page - 1) * limit;
  }
  offset = Math.max(0, offset);

  const unread =
    String(q.unread || '').toLowerCase() === '1' ||
    String(q.unread || '').toLowerCase() === 'true';

  const db = await useDb();

  // Filter empty titles to avoid ghost rows
  const whereParts: string[] = [
    'user_id = ?',
    'title IS NOT NULL',
    "title != ''"
  ];
  const params: any[] = [user.id];

  // Schema: is_read tinyint(1)
  if (unread) whereParts.push('is_read = 0');

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows]: any = await db.execute(
    `SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const sql = `
    SELECT *
    FROM notifications
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rows]: any = await db.execute(sql, params);

  return {
    success: true,
    notifications: rows || [],
    pagination: {
      limit,
      offset,
      total
    }
  };
});