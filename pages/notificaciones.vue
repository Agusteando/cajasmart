<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Notificaciones</h2>
        <p class="text-slate-500 text-sm mt-1">Tus avisos (solo los relevantes para tu rol/usuario)</p>
      </div>

      <div class="flex gap-2">
        <button
          @click="markAllRead()"
          class="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
        >
          Marcar todo como leído
        </button>
        <button
          @click="refresh()"
          class="px-4 py-2 rounded-lg bg-white border border-slate-200 font-semibold hover:bg-slate-50 transition"
        >
          Actualizar
        </button>
      </div>
    </div>

    <!-- Push Controls -->
    <div class="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
      <div>
        <div class="font-bold text-slate-800">Push notifications</div>
        <div class="text-sm text-slate-500">
          Estado: <span class="font-semibold" :class="subscribed ? 'text-emerald-600' : 'text-slate-600'">{{ statusText }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          v-if="isSupported && !subscribed"
          @click="enablePush('Web')"
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
        >
          Activar
        </button>
        <button
          v-if="isSupported && subscribed"
          @click="disablePush()"
          class="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
        >
          Desactivar
        </button>
        <div v-if="!isSupported" class="text-sm text-slate-500">
          No soportado en este navegador.
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div v-if="items.length === 0" class="p-10 text-center text-slate-500">
        Sin notificaciones.
      </div>

      <div v-else class="divide-y divide-slate-100">
        <template v-for="n in items" :key="n.id">
          <div
            v-if="n.title"
            class="p-4 hover:bg-slate-50 flex items-start justify-between gap-4 transition-colors"
            :class="isUnread(n) ? 'bg-indigo-50/30' : ''"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  v-if="isUnread(n)"
                  class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-300"
                  title="No leído"
                ></span>
                <div class="font-bold text-slate-800 truncate">{{ n.title }}</div>
                <div class="text-xs text-slate-400">{{ formatDateTime(n.created_at) }}</div>
              </div>
              <div class="text-sm text-slate-600 mt-1">
                {{ n.message }}
              </div>
              <div v-if="n.url" class="mt-2">
                <a :href="n.url" class="text-indigo-700 text-sm font-semibold hover:underline inline-flex items-center gap-1">
                  Abrir enlace &rarr;
                </a>
              </div>
            </div>

            <div class="flex gap-2 shrink-0 self-center">
              <button
                v-if="isUnread(n)"
                @click="markRead(n.id)"
                class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm"
              >
                Marcar Leído
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { items, fetchList, markRead, markAllRead } = useNotifications();
const { isSupported, permission, subscribed, refreshStatus, enablePush, disablePush } = usePush();

// Helper to reliably check unread status (handle tinyint 0/1 or boolean)
const isUnread = (n: any) => {
  if (n.is_read === undefined) return false;
  return Number(n.is_read) === 0;
};

const formatDateTime = (d: any) => {
  if (!d) return '';
  const safeDate = String(d).replace(' ', 'T');
  try {
    const dateObj = new Date(safeDate);
    if (isNaN(dateObj.getTime())) return String(d);
    
    return dateObj.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(d);
  }
};

const statusText = computed(() => {
  if (!isSupported.value) return 'No soportado';
  if (permission.value !== 'granted') return `Permiso: ${permission.value}`;
  return subscribed.value ? 'Activo' : 'Inactivo';
});

async function refresh() {
  await fetchList(false);
  await refreshStatus();
}

onMounted(refresh);
</script>