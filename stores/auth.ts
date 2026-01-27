import { defineStore } from 'pinia';
import type { SessionUser } from '~/composables/useUserCookie';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: useUserCookie().value as SessionUser | null
  }),
  actions: {
    setUser(userData: SessionUser | null) {
      this.user = userData;
      useUserCookie().value = userData;
    },
    logout() {
      this.user = null;
      // This will DELETE the cookie correctly now (because we did not override serialize)
      useUserCookie().value = null;
      navigateTo('/login', { replace: true });
    }
  }
});
