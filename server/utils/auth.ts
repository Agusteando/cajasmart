import type { H3Event } from 'h3';
import { getCookie, createError } from 'h3';

export interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;
}

function validateUser(user: any): SessionUser | null {
  if (!user || typeof user !== 'object') return null;
  if (!user.id || !user.email) return null;
  return user as SessionUser;
}

/**
 * Parse the user session from the cookie
 * Returns null if no valid session exists
 */
export function parseUserSession(event: H3Event): SessionUser | null {
  const cookieValue = getCookie(event, 'user');
  
  if (!cookieValue) {
    return null;
  }

  try {
    // Strategy 1: Try parsing directly (in case H3 already decoded it)
    try {
      return validateUser(JSON.parse(cookieValue));
    } catch {
      // Strategy 2: Decode URI component then parse
      const decoded = decodeURIComponent(cookieValue);
      return validateUser(JSON.parse(decoded));
    }
  } catch (e) {
    // If both fail, cookie is invalid/corrupted
    return null;
  }
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export function requireAuth(event: H3Event): SessionUser {
  const user = parseUserSession(event);
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sesión expirada o inválida. Por favor inicie sesión nuevamente.'
    });
  }
  
  return user;
}

/**
 * Require specific roles - throws 403 if role doesn't match
 */
export function requireRole(event: H3Event, allowedRoles: string[]): SessionUser {
  const user = requireAuth(event);
  
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
 * Check if user needs onboarding actions
 */
export function needsOnboarding(user: SessionUser): boolean {
  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
  
  if (!user.role_name || !validRoles.includes(user.role_name)) {
    return true;
  }
  
  if (user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id) {
    return true;
  }
  
  return false;
}

/**
 * Get the appropriate home page redirect based on role
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
    case 'SUPER_ADMIN':
      return '/';
    default:
      return '/onboarding';
  }
}