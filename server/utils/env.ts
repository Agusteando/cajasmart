import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let _loaded = false;
let _loadedFrom: string[] = [];

export function normalizeEnvValue(v: unknown): string {
  let s = String(v ?? '').trim();

  // Strip wrapping quotes: GOOGLE_CLIENT_ID="..." or '...'
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

/**
 * Convert user-provided DOTENV_PATH into an absolute filesystem path.
 * Supports:
 *  - absolute/relative paths
 *  - file: URLs (even relative ones like file:.env) by resolving against cwd
 */
function toFsPath(input: string, cwd: string) {
  const s = normalizeEnvValue(input);
  if (!s) return '';

  // file: URL support (and fix for "File URL path must be absolute")
  if (s.startsWith('file:')) {
    const base = pathToFileURL(cwd.endsWith(path.sep) ? cwd : cwd + path.sep);
    const url = new URL(s, base); // makes it absolute
    return fileURLToPath(url);
  }

  return path.isAbsolute(s) ? s : path.resolve(cwd, s);
}

function candidateDirs(cwd: string) {
  const dirs = [cwd];

  // If running from ".output/server" somehow, also check project root
  const norm = cwd.replace(/\\/g, '/');
  if (norm.endsWith('/.output/server')) dirs.push(path.resolve(cwd, '..', '..'));
  if (norm.endsWith('/.output')) dirs.push(path.resolve(cwd, '..'));

  // de-dupe
  return Array.from(new Set(dirs));
}

function buildCandidates(cwd: string) {
  const dirs = candidateDirs(cwd);

  const names = ['.env', '.env.local', '.env.production', '.env.production.local'];

  const candidates: string[] = [];

  // optional explicit override
  const raw = normalizeEnvValue(process.env.DOTENV_PATH);
  if (raw) candidates.push(toFsPath(raw, cwd));

  // common dotenv files in cwd / parent candidates
  for (const dir of dirs) {
    for (const n of names) candidates.push(path.resolve(dir, n));
  }

  // de-dupe + keep only absolute filesystem paths
  return Array.from(new Set(candidates)).filter((p) => !!p && path.isAbsolute(p));
}

export function ensureEnvLoaded() {
  if (_loaded) return { loaded: _loaded, loadedFrom: _loadedFrom };

  const cwd = process.cwd();
  _loadedFrom = [];

  try {
    const candidates = buildCandidates(cwd);

    for (const p of candidates) {
      if (existsSync(p)) {
        loadDotenv({ path: p, override: false });
        _loadedFrom.push(p);
      }
    }
  } catch (err: any) {
    // HARD GUARD: never crash Nitro on env loading
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'ERROR',
        msg: 'dotenv:load:failed',
        data: {
          message: err?.message,
          code: err?.code,
          cwd
        }
      })
    );
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
