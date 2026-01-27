export type SessionUser = {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;

  // --- Impersonation metadata (optional) ---
  is_impersonating?: boolean;
  impersonated_at?: string;

  impersonator_user_id?: number;
  impersonator_nombre?: string;
  impersonator_email?: string;
  impersonator_role_name?: string;
  impersonator_role_level?: number;
  impersonator_plantel_id?: number | null;
  impersonator_plantel_nombre?: string;
  impersonator_avatar?: string | null;
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

  if (typeof v === 'object') return isValidSessionUser(v) ? (v as SessionUser) : null;

  let s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return null;

  s = decodeMaybe(s);

  try {
    const parsed = JSON.parse(s);
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
