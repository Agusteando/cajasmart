import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let _loaded = false;
let _loadedFrom: string[] = [];

export function normalizeEnvValue(v: unknown): string {
  let s = String(v ?? '').trim();

  // strip wrapping quotes if present
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function maskMid(value: string, head = 6, tail = 6) {
  const s = normalizeEnvValue(value);
  if (!s) return '';
  if (s.length <= head + tail) return `${s.slice(0, 2)}***${s.slice(-2)}`;
  return `${s.slice(0, head)}***${s.slice(-tail)}`;
}

export function ensureEnvLoaded() {
  if (_loaded) return { loaded: _loaded, loadedFrom: _loadedFrom };

  const cwd = process.cwd();
  const candidates = [
    process.env.DOTENV_PATH ? resolve(process.env.DOTENV_PATH) : null,
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
  const id = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
  const secret = normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET);

  return {
    cwd: process.cwd(),
    loadedFrom: _loadedFrom,
    GOOGLE_CLIENT_ID_present: !!id,
    GOOGLE_CLIENT_SECRET_present: !!secret,
    GOOGLE_CLIENT_ID_masked: maskMid(id),
    GOOGLE_CLIENT_SECRET_masked: secret ? `***${secret.slice(-6)}` : ''
  };
}
