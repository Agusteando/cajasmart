import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { log, logEnvSnapshot } from '~/server/utils/log';

export default defineEventHandler((event) => {
  log(event, 'INFO', 'google:index:hit');
  logEnvSnapshot(event);

  const config = useRuntimeConfig();
  const googleClientId = (config.googleClientId || process.env.GOOGLE_CLIENT_ID || '').toString().trim();

  if (!googleClientId) {
    log(event, 'ERROR', 'google:index:missing_client_id');
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
    return;
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  log(event, 'DEBUG', 'google:index:computed', {
    baseUrl,
    redirectUri
  });

  const qs = new URLSearchParams({
    redirect_uri: redirectUri,
    client_id: googleClientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')
  }).toString();

  const fullUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs}`;

  // Avoid IIS/ARR rewriting Location
  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  event.node.res.end(`<!doctype html><script>location.replace(${JSON.stringify(fullUrl)})</script>`);
});
