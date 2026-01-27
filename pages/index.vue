<template>
  <div>
    <h2 class="text-3xl font-bold text-slate-800 mb-6">Tablero de Control</h2>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600">
        <p class="text-gray-500 text-sm font-semibold uppercase">En Proceso</p>
        <p class="text-3xl font-bold text-slate-800">${{ kpi.global?.total_pendiente || 0 }}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
        <p class="text-gray-500 text-sm font-semibold uppercase">Pagado (Histórico)</p>
        <p class="text-3xl font-bold text-slate-800">${{ kpi.global?.total_pagado || 0 }}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
        <p class="text-gray-500 text-sm font-semibold uppercase">Rechazados</p>
        <p class="text-3xl font-bold text-slate-800">{{ kpi.global?.total_rechazados || 0 }}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
        <p class="text-gray-500 text-sm font-semibold uppercase">Solicitudes Totales</p>
        <p class="text-3xl font-bold text-slate-800">{{ kpi.global?.total_count || 0 }}</p>
      </div>
    </div>

    <!-- Charts / Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white p-6 rounded-xl shadow-sm" v-if="kpi.charts.length > 0">
        <h3 class="font-bold text-lg mb-4 text-slate-700">Gasto por Plantel</h3>
        <div class="space-y-4">
          <div v-for="c in kpi.charts" :key="c.nombre" class="relative pt-1">
            <div class="flex mb-2 items-center justify-between">
              <span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                {{ c.nombre }}
              </span>
              <span class="text-xs font-semibold inline-block text-blue-600">
                ${{ c.total }}
              </span>
            </div>
            <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
              <div
                :style="`width: ${Math.min((c.total / 50000) * 100, 100)}%`"
                class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm">
        <h3 class="font-bold text-lg mb-4 text-slate-700">Acciones Rápidas</h3>
        <div class="grid grid-cols-2 gap-4">
          <NuxtLink to="/reembolsos?new=true" class="bg-slate-800 text-white p-4 rounded-lg hover:bg-slate-700 text-center transition">
            + Nuevo Reembolso
          </NuxtLink>
          <NuxtLink to="/reembolsos" class="border border-slate-300 text-slate-700 p-4 rounded-lg hover:bg-gray-50 text-center transition">
            Ver Pendientes
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

type SessionUser = {
  id: number;
  nombre: string;
  email: string;
  role_name: string;
  role_level: number;
  plantel_id: number | null;
  plantel_nombre: string;
  avatar?: string | null;
};

function safeParse(v: any): SessionUser | null {
  const s = String(v ?? '').trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  try {
    return JSON.parse(s) as SessionUser;
  } catch {
    return null;
  }
}

const userCookie = useCookie<SessionUser | string | null>('user', { default: () => null });
const user = computed<SessionUser | null>(() => {
  const v = userCookie.value as any;
  if (!v) return null;
  if (typeof v === 'object') return v as SessionUser;
  return safeParse(v);
});

const kpi = ref<{ global: any; charts: any[] }>({ global: {}, charts: [] });

onMounted(async () => {
  if (!user.value) return;

  const data = await $fetch('/api/kpi', {
    params: {
      userId: user.value.id,
      role: user.value.role_name,
      plantelId: user.value.plantel_id
    }
  });

  kpi.value = data as any;
});
</script>
