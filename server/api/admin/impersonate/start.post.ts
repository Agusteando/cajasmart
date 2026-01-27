import { useDb } from '~/server/utils/db';
import { requireAuth, requireSuperAdminReal, getRealUserFromSession } from '~/server/utils/auth';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

export default defineEventHandler(async (event) => {
  // Must be REAL super admin
  requireSuperAdminReal(event);

  const session = requireAuth(event);
  const real = getRealUserFromSession(session);

  const body = await readBody<{
    roleName?: string;
    plantelId?: number | null;
  }>(event);

  const roleName = String(body?.roleName || '').trim();
  if (!roleName) {
    throw createError({ statusCode: 400, statusMessage: 'roleName requerido' });
  }

  const plantelId =
    body?.plantelId == null ? null : Number(body.plantelId);

  const db = await useDb();

  // Validate role exists
  const [rRows]: any = await db.execute(
    `SELECT nombre, nivel_permiso FROM roles WHERE nombre = ? LIMIT 1`,
    [roleName]
  );
  const role = rRows?.[0];
  if (!role) {
    throw createError({ statusCode: 400, statusMessage: `Rol inválido: ${roleName}` });
  }

  // Plantel resolution (only if provided)
  let plantelNombre = 'Corporativo Global';
  let plantelIdFinal: number | null = null;

  if (plantelId != null) {
    if (!Number.isFinite(plantelId) || plantelId <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'plantelId inválido' });
    }
    const [pRows]: any = await db.execute(
      `SELECT id, nombre FROM planteles WHERE id = ? LIMIT 1`,
      [plantelId]
    );
    const p = pRows?.[0];
    if (!p) {
      throw createError({ statusCode: 400, statusMessage: 'Plantel no encontrado' });
    }
    plantelIdFinal = Number(p.id);
    plantelNombre = String(p.nombre);
  }

  // For ADMIN_PLANTEL, plantel is usually required (to avoid onboarding redirect)
  if (roleName === 'ADMIN_PLANTEL' && !plantelIdFinal) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Para ADMIN_PLANTEL se requiere plantelId'
    });
  }

  const actingUser = {
    // keep identity, change role/plantel
    id: real.id,
    nombre: real.nombre,
    email: real.email,
    avatar: real.avatar || null,

    role_name: role.nombre,
    role_level: Number(role.nivel_permiso),

    plantel_id: plantelIdFinal,
    plantel_nombre: plantelIdFinal ? plantelNombre : 'Corporativo Global',

    // impersonation metadata
    is_impersonating: true,
    impersonated_at: new Date().toISOString(),

    impersonator_user_id: real.id,
    impersonator_nombre: real.nombre,
    impersonator_email: real.email,
    impersonator_role_name: real.role_name,
    impersonator_role_level: real.role_level,
    impersonator_plantel_id: real.plantel_id,
    impersonator_plantel_nombre: real.plantel_nombre,
    impersonator_avatar: real.avatar || null
  };

  setUserSessionCookie(event, actingUser);

  return { success: true, user: actingUser };
});
