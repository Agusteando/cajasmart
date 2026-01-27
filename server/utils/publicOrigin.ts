import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

function firstHeaderValue(v: any): string {
  return String(v || '')
    .split(',')[0]
    .trim();
}

function isLocalHost(host: string) {
  const h = (host || '').toLowerCase();
  return (
    h.startsWith('localhost') ||
    h.startsWith('127.0.0.1') ||
    h.startsWith('[::1]') ||
    h.startsWith('::1')
  );
}

export function getPublicOrigin(event: H3Event): string {
  const cfg = useRuntimeConfig() as any;

  const xfHost =
    firstHeaderValue(getRequestHeader(event, 'x-forwarded-host')) ||
    firstHeaderValue(getRequestHeader(event, 'x-original-host')) ||
    firstHeaderValue(getRequestHeader(event, 'host')) ||
    'localhost';

  // If configured baseUrl exists, use it EXCEPT when request is clearly localhost
  const configured = String(cfg.baseUrl || '').trim().replace(/\/+$/, '');
  if (configured && !isLocalHost(xfHost)) return configured;

  const xfProto =
    firstHeaderValue(getRequestHeader(event, 'x-forwarded-proto')) ||
    firstHeaderValue(getRequestHeader(event, 'x-original-proto'));

  const isHttps =
    xfProto === 'https' ||
    Boolean(getRequestHeader(event, 'x-arr-ssl')) ||
    Boolean((event.node.req.socket as any)?.encrypted);

  return `${isHttps ? 'https' : 'http'}://${xfHost}`;
}
