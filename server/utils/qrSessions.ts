// server/utils/qrSessions.ts
import { randomUUID } from 'node:crypto';

type Session = {
  token: string;
  userId: number;
  createdAt: number;
  expiresAt: number;
  payload?: any;
};

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const store = new Map<string, Session>();

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function createQrSession(userId: number) {
  cleanup();
  const token = randomUUID();
  const now = Date.now();
  const s: Session = {
    token,
    userId,
    createdAt: now,
    expiresAt: now + TTL_MS
  };
  store.set(token, s);
  return s;
}

export function getQrSession(token: string) {
  cleanup();
  return store.get(token) || null;
}

export function setQrSessionPayload(token: string, payload: any) {
  cleanup();
  const s = store.get(token);
  if (!s) return false;
  s.payload = payload;
  store.set(token, s);
  return true;
}

export function deleteQrSession(token: string) {
  store.delete(token);
}
