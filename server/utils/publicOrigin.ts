import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

export function getPublicOrigin(event: H3Event): string {
  const config = useRuntimeConfig();
  const cfg = (config.baseUrl || '').toString().trim();
  if (cfg) return cfg.replace(/\/+$/, '');

  const xfProtoRaw = getRequestHeader(event, 'x-forwarded-proto') || '';
  const xfProto = xfProtoRaw.split(',')[0]?.trim();

  const host =
    (getRequestHeader(event, 'x-forwarded-host') ||
      getRequestHeader(event, 'host') ||
      'localhost').toString().trim();

  const arrSsl = getRequestHeader(event, 'x-arr-ssl');
  const socketEncrypted = (event.node.req.socket as any)?.encrypted;

  const proto = xfProto || (arrSsl ? 'https' : '') || (socketEncrypted ? 'https' : 'http') || 'http';
  return `${proto}://${host}`.replace(/\/+$/, '');
}
