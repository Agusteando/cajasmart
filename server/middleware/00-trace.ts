import { getRequestURL } from 'h3';
import { log, logHeaders, getReqId } from '~/server/utils/log';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const url = getRequestURL(event);
    const path = url.pathname;

    if (
      path.startsWith('/_nuxt/') ||
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path.startsWith('/uploads/')
    ) return;

    (event.context as any)._t0 = Date.now();
    getReqId(event);
    log(event, 'INFO', 'request:start');
    logHeaders(event);
  });

  nitroApp.hooks.hook('afterResponse', (event) => {
    const url = getRequestURL(event);
    const path = url.pathname;

    if (
      path.startsWith('/_nuxt/') ||
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path.startsWith('/uploads/')
    ) return;

    const t0 = (event.context as any)._t0 || Date.now();
    log(event, 'INFO', 'request:end', { ms: Date.now() - t0 });
  });

  nitroApp.hooks.hook('error', (error, event) => {
    if (!event) return;
    log(event, 'ERROR', 'nitro:error', {
      message: (error as any)?.message,
      stack: (error as any)?.stack
    });
  });
});
