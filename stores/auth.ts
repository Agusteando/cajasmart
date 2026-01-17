import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // Initialize state from cookie if it exists (allows refreshing page without losing login)
    user: useCookie('user').value || null,
  }),
  actions: {
    setUser(userData: any) {
      this.user = userData;
      // Sync with cookie
      const cookie = useCookie('user');
      cookie.value = userData;
    },
    logout() {
      this.user = null;
      const cookie = useCookie('user');
      cookie.value = null;
      navigateTo('/login');
    }
  }
});