import { getRequestURL } from 'h3';
import { log, logHeaders } from '~/server/utils/log';

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const path = url.pathname;

  // Skip noisy assets
  if (
    path.startsWith('/_nuxt/') ||
    path === '/favicon.ico' ||
    path === '/robots.txt' ||
    path.startsWith('/uploads/')
  ) {
    return;
  }

  const start = Date.now();
  log(event, 'INFO', 'request:start');
  logHeaders(event);

  try {
    // let the next handler run
    await event.$fetch?.();
  } catch {
    // ignore, error handler will log
  } finally {
    log(event, 'INFO', 'request:end', { ms: Date.now() - start });
  }
});
