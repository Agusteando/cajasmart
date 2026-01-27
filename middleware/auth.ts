export default defineNuxtRouteMiddleware((to) => {
  const user = useUserCookie().value;

  if (!user) {
    return navigateTo('/login', { replace: true });
  }

  // Don't block login/onboarding/auth endpoints
  if (
    to.path.startsWith('/login') ||
    to.path.startsWith('/onboarding') ||
    to.path.startsWith('/api/auth')
  ) {
    return;
  }

  const validRoles = ['ADMIN_PLANTEL', 'REVISOR_OPS', 'REVISOR_FISCAL', 'TESORERIA', 'SUPER_ADMIN'];
  const hasValidRole = !!user.role_name && validRoles.includes(user.role_name);

  // Force onboarding if role invalid/missing, or requester missing plantel
  const needsPlantel = user.role_name === 'ADMIN_PLANTEL' && !user.plantel_id;
  const needsOnboarding = !hasValidRole || needsPlantel;

  if (needsOnboarding) {
    return navigateTo('/onboarding', { replace: true });
  }
});
