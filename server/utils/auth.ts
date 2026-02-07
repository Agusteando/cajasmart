import type { H3Event } from 'h3';
import { getCookie, createError } from 'h3';

// 1. Define Types
export interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;

  // Impersonation metadata (optional)
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
}

// 2. Helper to safely parse the cookie JSON
function safeParseSession(cookieValue: string): SessionUser | null {
  try {
    const decoded = decodeURIComponent(cookieValue);
    const jsonStr = decoded.startsWith('%') ? decodeURIComponent(decoded) : decoded;

    const user = JSON.parse(jsonStr);

    if (!user || typeof user !== 'object' || !user.id || !user.email) {
      return null;
    }

    return user as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Parse the user session from the cookie (Safe & Robust)
 */
export function parseUserSession(event: H3Event): SessionUser | null {
  const cookieValue = getCookie(event, 'user');
  if (!cookieValue) return null;
  return safeParseSession(cookieValue);
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export function requireAuth(event: H3Event): SessionUser {
  const user = parseUserSession(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sesión expirada. Inicie sesión nuevamente.'
    });
  }

  return user;
}

export function isImpersonating(user: SessionUser | null): boolean {
  return Boolean(user?.is_impersonating && user?.impersonator_user_id);
}

/**
 * Build the "real" user from impersonation metadata (or return the same user if not impersonating)
 */
export function getRealUserFromSession(user: SessionUser): SessionUser {
  if (!isImpersonating(user)) return user;

  return {
    id: Number(user.impersonator_user_id),
    nombre: String(user.impersonator_nombre || ''),
    email: String(user.impersonator_email || ''),
    role_name: String(user.impersonator_role_name || ''),
    role_level: Number(user.impersonator_role_level || 0),
    plantel_id:
      user.impersonator_plantel_id == null ? null : Number(user.impersonator_plantel_id),
    plantel_nombre: String(user.impersonator_plantel_nombre || 'Sin Asignar'),
    avatar: user.impersonator_avatar || null
  };
}

/**
 * Require SUPER_ADMIN based on the REAL user (works even while impersonating)
 */
export function requireSuperAdminReal(event: H3Event): SessionUser {
  const session = requireAuth(event);
  const real = getRealUserFromSession(session);

  if (real.role_name !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tiene permisos para realizar esta acción.'
    });
  }

  return real;
}

/**
 * Require specific roles - throws 403 if role doesn't match (uses ACTING role)
 */
export function requireRole(event: H3Event, allowedRoles: string[]): SessionUser {
  const user = requireAuth(event);

  // Super Admin always passes (acting role)
  if (user.role_name === 'SUPER_ADMIN') {
    return user;
  }

  if (!allowedRoles.includes(user.role_name)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tiene permisos para realizar esta acción.'
    });
  }

  return user;
}

/**
 * Logic: Does this user need onboarding?
 */
export function needsOnboarding(user: SessionUser): boolean {
  // RH removed from valid list conceptually, but kept for legacy safety until migration is 100% complete
  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'RH', 'SUPER_ADMIN'];

  if (!user.role_name || !validRoles.includes(user.role_name)) return true;

  if (user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id) return true;

  return false;
}

/**
 * Logic: Where should this user go after login?
 */
export function getHomePageForRole(roleName: string): string {
  switch (roleName) {
    case 'ADMIN_PLANTEL':
      return '/reembolsos';
    case 'REVISOR_OPS':
      return '/ops';
    case 'REVISOR_FISCAL':
      return '/fiscal';
    case 'TESORERIA':
      return '/tesoreria';
    case 'RH':
      // Redirect legacy RH users to Tesoreria
      return '/tesoreria';
    case 'SUPER_ADMIN':
      return '/';
    default:
      return '/onboarding';
  }
}