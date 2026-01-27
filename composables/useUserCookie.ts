export type SessionUser = {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;
};

function isValidSessionUser(v: any): v is SessionUser {
  return (
    v &&
    typeof v === 'object' &&
    Number.isFinite(Number(v.id)) &&
    typeof v.email === 'string' &&
    v.email.length > 3 &&
    typeof v.role_name === 'string' &&
    v.role_name.length > 0
  );
}

function decodeMaybe(s: string): string {
  let cur = s;
  for (let i = 0; i < 2; i++) {
    try {
      const dec = decodeURIComponent(cur);
      if (dec === cur) break;
      cur = dec;
    } catch {
      break;
    }
  }
  return cur;
}

function safeParseCookieValue(v: unknown): SessionUser | null {
  if (v == null) return null;

  // already an object (Nuxt default cookie parsing sometimes does this)
  if (typeof v === 'object') return isValidSessionUser(v) ? (v as SessionUser) : null;

  let s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return null;

  s = decodeMaybe(s);

  try {
    const parsed = JSON.parse(s);
    // handle double-stringified cookies: "\"{...}\""
    if (typeof parsed === 'string') return safeParseCookieValue(parsed);
    return isValidSessionUser(parsed) ? (parsed as SessionUser) : null;
  } catch {
    return null;
  }
}

export function useUserCookie() {
  /**
   * IMPORTANT:
   * - Do NOT override serialize. Nuxt uses "null" to delete cookies correctly.
   * - We only harden deserialize to handle encoded/double-encoded/double-stringified values.
   */
  return useCookie<SessionUser | null>('user', {
    default: () => null,
    deserialize: (v) => safeParseCookieValue(v)
  });
}
