import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler((event) => {
  const user = requireAuth(event);
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    role_name: user.role_name,
    role_level: user.role_level,
    plantel_id: user.plantel_id,
    plantel_nombre: user.plantel_nombre,
    avatar: user.avatar || null
  };
});
