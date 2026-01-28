// server/api/qr-session/create.post.ts
import { requireAuth } from '~/server/utils/auth';
import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { createQrSession } from '~/server/utils/qrSessions';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);

  const s = createQrSession(user.id);
  const origin = getPublicOrigin(event);
  const scanUrl = `${origin}/qr/${s.token}`;

  return {
    token: s.token,
    scanUrl,
    expiresAt: new Date(s.expiresAt).toISOString()
  };
});
