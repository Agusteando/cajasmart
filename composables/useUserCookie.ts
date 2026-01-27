type SessionUser = {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;
};

function safeParse(v: string): SessionUser | null {
  const s = String(v || '').trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  try {
    return JSON.parse(s) as SessionUser;
  } catch {
    return null;
  }
}

export function useUserCookie() {
  return useCookie<SessionUser | null>('user', {
    default: () => null,
    deserialize: (v) => safeParse(v),
    serialize: (v) => JSON.stringify(v ?? null)
  });
}
