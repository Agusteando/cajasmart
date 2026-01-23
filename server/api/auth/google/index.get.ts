import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { ensureEnvLoaded, normalizeEnvValue, maskMid } from '~/server/utils/env';
import { log, logEnvSnapshot, logStep } from '~/server/utils/log';

export default defineEventHandler((event) => {
  ensureEnvLoaded();
  logStep(event, 'index:hit');

  const cfg = useRuntimeConfig() as any;

  const cfgId = normalizeEnvValue(cfg.googleClientId);
  const envId = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);

  // IMPORTANT: use || (NOT ??) so empty string falls back to env
  const googleClientId = cfgId || envId;

  log(event, 'DEBUG', 'google:index clientId source', {
    cfgId: cfgId ? maskMid(cfgId) : null,
    envId: envId ? maskMid(envId) : null,
    picked: googleClientId ? maskMid(googleClientId) : null,
    pickedFrom: cfgId ? 'runtimeConfig' : (envId ? 'process.env' : 'none')
  });

  if (!googleClientId) {
    log(event, 'ERROR', 'google:index missing GOOGLE_CLIENT_ID');
    logEnvSnapshot(event);
    return htmlRedirect(event, '/login?error=server_error');
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  logStep(event, 'index:computed', { baseUrl, redirectUri });

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

  const fullUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs}`;
  return htmlRedirect(event, fullUrl);
});
