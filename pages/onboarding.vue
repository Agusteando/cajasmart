<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <!-- Brand bar -->
      <div class="flex items-center justify-between mb-4 px-1">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200"
          >
            C
          </div>
          <div>
            <div class="text-lg font-bold text-slate-900 leading-tight">CajaSmart</div>
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-widest">IECS - IEDIS</div>
          </div>
        </div>

        <button
          v-if="status?.user?.email"
          @click="logout"
          class="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-white/60 transition"
        >
          Cerrar sesión
        </button>
      </div>

      <div class="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <!-- Header -->
        <div class="px-8 py-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold">Configuración rápida</h1>
              <p class="text-indigo-100 mt-1">Un paso y estás dentro.</p>
            </div>
            <div class="text-right text-indigo-100 text-sm">
              <div class="font-semibold truncate max-w-[260px]">{{ status?.user?.email || '' }}</div>
              <div class="opacity-90">{{ status?.user?.nombre || '' }}</div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="p-8">
          <!-- Loading -->
          <div v-if="loading" class="py-10 text-center">
            <div
              class="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"
            ></div>
            <p class="text-slate-500">Verificando tu cuenta...</p>
          </div>

          <!-- Needs Plantel -->
          <div v-else-if="mode === 'plantel'" class="space-y-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BuildingOfficeIcon class="w-6 h-6" />
              </div>
              <div class="flex-1">
                <h2 class="text-xl font-bold text-slate-900">Selecciona tu Plantel</h2>
                <p class="text-slate-500 mt-1">
                  Esto configura tu área de trabajo y dónde se registran tus solicitudes.
                </p>

                <div
                  v-if="status?.suggestedPlantelId && suggestedPlantelName"
                  class="mt-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50 text-sm text-indigo-900"
                >
                  <div class="font-semibold">Sugerencia</div>
                  <div class="mt-1">
                    <span class="font-medium">{{ suggestedPlantelName }}</span>
                    <span class="text-indigo-700"> — {{ status.suggestedReason }}</span>
                  </div>
                  <button
                    @click="selectSuggestedPlantel"
                    class="mt-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline"
                  >
                    Usar sugerencia
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <input
                v-model="search"
                placeholder="Buscar plantel por nombre o código..."
                class="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
                <button
                  v-for="p in filteredPlanteles"
                  :key="p.id"
                  @click="selectedPlantel = p.id"
                  :class="[
                    'w-full text-left p-4 rounded-xl border-2 transition flex items-center justify-between',
                    selectedPlantel === p.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  ]"
                >
                  <div>
                    <div class="font-semibold text-slate-900">{{ p.nombre }}</div>
                    <div class="text-xs text-slate-500 mt-0.5">{{ p.codigo }}</div>
                  </div>
                  <CheckIcon v-if="selectedPlantel === p.id" class="w-5 h-5 text-indigo-600" />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 pt-2">
              <button
                @click="refresh"
                class="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Actualizar
              </button>

              <button
                @click="confirmPlantel"
                :disabled="!selectedPlantel || processing"
                class="px-6 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {{ processing ? 'Guardando...' : 'Continuar' }}
              </button>
            </div>
          </div>

          <!-- Needs Access / Role -->
          <div v-else-if="mode === 'access'" class="space-y-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ClockIcon class="w-6 h-6" />
              </div>
              <div class="flex-1">
                <h2 class="text-xl font-bold text-slate-900">Tu acceso está pendiente</h2>
                <p class="text-slate-500 mt-1">
                  Para mantener el sistema seguro, un administrador debe habilitar tu rol. Envía la solicitud con contexto
                  (rol y plantel) para acelerar la aprobación.
                </p>

                <div
                  v-if="status?.pendingRequest"
                  class="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
                >
                  <div class="font-semibold">Solicitud ya enviada</div>
                  <div class="mt-1 opacity-90">
                    Última solicitud: {{ new Date(status.pendingRequest.created_at).toLocaleString('es-MX') }}
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-2">Rol solicitado</label>
                <select
                  v-model="requestedRole"
                  class="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ADMIN_PLANTEL">Administrador de Plantel (Solicitante)</option>
                  <option value="REVISOR_OPS">Revisor Operativo</option>
                  <option value="REVISOR_FISCAL">Revisor Fiscal</option>
                  <option value="TESORERIA">Tesorería</option>
                </select>
                <p class="text-xs text-slate-500 mt-2">
                  No te da permisos automáticamente; solo guía al administrador para asignarte bien.
                </p>
              </div>

              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-2">Plantel (si aplica)</label>
                <select
                  v-model="requestedPlantelId"
                  class="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option :value="null">—</option>
                  <option v-for="p in status?.planteles || []" :key="p.id" :value="p.id">
                    {{ p.codigo }} — {{ p.nombre }}
                  </option>
                </select>

                <div v-if="status?.suggestedPlantelId && suggestedPlantelName" class="mt-2 text-xs text-slate-500">
                  Sugerencia: <span class="font-semibold text-slate-700">{{ suggestedPlantelName }}</span>
                  <button
                    class="ml-2 text-indigo-700 hover:text-indigo-900 underline font-semibold"
                    @click="requestedPlantelId = status.suggestedPlantelId"
                    type="button"
                  >
                    usar
                  </button>
                </div>

                <p class="text-xs text-slate-500 mt-2">
                  Útil para solicitantes. Para revisores suele ser global/corporativo.
                </p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Mensaje (opcional pero recomendado)</label>
              <textarea
                v-model="reason"
                rows="4"
                placeholder="Ej: Puesto, área, plantel, y por qué necesitas acceso..."
                class="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div class="flex items-center justify-between gap-3 pt-2">
              <button
                @click="refresh"
                class="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Actualizar
              </button>

              <button
                @click="sendAccessRequest"
                :disabled="processing || !!status?.pendingRequest"
                class="px-6 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {{ status?.pendingRequest ? 'Solicitud enviada' : (processing ? 'Enviando...' : 'Solicitar acceso') }}
              </button>
            </div>
          </div>

          <!-- Fallback -->
          <div v-else class="text-center py-10">
            <p class="text-slate-600">Listo.</p>
          </div>
        </div>
      </div>

      <div class="mt-6 text-center text-xs text-slate-400">&copy; 2026 Sistema Financiero IEDIS</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BuildingOfficeIcon, CheckIcon, ClockIcon } from '@heroicons/vue/24/outline';

