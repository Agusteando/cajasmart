import { ensureEnvLoaded, envDebugSnapshot } from '~/server/utils/env';

export default defineNitroPlugin(() => {
  const r = ensureEnvLoaded();
  const s = envDebugSnapshot();

  console.log('[env] cwd=', s.cwd);
  console.log('[env] dotenv loaded from=', s.loadedFrom.length ? s.loadedFrom.join(', ') : '(none)');
  console.log('[env] searchedCount=', s.searchedCount, 'searchedPreview=', s.searchedPreview);
  console.log('[env] GOOGLE_CLIENT_ID present=', s.GOOGLE_CLIENT_ID_present, s.GOOGLE_CLIENT_ID_masked);
  console.log('[env] GOOGLE_CLIENT_SECRET present=', s.GOOGLE_CLIENT_SECRET_present, s.GOOGLE_CLIENT_SECRET_masked);

  // extra: if nothing loaded, show how to fix quickly
  if (!r.loadedFrom.length) {
    console.warn('[env] No .env files were found. In production, set env vars in PM2 or set DOTENV_PATH.');
  }
});
