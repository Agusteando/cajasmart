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
        <div
          v-for="n in items"
          :key="n.id"
          class="p-4 hover:bg-slate-50 flex items-start justify-between gap-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                v-if="!n.read_at"
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
            <button
              v-if="!n.read_at"
              @click="markRead(n.id)"
              class="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Leído
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { items, fetchList, markRead, markAllRead } = useNotifications();
const { isSupported, permission, subscribed, refreshStatus, enablePush, disablePush } = usePush();

const formatDateTime = (d: string) => new Date(d).toLocaleString('es-MX');

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
