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
          class="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
        >
          Marcar todo como leído
        </button>
        <button
          @click="refresh()"
          class="px-4 py-2 rounded-lg bg-white border border-slate-200 font-semibold hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>
    </div>

    <!-- Push Controls -->
    <div class="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
      <div>
        <div class="font-bold text-slate-800">Push notifications</div>
        <div class="text-sm text-slate-500">
          Estado: <span class="font-semibold">{{ statusText }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          v-if="isSupported && !subscribed"
          @click="enablePush('Web')"
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Activar
        </button>
        <button
          v-if="isSupported && subscribed"
          @click="disablePush()"
          class="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
        >
          Desactivar
        </button>
        <div v-if="!isSupported" class="text-sm text-slate-500">
          No soportado en este navegador.
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div v-if="items.length === 0" class="p-10 text-center text-slate-500">
        Sin notificaciones.
      </div>

      <div v-else class="divide-y divide-slate-100">
        <template v-for="n in items" :key="n.id">
          <!-- Filter out bad data visually just in case -->
          <div
            v-if="n.title"
            class="p-4 hover:bg-slate-50 flex items-start justify-between gap-4"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <!-- FIXED: Changed !n.read_at to !n.is_read -->
                <span
                  v-if="!n.is_read"
                  class="inline-block w-2 h-2 rounded-full bg-indigo-600"
                ></span>
                <div class="font-bold text-slate-800 truncate">{{ n.title }}</div>
                <div class="text-xs text-slate-400">{{ formatDateTime(n.created_at) }}</div>
              </div>
              <div class="text-sm text-slate-600 mt-1">
                {{ n.message }}
              </div>
              <div v-if="n.url" class="mt-2">
                <a :href="n.url" class="text-indigo-700 text-sm font-semibold underline">Abrir</a>
              </div>
            </div>

            <div class="flex gap-2 shrink-0">
              <!-- FIXED: Changed !n.read_at to !n.is_read -->
              <button
                v-if="!n.is_read"
                @click="markRead(n.id)"
                class="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Leído
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