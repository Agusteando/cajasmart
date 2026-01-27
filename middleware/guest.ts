export default defineNuxtRouteMiddleware((to, from) => {
  const user = useCookie('user');

  // If user is already logged in, send them to the home/dashboard
  if (user.value) {
    return navigateTo('/');
  }
});