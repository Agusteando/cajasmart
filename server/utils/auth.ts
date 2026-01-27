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
}

// 2. Helper to safely parse the cookie JSON
function safeParseSession(cookieValue: string): SessionUser | null {
  try {
    // Decode if URI encoded (common in cookies)
    const decoded = decodeURIComponent(cookieValue);
    // Handle potential double encoding or raw JSON
    const jsonStr = decoded.startsWith('%') ? decodeURIComponent(decoded) : decoded;
    
    const user = JSON.parse(jsonStr);
    
    // Basic validation
    if (!user || typeof user !== 'object' || !user.id || !user.email) {
      return null;
    }
    
    return user as SessionUser;
  } catch (e) {
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

/**
 * Require specific roles - throws 403 if role doesn't match
 */
export function requireRole(event: H3Event, allowedRoles: string[]): SessionUser {
  const user = requireAuth(event);
  
  // Super Admin always passes
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
  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
  
  // 1. Invalid or missing role
  if (!user.role_name || !validRoles.includes(user.role_name)) {
    return true;
  }
  
  // 2. Requester without Plantel
  if (user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id) {
    return true;
  }
  
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
    case 'SUPER_ADMIN':
      return '/'; // Admin sees the KPI dashboard at /
    default:
      return '/onboarding';
  }
}