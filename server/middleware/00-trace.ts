import { getRequestURL } from 'h3';
import { getReqId, log, logHeaders } from '~/server/utils/log';

function shouldSkip(path: string) {
  return (
    path.startsWith('/_nuxt/') ||
    path === '/favicon.ico' ||
    path === '/robots.txt' ||
    path.startsWith('/uploads/')
  );
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const path = url.pathname;

  if (shouldSkip(path)) return;

  // Start timer once
  (event.context as any)._t0 ??= Date.now();

  // Ensure request id is available early
  getReqId(event);

  // Log request start + headers
  log(event, 'INFO', 'request:start');
  logHeaders(event);

  // Avoid attaching finish listener more than once
  if ((event.context as any)._traceFinishAttached) return;
  (event.context as any)._traceFinishAttached = true;

  event.node.res.once('finish', () => {
    const t0 = (event.context as any)._t0 || Date.now();
    log(event, 'INFO', 'request:end', {
      status: event.node.res.statusCode,
      ms: Date.now() - t0
    });
  });
});
