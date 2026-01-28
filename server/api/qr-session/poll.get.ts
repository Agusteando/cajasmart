// server/api/qr-session/poll.get.ts
import { requireAuth } from '~/server/utils/auth';
import { getQrSession, deleteQrSession } from '~/server/utils/qrSessions';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const q = getQuery(event);

  const token = String(q.token || '').trim();
  if (!token) throw createError({ statusCode: 400, statusMessage: 'token requerido' });

  const s = getQrSession(token);
  if (!s) return { status: 'EXPIRED' };

  if (Number(s.userId) !== Number(user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' });
  }

  if (s.payload) {
    // One-shot consume
    const payload = s.payload;
    deleteQrSession(token);
    return { status: 'READY', payload };
  }

  return { status: 'PENDING', expiresAt: new Date(s.expiresAt).toISOString() };
});
