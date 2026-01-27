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
      useUserCookie().value = null;
      navigateTo('/login', { replace: true });
    },
    async stopImpersonation() {
      const res: any = await $fetch('/api/admin/impersonate/stop', { method: 'POST' });
      if (res?.user) this.setUser(res.user);
    }
  }
});
