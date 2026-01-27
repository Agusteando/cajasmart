export default defineNuxtRouteMiddleware((to, from) => {
  // Use the same cookie name as the server ('user')
  const user = useCookie('user');

  // If the user cookie doesn't exist or is null, redirect to login
  if (!user.value) {
    return navigateTo('/login');
  }
});