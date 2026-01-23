import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let _loaded = false;
let _loadedFrom: string[] = [];

export function normalizeEnvValue(v: unknown): string {
  let s = String(v ?? '').trim();

  // Strip wrapping quotes: KEY="..." or '...'
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
 * Convert something like:
 *  - ".env" / "C:\\...\\.env" -> absolute fs path
 *  - "file:///C:/.../.env" -> fs path
 *  - "file:.env" (BAD url) -> treat as ".env" path (no fileURLToPath call)
 */
function toFsPath(input: string, cwd: string): string {
  let s = normalizeEnvValue(input);
  if (!s) return '';

  // Handle file: URLs safely.
  if (s.startsWith('file:')) {
    // Only attempt fileURLToPath when it is a real absolute file URL.
    // file:.env is NOT absolute and will throw on Windows -> treat as path.
    if (s.startsWith('file:///') || s.startsWith('file://localhost/')) {
      try {
        return fileURLToPath(new URL(s));
      } catch {
        // fall through to treating as path
      }
    }

    // Treat "file:.env" or other weird forms as a normal path
    s = s.slice('file:'.length);
    s = s.replace(/^\/+/, ''); // avoid "///" becoming UNC-ish
  }

  return path.isAbsolute(s) ? s : path.resolve(cwd, s);
}

function walkUpDirs(start: string, maxLevels = 6) {
  const dirs: string[] = [];
  let cur = start;

  for (let i = 0; i < maxLevels; i++) {
    dirs.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // de-dupe
  return Array.from(new Set(dirs));
}

function buildCandidates(cwd: string) {
  const names = ['.env', '.env.local', '.env.production', '.env.production.local'];

  // Look in cwd and parent dirs (covers cases where pm2 runs in .output/server)
  const dirs = walkUpDirs(cwd, 7);

  const candidates: string[] = [];

  // Optional override, but never crash if it is weird
  const raw = normalizeEnvValue(process.env.DOTENV_PATH);
  if (raw) candidates.push(toFsPath(raw, cwd));

  for (const dir of dirs) {
    for (const n of names) candidates.push(path.resolve(dir, n));
  }

  // Keep only absolute paths, de-dupe
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
