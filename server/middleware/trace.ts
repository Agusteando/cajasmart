import { getRequestHeader, getRequestURL } from 'h3';
import { randomUUID } from 'node:crypto';

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const path = url.pathname;

  // skip noise
  if (
    path.startsWith('/_nuxt/') ||
    path === '/favicon.ico' ||
    path === '/robots.txt' ||
    path.startsWith('/uploads/')
  ) return;

  const reqId =
    String(getRequestHeader(event, 'x-request-id') || '').trim() || randomUUID();

  event.node.res.setHeader('x-request-id', reqId);

  const start = Date.now();
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

  event.node.res.on('finish', () => {
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'INFO',
        reqId,
        msg: 'request:end',
        status: event.node.res.statusCode,
        ms: Date.now() - start
      })
    );
  });
});
