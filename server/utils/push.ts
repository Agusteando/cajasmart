import webpush from 'web-push';
import { useDb } from '~/server/utils/db';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  notificationId?: number;
  type?: string;
  referenceType?: string;
  referenceId?: number;
};

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const config = useRuntimeConfig();
  const subject = config.vapidSubject;
  const publicKey = config.vapidPublicKey;
  const privateKey = config.vapidPrivateKey;

  // If not configured, in-app notifications still work; push is skipped.
  if (!subject || !publicKey || !privateKey) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushToUser(userId: number, payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;

  const db = await useDb();
  const [rows]: any = await db.execute(
    `
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ? AND is_active = 1
    `,
    [userId]
  );

  const subs = rows || [];
  if (!subs.length) return;

  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        } as any,
        body
      );
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status;
      if (statusCode === 404 || statusCode === 410) {
        await db.execute(`UPDATE push_subscriptions SET is_active = 0 WHERE id = ?`, [sub.id]);
      }
      console.error('Push send error:', statusCode, err?.message || err);
    }
  }
}
