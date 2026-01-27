import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: useUserCookie().value
  }),
  actions: {
    setUser(userData: any) {
      this.user = userData;
      useUserCookie().value = userData;
    },
    logout() {
      this.user = null;
      useUserCookie().value = null;
      navigateTo('/login');
    }
  }
});
