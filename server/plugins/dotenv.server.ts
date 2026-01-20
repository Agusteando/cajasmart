import 'dotenv/config';

export default defineNitroPlugin(() => {
  // Minimal runtime proof (no secrets)
  console.log('[env] cwd=', process.cwd());
  console.log('[env] GOOGLE_CLIENT_ID present=', !!process.env.GOOGLE_CLIENT_ID);
  console.log('[env] GOOGLE_CLIENT_SECRET present=', !!process.env.GOOGLE_CLIENT_SECRET);
});
