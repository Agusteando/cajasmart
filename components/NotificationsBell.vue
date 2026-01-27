<template>
  <button
    class="relative inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-100"
    @click="go"
    title="Notificaciones"
  >
    <BellIcon class="w-6 h-6 text-slate-700" />
    <span
      v-if="unread > 0"
      class="absolute -top-1 -right-1 text-[10px] font-bold bg-rose-600 text-white rounded-full px-2 py-0.5"
    >
      {{ unread > 99 ? '99+' : unread }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { BellIcon } from '@heroicons/vue/24/outline';

const { unread, fetchUnread } = useNotifications();

const go = () => navigateTo('/notificaciones');

onMounted(async () => {
  await fetchUnread();
  // light polling; replace with SSE later if you want realtime
  setInterval(fetchUnread, 15000);
});
</script>
