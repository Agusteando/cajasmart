import { parseUserSession } from '~/server/utils/auth';
import { getRequestHeader } from 'h3';

export default defineEventHandler((event) => {
  return {
    user: parseUserSession(event),
    cookieHeader: String(getRequestHeader(event, 'cookie') || ''),
    host: String(getRequestHeader(event, 'host') || ''),
    xfHost: String(getRequestHeader(event, 'x-forwarded-host') || ''),
    xfProto: String(getRequestHeader(event, 'x-forwarded-proto') || '')
  };
});
