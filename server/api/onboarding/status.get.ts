import { useDb } from '~/server/utils/db';
import { parseUserSession, getHomePageForRole, needsOnboarding } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = parseUserSession(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' });
  }

  const db = await useDb();

  // Check if role is valid (not GUEST or null)
  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
  const hasValidRole = user.role_name && validRoles.includes(user.role_name);
  
  // Check for any pending access request to show status in UI
  const [requests]: any = await db.execute(
    'SELECT * FROM notifications WHERE type = "ACCESS_REQUEST" AND user_id = ? ORDER BY id DESC LIMIT 1',
    [user.id]
  );
  
  const pendingRequest = requests[0] || null;

  // If user is ADMIN_PLANTEL but has no Plantel ID, fetch list for selection
  let planteles = [];
  if (user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id) {
    const [pRows]: any = await db.execute('SELECT id, nombre, codigo FROM planteles WHERE activo = 1 ORDER BY nombre ASC');
    planteles = pRows;
  }

  return {
    user,
    requiresOnboarding: needsOnboarding(user),
    hasValidRole,
    needsPlantel: user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id,
    pendingRequest,
    planteles,
    homePage: getHomePageForRole(user.role_name || '')
  };
});