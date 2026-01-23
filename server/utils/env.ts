import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let _loaded = false;
let _loadedFrom: string[] = [];
let _searched: string[] = [];

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

function buildCandidates(): string[] {
  const candidates: string[] = [];

  // 1) Explicit override
  const dotenvPath = normalizeEnvValue(process.env.DOTENV_PATH);
  if (dotenvPath) candidates.push(resolve(dotenvPath));

  // 2) From current working directory
  const cwd = process.cwd();
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    candidates.push(resolve(cwd, name));
  }

  // 3) From this file location (works even when running from .output/server)
  // Walk up several parents, looking for .env files
  const here = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i <= 6; i++) {
    const up = resolve(here, ...Array(i).fill('..'));
    for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
      candidates.push(resolve(up, name));
    }
  }

  // de-dupe
  return Array.from(new Set(candidates));
}

export function ensureEnvLoaded() {
  if (_loaded) return { loaded: _loaded, loadedFrom: _loadedFrom, searched: _searched };

  const candidates = buildCandidates();
  _searched = candidates;
  _loadedFrom = [];

  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p, override: false });
      _loadedFrom.push(p);
    }
  }

  _loaded = true;
  return { loaded: _loaded, loadedFrom: _loadedFrom, searched: _searched };
}

export function envDebugSnapshot() {
  const id = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
  const secret = normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET);

  return {
    cwd: process.cwd(),
    loadedFrom: _loadedFrom,
    searchedCount: _searched.length,
    searchedPreview: _searched.slice(0, 8), // keep logs short
    GOOGLE_CLIENT_ID_present: !!id,
    GOOGLE_CLIENT_SECRET_present: !!secret,
    GOOGLE_CLIENT_ID_masked: maskMid(id),
    GOOGLE_CLIENT_SECRET_masked: secret ? `***${secret.slice(-6)}` : ''
  };
}
