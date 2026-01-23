import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

function firstHeaderValue(v: any): string {
  return String(v || '')
    .split(',')[0]
    .trim();
}

export function getPublicOrigin(event: H3Event): string {
  const cfg = useRuntimeConfig() as any;

  // If BASE_URL/runtimeConfig.baseUrl is set, always use it (best practice behind proxies)
  const configured = String(cfg.baseUrl || '').trim();
  if (configured) {
    // normalize: remove trailing slash
    return configured.replace(/\/+$/, '');
  }

  const xfProto =
    firstHeaderValue(getRequestHeader(event, 'x-forwarded-proto')) ||
    firstHeaderValue(getRequestHeader(event, 'x-original-proto'));

  const xfHost =
    firstHeaderValue(getRequestHeader(event, 'x-forwarded-host')) ||
    firstHeaderValue(getRequestHeader(event, 'x-original-host')) ||
    firstHeaderValue(getRequestHeader(event, 'host')) ||
    'localhost';

  const isHttps =
    xfProto === 'https' ||
    Boolean(getRequestHeader(event, 'x-arr-ssl')) ||
    Boolean((event.node.req.socket as any)?.encrypted);

  return `${isHttps ? 'https' : 'http'}://${xfHost}`;
}
