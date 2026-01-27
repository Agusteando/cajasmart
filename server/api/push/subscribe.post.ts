import { requireAuth } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

type SubscriptionBody = {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  deviceName?: string;
  userAgent?: string;
};

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const body = await readBody<SubscriptionBody>(event);

  if (!body?.subscription?.endpoint || !body?.subscription?.keys?.p256dh || !body?.subscription?.keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid subscription' });
  }

  const db = await useDb();
  const endpoint = body.subscription.endpoint;

  // Upsert by endpoint
  await db.execute(
    `
    INSERT INTO push_subscriptions
      (user_id, endpoint, p256dh, auth, user_agent, device_name, is_active, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      p256dh = VALUES(p256dh),
      auth = VALUES(auth),
      user_agent = VALUES(user_agent),
      device_name = VALUES(device_name),
      is_active = 1,
      updated_at = NOW()
    `,
    [
      user.id,
      endpoint,
      body.subscription.keys.p256dh,
      body.subscription.keys.auth,
      body.userAgent || getHeader(event, 'user-agent') || null,
      body.deviceName || null
    ]
  );

  return { success: true };
});
