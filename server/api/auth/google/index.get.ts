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

  console.log('[google:index] redirectUri =', redirectUri);

  const qs = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')
  }).toString();

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs}`;

  // HTML redirect avoids IIS Location header issues
  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  event.node.res.end(
    `<!doctype html><script>location.replace(${JSON.stringify(authUrl)})</script>`
  );
});
