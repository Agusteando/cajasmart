import { useDb } from '~/server/utils/db';
import { parseUserSession, getHomePageForRole, needsOnboarding } from '~/server/utils/auth';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

function normalize(s: string) {
  return (s || '').toLowerCase().trim();
}

export default defineEventHandler(async (event) => {
  const session = parseUserSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' });
  }

  const db = await useDb();

  // REAL user id (even if acting is impersonated)
  const realUserId =
    session.is_impersonating && session.impersonator_user_id
      ? Number(session.impersonator_user_id)
      : Number(session.id);

  // Authoritative REAL user snapshot from DB
  const [rows]: any = await db.execute(
    `SELECT 
       u.id, u.nombre, u.email, u.plantel_id, u.activo, u.avatar_url,
       p.nombre as plantel_nombre,
       r.nombre as role_name, r.nivel_permiso
     FROM users u
     LEFT JOIN planteles p ON u.plantel_id = p.id
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?
     LIMIT 1`,
    [realUserId]
  );

  const u = rows?.[0];
  if (!u) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' });
  }

  const realUser = {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    role_name: u.role_name,
    role_level: u.nivel_permiso,
    plantel_id: u.plantel_id || null,
    plantel_nombre: u.plantel_nombre || 'Sin Asignar',
    avatar: session.impersonator_avatar || u.avatar_url || session.avatar || null
  };

  // ACTING user: keep session fields if impersonating, otherwise real user
  const actingUser = session.is_impersonating
    ? {
        ...session,
        // keep identity stable; but refresh core identity fields if needed
        id: session.id,
        nombre: session.nombre || realUser.nombre,
        email: session.email || realUser.email,
        avatar: session.avatar || realUser.avatar || null
      }
    : realUser;

  // Keep cookie in sync:
  // - If not impersonating: set to realUser
  // - If impersonating: preserve actingUser but refresh impersonator_* from DB
  const cookieUser = session.is_impersonating
    ? {
        ...actingUser,
        is_impersonating: true,
        impersonated_at: session.impersonated_at || new Date().toISOString(),
        impersonator_user_id: realUser.id,
        impersonator_nombre: realUser.nombre,
        impersonator_email: realUser.email,
        impersonator_role_name: realUser.role_name,
        impersonator_role_level: realUser.role_level,
        impersonator_plantel_id: realUser.plantel_id,
        impersonator_plantel_nombre: realUser.plantel_nombre,
        impersonator_avatar: realUser.avatar || null
      }
    : realUser;

  setUserSessionCookie(event, cookieUser);

  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
  const hasValidRole = !!actingUser.role_name && validRoles.includes(actingUser.role_name);

  const isActive = Number(u.activo) === 1;

  // Always fetch planteles (for onboarding UX)
  const [pRows]: any = await db.execute(
    'SELECT id, nombre, codigo FROM planteles WHERE activo = 1 ORDER BY nombre ASC'
  );
  const planteles: any[] = pRows || [];

  // Suggested plantel (best-effort by email containing codigo)
  let suggestedPlantelId: number | null = null;
  let suggestedReason: string | null = null;

  const email = normalize(realUser.email);
  const matches = planteles
    .map((p) => ({ ...p, _code: normalize(p.codigo) }))
    .filter((p) => p._code && email.includes(p._code));

  if (matches.length === 1) {
    suggestedPlantelId = matches[0].id;
    suggestedReason = `Detectado por código "${matches[0].codigo}" en tu correo.`;
  } else if (matches.length > 1) {
    matches.sort((a, b) => (b._code.length || 0) - (a._code.length || 0));
    suggestedPlantelId = matches[0].id;
    suggestedReason = `Sugerido por coincidencia de código "${matches[0].codigo}" en tu correo.`;
  }

  // Latest access request (for UX state)
  const [requests]: any = await db.execute(
    'SELECT * FROM notifications WHERE type = "ACCESS_REQUEST" AND user_id = ? ORDER BY id DESC LIMIT 1',
    [realUser.id]
  );
  const pendingRequest = requests?.[0] || null;

  const needsPlantel = actingUser.role_name === 'ADMIN_PLANTEL' && !actingUser.plantel_id;

  const requiresOnboarding =
    !isActive ||
    !hasValidRole ||
    needsPlantel ||
    needsOnboarding(actingUser as any);

  return {
    user: actingUser,
    realUser: session.is_impersonating ? realUser : null,

    isActive,
    requiresOnboarding,
    hasValidRole,
    needsPlantel,
    pendingRequest,
    planteles,
    suggestedPlantelId,
    suggestedReason,
    homePage: getHomePageForRole(actingUser.role_name || '')
  };
});
