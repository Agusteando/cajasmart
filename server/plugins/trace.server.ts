import { getRequestURL } from 'h3';
import { log } from '~/server/utils/log';

export default defineNitroPlugin((nitroApp) => {
  const hooks = nitroApp?.hooks;
  if (!hooks || typeof hooks.hook !== 'function') return;

  hooks.hook('error', (error: any, ctx: any) => {
    const event = ctx?.event;
    if (!event) return;

    const url = getRequestURL(event);
    const path = url.pathname;

    const statusCode = error?.statusCode ?? error?.status ?? 0;
    const msg = String(error?.message || error || '');

    // ✅ Ignore chrome devtools well-known noise
    if (statusCode === 404 && path.startsWith('/.well-known/')) return;
    if (statusCode === 404 && msg.includes('Page not found') && path.startsWith('/.well-known/')) return;

    log(event, 'ERROR', 'nitro:error', {
      message: msg,
      statusCode,
      stack: error?.stack
    });
  });
});
