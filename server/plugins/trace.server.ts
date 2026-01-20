import { getRequestHeader, getRequestURL } from 'h3';
import { randomUUID } from 'node:crypto';

export default defineNitroPlugin((nitroApp: any) => {
  // HARD GUARD: do not crash server if hooks API is missing/undefined
  const hooks = nitroApp?.hooks;
  if (!hooks || typeof hooks.hook !== 'function') {
    console.warn('[trace] nitroApp.hooks is not available; tracing disabled (no crash)');
    return;
  }

  hooks.hook('request', (event: any) => {
    const url = getRequestURL(event);
    const path = url.pathname;

    // skip noisy assets
    if (
      path.startsWith('/_nuxt/') ||
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path.startsWith('/uploads/')
    ) return;

    const reqId =
      String(getRequestHeader(event, 'x-request-id') || '').trim() || randomUUID();

    event.context.reqId = reqId;
    event.node.res.setHeader('x-request-id', reqId);
    event.context._t0 = Date.now();

    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'INFO',
        reqId,
        msg: 'request:start',
        method: event.node.req.method,
        path: url.pathname + url.search,
        host: getRequestHeader(event, 'host'),
        xfProto: getRequestHeader(event, 'x-forwarded-proto'),
        arrSsl: !!getRequestHeader(event, 'x-arr-ssl')
      })
    );
  });

  hooks.hook('afterResponse', (event: any) => {
    const reqId = event.context.reqId;
    const t0 = event.context._t0;
    if (!reqId || !t0) return;

    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'INFO',
        reqId,
        msg: 'request:end',
        status: event.node.res.statusCode,
        ms: Date.now() - t0
      })
    );
  });

  hooks.hook('error', (error: any, event: any) => {
    if (!event) return;
    const reqId = event.context?.reqId;

    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'ERROR',
        reqId,
        msg: 'nitro:error',
        message: error?.message,
        stack: error?.stack
      })
    );
  });
});
