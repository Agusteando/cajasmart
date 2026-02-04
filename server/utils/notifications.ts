import { useDb } from './db';
import { sendPushToUser } from '~/server/utils/push';

export type NotificationInput = {
  userId: number;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: number | null;
  url?: string | null;
  actorUserId?: number | null;
};

export async function createNotification(input: NotificationInput) {
  try {
    const db = await useDb();

    const [res]: any = await db.execute(
      `
      INSERT INTO notifications
        (user_id, type, title, message, reference_type, reference_id, url, actor_user_id, is_read, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
      `,
      [
        input.userId,
        input.type,
        input.title,
        input.message,
        input.referenceType || null,
        input.referenceId || null,
        input.url || null,
        input.actorUserId || null
      ]
    );

    const id = Number(res?.insertId || 0);

    // Push (best-effort)
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.message,
      url: input.url || '/notificaciones',
      notificationId: id,
      type: input.type,
      referenceType: input.referenceType || undefined,
      referenceId: input.referenceId || undefined
    });

    return { id };
  } catch (e) {
    console.error('Failed to create notification:', e);
    return { id: 0 };
  }
}

export async function createNotificationsBulk(inputs: NotificationInput[]) {
  if (!inputs.length) return { inserted: 0 };

  const db = await useDb();

  const valuesSql: string[] = [];
  const params: any[] = [];

  for (const n of inputs) {
    valuesSql.push('(?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())');
    params.push(
      n.userId,
      n.type,
      n.title,
      n.message,
      n.referenceType || null,
      n.referenceId || null,
      n.url || null,
      n.actorUserId || null
    );
  }

  try {
    const [res]: any = await db.execute(
      `
      INSERT INTO notifications
        (user_id, type, title, message, reference_type, reference_id, url, actor_user_id, is_read, created_at)
      VALUES ${valuesSql.join(',')}
      `,
      params
    );

    // Push best-effort per user
    // In a high-scale app, we would queue this. For now, Promise.all is acceptable.
    const pushPromises = inputs.map(n => 
      sendPushToUser(n.userId, {
        title: n.title,
        body: n.message,
        url: n.url || '/notificaciones',
        type: n.type,
        referenceType: n.referenceType || undefined,
        referenceId: n.referenceId || undefined
      })
    );
    
    // Don't await push to not block the response time significantly, 
    // or await if critical. We'll await but catch errors internally in sendPushToUser.
    await Promise.allSettled(pushPromises);

    return { inserted: Number(res?.affectedRows || inputs.length) };
  } catch (e) {
    console.error('Failed bulk notifications:', e);
    return { inserted: 0 };
  }
}

/**
 * Role-targeted notifications: materialize per user.
 * - Only ACTIVE users.
 * - Filters out the actor (to avoid self-notification).
 * - Handles Plantel Scoping: If plantelId is provided, it targets users of that plantel OR global users (plantel_id IS NULL).
 */
export async function notifyRoleUsers(
  roleName: string,
  type: string,
  title: string,
  message: string,
  referenceType?: string,
  referenceId?: number,
  opts?: { url?: string; actorUserId?: number; plantelId?: number }
) {
  const db = await useDb();

  const params: any[] = [roleName];
  let plantelSql = '';

  // Improved Logic: If filtering by Plantel, include the specific plantel AND Global users (NULL)
  if (opts?.plantelId) {
    plantelSql = ' AND (u.plantel_id = ? OR u.plantel_id IS NULL) ';
    params.push(opts.plantelId);
  }

  const [rows]: any = await db.execute(
    `
    SELECT u.id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.nombre = ?
      AND u.activo = 1
    ${plantelSql}
    `,
    params
  );

  let userIds: number[] = (rows || [])
    .map((x: any) => Number(x.id))
    .filter((n: any) => Number.isFinite(n) && n > 0);

  // Filter out the actor to prevent self-notification
  if (opts?.actorUserId) {
    userIds = userIds.filter(id => id !== Number(opts.actorUserId));
  }

  if (!userIds.length) return { deliveredTo: 0 };

  const bulk: NotificationInput[] = userIds.map((userId) => ({
    userId,
    type,
    title,
    message,
    referenceType: referenceType || null,
    referenceId: referenceId || null,
    url: opts?.url || null,
    actorUserId: opts?.actorUserId || null
  }));

  await createNotificationsBulk(bulk);
  return { deliveredTo: userIds.length };
}