export default defineNuxtRouteMiddleware(() => {
  const user = useUserCookie().value;

  // Must be a VALID session user (not just "cookie exists")
  if (!user) {
    return navigateTo('/login', { replace: true });
  }
});
