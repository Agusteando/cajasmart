export default defineNuxtRouteMiddleware(() => {
  const user = useUserCookie();
  if (!user.value) return navigateTo('/login');
});
