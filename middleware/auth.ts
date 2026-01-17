export default defineNuxtRouteMiddleware((to, from) => {
  // We check the cookie 'user' to see if they are logged in
  const user = useCookie('user');

  // If no user is logged in, force them to the Login page
  if (!user.value) {
    return navigateTo('/login');
  }
});