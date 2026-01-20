import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export default defineNitroPlugin(() => {
  // Load .env from the PM2 cwd (or project root) and log what happened (no secret values)
  const cwd = process.cwd();
  const envPath = path.resolve(cwd, '.env');

  const exists = fs.existsSync(envPath);

  if (!exists) {
    console.warn(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'WARN',
        message: '.env not found',
        data: { cwd, envPath }
      })
    );
    return;
  }

  const result = dotenv.config({ path: envPath });

  const loadedKeys = result?.parsed ? Object.keys(result.parsed) : [];
  const hasGoogle = loadedKeys.includes('GOOGLE_CLIENT_ID') && loadedKeys.includes('GOOGLE_CLIENT_SECRET');

  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: result?.error ? 'ERROR' : 'INFO',
      message: 'dotenv loaded',
      data: {
        cwd,
        envPath,
        ok: !result?.error,
        loadedKeyCount: loadedKeys.length,
        hasGoogle,
        hasBaseUrl: loadedKeys.includes('BASE_URL'),
        hasDb: loadedKeys.includes('DB_HOST') && loadedKeys.includes('DB_USER') && loadedKeys.includes('DB_NAME')
      }
    })
  );

  if (result?.error) {
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'ERROR',
        message: 'dotenv error',
        data: { message: result.error.message }
      })
    );
  }
});
