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

    // FIX: Removed 'url' and 'actor_user_id' from SQL to prevent DB errors
    // The link is still sent via Push Notification below.
    const [res]: any = await db.execute(
      `
      INSERT INTO notifications
        (user_id, type, title, message, reference_type, reference_id, is_read, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, 0, NOW())
      `,
      [
        input.userId,
        input.type,
        input.title,
        input.message,
        input.referenceType || null,
        input.referenceId || null
      ]
    );

    const id = Number(res?.insertId || 0);

    // Push (best-effort) - URL is still sent here!
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
    // FIX: Removed 'url' and 'actor_user_id' from SQL
    valuesSql.push('(?, ?, ?, ?, ?, ?, 0, NOW())');
    params.push(
      n.userId,
      n.type,
      n.title,
      n.message,
      n.referenceType || null,
      n.referenceId || null
    );
  }

  try {
    const [res]: any = await db.execute(
      `
      INSERT INTO notifications
        (user_id, type, title, message, reference_type, reference_id, is_read, created_at)
      VALUES ${valuesSql.join(',')}
      `,
      params
    );

    // Push best-effort per user
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
    
    await Promise.allSettled(pushPromises);

    return { inserted: Number(res?.affectedRows || inputs.length) };
  } catch (e) {
    console.error('Failed bulk notifications:', e);
    return { inserted: 0 };
  }
}

/**
 * Role-targeted notifications: materialize per user.
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