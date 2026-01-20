import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

export function getPublicOrigin(event: H3Event): string {
  const xfProto = String(getRequestHeader(event, 'x-forwarded-proto') || '')
    .split(',')[0]
    .trim();

  const host =
    (getRequestHeader(event, 'x-forwarded-host') ||
      getRequestHeader(event, 'host') ||
      'localhost').toString().trim();

  const isHttps =
    xfProto === 'https' ||
    Boolean(getRequestHeader(event, 'x-arr-ssl')) ||
    Boolean((event.node.req.socket as any)?.encrypted);

  return `${isHttps ? 'https' : 'http'}://${host}`;
}
