import { ensureEnvLoaded, envDebugSnapshot } from '~/server/utils/env';

export default defineNitroPlugin(() => {
  // Never crash Nitro if dotenv fails
  ensureEnvLoaded();

  const s = envDebugSnapshot();
  console.log('[env] cwd=', s.cwd);
  console.log('[env] dotenv loaded from=', s.loadedFrom.length ? s.loadedFrom.join(', ') : '(none)');
  console.log('[env] GOOGLE_CLIENT_ID present=', s.GOOGLE_CLIENT_ID_present, s.GOOGLE_CLIENT_ID_masked);
  console.log('[env] GOOGLE_CLIENT_SECRET present=', s.GOOGLE_CLIENT_SECRET_present, s.GOOGLE_CLIENT_SECRET_masked);
});
