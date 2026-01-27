export default defineNuxtRouteMiddleware(() => {
  const user = useUserCookie().value;

  // Only redirect if session is valid
  if (user) {
    return navigateTo('/', { replace: true });
  }
});
