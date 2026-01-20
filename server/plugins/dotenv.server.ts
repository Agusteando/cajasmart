import 'dotenv/config';

export default defineNitroPlugin(() => {
  // No secrets printed. This tells you if .env is being read at runtime and from what cwd.
  console.log('[env] cwd=', process.cwd());
  console.log('[env] has GOOGLE_CLIENT_ID=', !!process.env.GOOGLE_CLIENT_ID);
  console.log('[env] has GOOGLE_CLIENT_SECRET=', !!process.env.GOOGLE_CLIENT_SECRET);
  console.log('[env] has BASE_URL=', !!process.env.BASE_URL);
});
