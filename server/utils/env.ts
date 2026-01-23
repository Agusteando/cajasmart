import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let _loaded = false;
let _loadedFrom: string[] = [];

export function ensureEnvLoaded() {
  if (_loaded) return { loaded: _loaded, loadedFrom: _loadedFrom };

  const cwd = process.cwd();

  const candidates = [
    process.env.DOTENV_PATH ? resolve(process.env.DOTENV_PATH) : null,

    // common dotenv conventions
    resolve(cwd, '.env'),
    resolve(cwd, '.env.local'),
    resolve(cwd, '.env.production'),
    resolve(cwd, '.env.production.local')
  ].filter(Boolean) as string[];

  _loadedFrom = [];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p, override: false });
      _loadedFrom.push(p);
    }
  }

  _loaded = true;
  return { loaded: _loaded, loadedFrom: _loadedFrom };
}

export function envDebugSnapshot() {
  return {
    cwd: process.cwd(),
    loadedFrom: _loadedFrom,
    GOOGLE_CLIENT_ID_present: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET_present: !!process.env.GOOGLE_CLIENT_SECRET
  };
}
