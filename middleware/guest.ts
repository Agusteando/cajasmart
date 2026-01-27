export default defineNuxtRouteMiddleware(() => {
  const user = useUserCookie().value;

  // If logged in, send to onboarding (if needed) otherwise home
  if (user) {
    const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
    const hasValidRole = !!user.role_name && validRoles.includes(user.role_name);
    const needsPlantel = user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id;

    if (!hasValidRole || needsPlantel) return navigateTo('/onboarding', { replace: true });
    return navigateTo('/', { replace: true });
  }
});
