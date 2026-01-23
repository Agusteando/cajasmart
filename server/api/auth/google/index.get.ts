import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { ensureEnvLoaded, normalizeEnvValue, maskMid } from '~/server/utils/env';
import { log, logEnvSnapshot, logStep } from '~/server/utils/log';

export default defineEventHandler((event) => {
  ensureEnvLoaded();
  logStep(event, 'index:hit');

  const cfg = useRuntimeConfig() as any;

  const googleClientId = normalizeEnvValue(cfg.googleClientId ?? process.env.GOOGLE_CLIENT_ID);

  if (!googleClientId) {
    log(event, 'ERROR', 'google:index missing GOOGLE_CLIENT_ID');
    logEnvSnapshot(event);
    return htmlRedirect(event, '/login?error=server_error');
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  logStep(event, 'index:computed', {
    baseUrl,
    redirectUri,
    clientId: maskMid(googleClientId)
  });

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
