import { requireAuth, isImpersonating, getRealUserFromSession } from '~/server/utils/auth';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

export default defineEventHandler(async (event) => {
  const session = requireAuth(event);

  if (!isImpersonating(session)) {
    return { success: true, user: session };
  }

  const real = getRealUserFromSession(session);

  // clear impersonation fields by rebuilding a clean session
  const cleanUser = {
    id: real.id,
    nombre: real.nombre,
    email: real.email,
    role_name: real.role_name,
    role_level: real.role_level,
    plantel_id: real.plantel_id,
    plantel_nombre: real.plantel_nombre,
    avatar: real.avatar || null
  };

  setUserSessionCookie(event, cleanUser);

  return { success: true, user: cleanUser };
});
