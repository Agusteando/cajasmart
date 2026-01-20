import type { H3Event } from 'h3';

export function htmlRedirect(event: H3Event, url: string) {
  event.node.res.statusCode = 200;
  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  event.node.res.end(
    `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(
      url
    )})</script>`
  );
}
