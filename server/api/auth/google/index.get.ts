import { getRequestURL } from 'h3';

export default defineEventHandler((event) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const baseUrl = process.env.BASE_URL || getRequestURL(event).origin;

  if (!googleClientId) {
    // Don’t expose internals; show login error
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
    return;
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

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

  // IMPORTANT: avoid 302 Location header (IIS/ARR often rewrites it)
  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  event.node.res.end(`<!doctype html><script>location.replace(${JSON.stringify(fullUrl)})</script>`);
});
