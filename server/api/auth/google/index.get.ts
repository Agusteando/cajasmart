import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { log, logEnvSnapshot } from '~/server/utils/log';
import { ensureEnvLoaded, normalizeEnvValue, envDebugSnapshot } from '~/server/utils/env';

export default defineEventHandler((event) => {
  ensureEnvLoaded();

  const cfg = useRuntimeConfig() as any;

  const googleClientId = normalizeEnvValue(cfg.googleClientId ?? process.env.GOOGLE_CLIENT_ID);

  if (!googleClientId) {
    log(event, 'ERROR', 'google:index missing GOOGLE_CLIENT_ID');
    logEnvSnapshot(event);
    log(event, 'DEBUG', 'env loader snapshot', envDebugSnapshot() as any);
    return htmlRedirect(event, '/login?error=oauth_client');
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
      'https://www.googleapis.com/auth/userinfo.email',
      'openid'
    ].join(' ')
  }).toString();

  return htmlRedirect(event, `https://accounts.google.com/o/oauth2/v2/auth?${qs}`);
});
