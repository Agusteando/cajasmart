import type { H3Event } from 'h3';
import { getRequestHeader, setCookie, deleteCookie } from 'h3';

function firstHeaderValue(v: any): string {
  return String(v || '').split(',')[0].trim();
}

function getReqHost(event: H3Event): string {
  return (
    firstHeaderValue(getRequestHeader(event, 'x-forwarded-host')) ||
    firstHeaderValue(getRequestHeader(event, 'x-original-host')) ||
    firstHeaderValue(getRequestHeader(event, 'host')) ||
    'localhost'
  );
}

function isLocalHost(host: string) {
  const h = (host || '').toLowerCase();
  return (
    h === 'localhost' ||
    h.startsWith('localhost:') ||
    h === '127.0.0.1' ||
    h.startsWith('127.0.0.1:') ||
    h === '[::1]' ||
    h.startsWith('[::1]:') ||
    h === '::1'
  );
}

function isHttps(event: H3Event): boolean {
  const xfProto = firstHeaderValue(getRequestHeader(event, 'x-forwarded-proto'));
  const xOrigProto = firstHeaderValue(getRequestHeader(event, 'x-original-proto'));

  return (
    xfProto === 'https' ||
    xOrigProto === 'https' ||
    Boolean(getRequestHeader(event, 'x-arr-ssl')) ||
    Boolean((event.node.req.socket as any)?.encrypted)
  );
}

export function setUserSessionCookie(event: H3Event, sessionUser: any) {
  const host = getReqHost(event);
  const secure = isLocalHost(host) ? false : isHttps(event);

  setCookie(event, 'user', JSON.stringify(sessionUser), {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return { host, secure };
}

export function clearUserSessionCookie(event: H3Event) {
  deleteCookie(event, 'user', { path: '/' });
}
