import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { ensureEnvLoaded } from '~/server/utils/env';
import { log, logEnvSnapshot } from '~/server/utils/log';

export default defineEventHandler((event) => {
  ensureEnvLoaded();

  log(event, 'INFO', 'google:index');

  const cfg = useRuntimeConfig() as any;

  const googleClientId =
    cfg.googleClientId ||
    process.env.GOOGLE_CLIENT_ID ||
    '';

  if (!googleClientId) {
    log(event, 'ERROR', 'google:index missing GOOGLE_CLIENT_ID');
    logEnvSnapshot(event);
    return htmlRedirect(event, '/login?error=server_error');
  }

  const baseUrl = getPublicOrigin(event);
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

  // HTML redirect avoids IIS/ARR issues with Location headers
  return htmlRedirect(event, fullUrl);
});