definePageMeta({ layout: 'none' });
useHead({ title: 'Configuración - CajaSmart' });

const loading = ref(true);
const processing = ref(false);
const status = ref<any>(null);

const search = ref('');
const selectedPlantel = ref<number | null>(null);

const requestedRole = ref<string>('ADMIN_PLANTEL');
const requestedPlantelId = ref<number | null>(null);
const reason = ref<string>('');

const mode = computed<'plantel' | 'access'>(() => {
  if (!status.value) return 'access';
  if (status.value.needsPlantel) return 'plantel';
  if (!status.value.isActive || !status.value.hasValidRole) return 'access';
  return 'access';
});

const filteredPlanteles = computed(() => {
  const list = status.value?.planteles || [];
  const q = (search.value || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((p: any) => {
    return String(p.nombre || '').toLowerCase().includes(q) || String(p.codigo || '').toLowerCase().includes(q);
  });
});

const suggestedPlantelName = computed(() => {
  const id = status.value?.suggestedPlantelId;
  if (!id) return '';
  const p = (status.value?.planteles || []).find((x: any) => x.id === id);
  return p ? `${p.codigo} — ${p.nombre}` : '';
});

const fetchStatus = async () => {
  loading.value = true;
  try {
    const data = await $fetch('/api/onboarding/status');
    status.value = data;

    // If onboarding not required, route to correct home
    if (!data.requiresOnboarding) {
      const target = data.homePage || '/';
      return navigateTo(target === '/' ? '/' : target, { replace: true });
    }

    // UX defaults
    if (data.suggestedPlantelId) {
      if (data.needsPlantel) selectedPlantel.value = data.suggestedPlantelId;
      if (requestedPlantelId.value == null) requestedPlantelId.value = data.suggestedPlantelId;
    }
  } catch (e) {
    return navigateTo('/login', { replace: true });
  } finally {
    loading.value = false;
  }
};

const refresh = () => fetchStatus();

const selectSuggestedPlantel = () => {
  const id = status.value?.suggestedPlantelId;
  if (id) selectedPlantel.value = id;
};

const confirmPlantel = async () => {
  if (!selectedPlantel.value) return;
  processing.value = true;
  try {
    await $fetch('/api/onboarding/assign-plantel', {
      method: 'POST',
      body: { plantelId: selectedPlantel.value }
    });
    await fetchStatus(); // will redirect if complete
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Error al asignar plantel');
  } finally {
    processing.value = false;
  }
};

const sendAccessRequest = async () => {
  processing.value = true;
  try {
    await $fetch('/api/onboarding/request-access', {
      method: 'POST',
      body: {
        requestedRole: requestedRole.value,
        requestedPlantelId: requestedPlantelId.value,
        reason: reason.value
      }
    });
    await fetchStatus();
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Error al enviar solicitud');
  } finally {
    processing.value = false;
  }
};

const logout = () => {
  useUserCookie().value = null;
  navigateTo('/login', { replace: true });
};

onMounted(fetchStatus);
</script>
