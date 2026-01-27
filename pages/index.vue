<script setup lang="ts">
import { 
  DocumentTextIcon, 
  BanknotesIcon, 
  ClockIcon, 
  XCircleIcon, 
  ChartBarIcon,
  UserGroupIcon,
  BuildingOfficeIcon
} from '@heroicons/vue/24/outline';

// PROTECT THIS PAGE ON SERVER SIDE
definePageMeta({ middleware: 'auth' });

const loading = ref(true);
const kpi = ref<any>({});
const charts = ref<any[]>([]);

const formatMoney = (val: any) => Number(val || 0).toLocaleString('es-MX');

const calculatePercent = (val: number) => {
  if (!charts.value.length) return 0;
  const max = Math.max(...charts.value.map(c => Number(c.total)));
  return max ? (Number(val) / max) * 100 : 0;
};

onMounted(async () => {
  try {
    // 1. Check if user needs onboarding or redirection
    const status = await $fetch('/api/onboarding/status');

    if (status.requiresOnboarding) {
      return navigateTo('/onboarding');
    }

    // 2. Dispatch to Role-Specific Dashboard
    // If user is NOT Super Admin, they shouldn't be on '/', send them to their workspace
    if (status.user.role_name !== 'SUPER_ADMIN') {
      const target = status.homePage || '/reembolsos';
      if (target !== '/') {
        return navigateTo(target);
      }
    }

    // 3. Load KPI Data (Only reaches here if Super Admin)
    const data = await $fetch('/api/kpi');
    kpi.value = data.global;
    charts.value = data.charts;

  } catch (error) {
    console.error('Dashboard Error:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <!-- Loading Screen -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div class="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      <p class="text-slate-500 font-medium animate-pulse">Cargando Dashboard...</p>
    </div>

    <!-- Admin KPI Dashboard (Only rendered for SUPER_ADMIN or roles landing on /) -->
    <div v-else class="space-y-8 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Resumen Global</h1>
          <p class="text-slate-500 mt-1">Estado actual de las solicitudes y presupuesto.</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-slate-500">Fecha</p>
          <p class="text-slate-900 font-bold">{{ new Date().toLocaleDateString('es-MX', { dateStyle: 'long' }) }}</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition hover:shadow-md">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DocumentTextIcon class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500">Solicitudes Totales</p>
              <p class="text-2xl font-bold text-slate-800">{{ kpi.total_count || 0 }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition hover:shadow-md">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <BanknotesIcon class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500">Pagado / Aprobado</p>
              <p class="text-2xl font-bold text-emerald-700">${{ formatMoney(kpi.total_pagado) }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition hover:shadow-md">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <ClockIcon class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500">En Revisión</p>
              <p class="text-2xl font-bold text-amber-600">${{ formatMoney(kpi.total_pendiente) }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition hover:shadow-md">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-red-50 text-red-600 rounded-xl">
              <XCircleIcon class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500">Rechazados</p>
              <p class="text-2xl font-bold text-red-600">{{ kpi.total_rechazados || 0 }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Breakdown Chart -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 class="font-bold text-lg text-slate-800 mb-6">Gasto por Plantel (Pagado)</h3>
          <div v-if="charts.length > 0" class="space-y-5">
            <div v-for="c in charts" :key="c.nombre" class="group">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium text-slate-700">{{ c.nombre }}</span>
                <span class="font-bold text-slate-900">${{ formatMoney(c.total) }}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out group-hover:bg-indigo-500" :style="{ width: calculatePercent(c.total) + '%' }"></div>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center h-48 text-slate-400">
            <ChartBarIcon class="w-12 h-12 mb-2 opacity-50" />
            <p>No hay datos registrados aún</p>
          </div>
        </div>

        <!-- Quick Actions (For Admin) -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-lg text-white">
          <h3 class="font-bold text-lg mb-4">Acciones Rápidas</h3>
          <div class="space-y-3">
            <NuxtLink to="/admin/usuarios" class="flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition cursor-pointer">
              <UserGroupIcon class="w-6 h-6 text-indigo-300" />
              <div>
                <p class="font-bold text-sm">Gestionar Usuarios</p>
                <p class="text-xs text-slate-400">Aprobar accesos o cambiar roles</p>
              </div>
            </NuxtLink>
            <NuxtLink to="/admin/planteles" class="flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition cursor-pointer">
              <BuildingOfficeIcon class="w-6 h-6 text-emerald-300" />
              <div>
                <p class="font-bold text-sm">Gestionar Planteles</p>
                <p class="text-xs text-slate-400">Ajustar presupuestos y sucursales</p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>