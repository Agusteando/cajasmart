import { getPublicOrigin } from '~/server/utils/publicOrigin';

export default defineEventHandler((event) => {
  console.log('[google:index] hit');

  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.error('[google:index] GOOGLE_CLIENT_ID missing');
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
    return;
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  console.log('[google:index] baseUrl=', baseUrl);
  console.log('[google:index] redirectUri=', redirectUri);

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

  // HTML redirect to avoid IIS/ARR rewriting Location headers
  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  event.node.res.end(`<!doctype html><script>location.replace(${JSON.stringify(fullUrl)})</script>`);
});
