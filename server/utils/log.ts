import type { H3Event } from 'h3';
import { getRequestHeader, getRequestURL } from 'h3';
import { randomUUID } from 'node:crypto';

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

function mask(value: any) {
  if (value == null) return value;
  const s = String(value);
  if (s.length <= 8) return '***';
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

export function getReqId(event: H3Event) {
  const existing = (event.context as any).reqId;
  if (existing) return existing;

  const headerId = getRequestHeader(event, 'x-request-id');
  const id = (headerId && String(headerId).trim()) || randomUUID();
  (event.context as any).reqId = id;

  // helpful when debugging through proxies
  event.node.res.setHeader('x-request-id', id);
  return id;
}

export function log(event: H3Event, level: Level, message: string, data?: Record<string, any>) {
  const reqId = getReqId(event);
  const url = getRequestURL(event);
  const method = event.node.req.method;

  const payload = {
    t: new Date().toISOString(),
    level,
    reqId,
    method,
    path: url.pathname + url.search,
    message,
    ...(data ? { data } : {})
  };

  // Use console so PM2/IIS captures stdout/stderr reliably
  if (level === 'ERROR') console.error(JSON.stringify(payload));
  else if (level === 'WARN') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export function logHeaders(event: H3Event, label = 'headers') {
  const h = {
    host: getRequestHeader(event, 'host'),
    'x-forwarded-host': getRequestHeader(event, 'x-forwarded-host'),
    'x-forwarded-proto': getRequestHeader(event, 'x-forwarded-proto'),
    'x-arr-ssl': getRequestHeader(event, 'x-arr-ssl'),
    'x-original-url': getRequestHeader(event, 'x-original-url'),
    referer: getRequestHeader(event, 'referer'),
    origin: getRequestHeader(event, 'origin'),
    'user-agent': getRequestHeader(event, 'user-agent')
  };

  log(event, 'DEBUG', label, h as any);
}

export function logEnvSnapshot(event: H3Event) {
  const cfg = useRuntimeConfig();
  log(event, 'DEBUG', 'env snapshot', {
    NODE_ENV: process.env.NODE_ENV,
    BASE_URL_cfg: cfg.baseUrl || null,
    BASE_URL_env: process.env.BASE_URL || null,
    GOOGLE_CLIENT_ID_cfg: mask(cfg.googleClientId),
    GOOGLE_CLIENT_ID_env: mask(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET_cfg: mask(cfg.googleClientSecret),
    GOOGLE_CLIENT_SECRET_env: mask(process.env.GOOGLE_CLIENT_SECRET)
  });
}
