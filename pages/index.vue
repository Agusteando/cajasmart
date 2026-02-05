<script setup lang="ts">
import { 
  DocumentTextIcon, BanknotesIcon, ClockIcon, XCircleIcon, 
  ChartBarIcon, UserGroupIcon, BuildingOfficeIcon, FunnelIcon,
  CalendarIcon, ArrowTrendingUpIcon, CheckCircleIcon
} from '@heroicons/vue/24/outline';
import { useUserCookie } from '~/composables/useUserCookie';

// PROTECT THIS PAGE ON SERVER SIDE
definePageMeta({ middleware: 'auth' });

const user = useUserCookie();
const loading = ref(true);

// -- SUPER ADMIN BI STATE --
const kpi = ref<any>({});
const timeline = ref<any[]>([]);
const statusBreakdown = ref<any[]>([]);
const plantelStats = ref<any[]>([]);
const plantelesList = ref<any[]>([]);

const filters = ref({
  month: new Date().toISOString().slice(0, 7),
  plantelId: ''
});

// -- NORMAL USER STATE --
const normalKpi = ref<any>({});
const normalCharts = ref<any[]>([]);

// -- MODAL STATE (For Drill Down) --
const showDetailModal = ref(false);
const selectedItem = ref<any>(null);

// HELPER: Format Money
const formatMoney = (val: any) => `$${Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// HELPER: Calculate Percentage for Bars
const calculatePercent = (val: number, max: number) => max ? (Number(val) / max) * 100 : 0;

// HELPER: Stage Logic for Gantt/Progress
const getStageInfo = (status: string) => {
  switch(status) {
    case 'DRAFT': return { pct: 10, color: 'bg-slate-300', label: 'Borrador' };
    case 'PENDING_OPS_REVIEW': return { pct: 35, color: 'bg-amber-400', label: 'Rev. Operativa' };
    case 'PENDING_FISCAL_REVIEW': return { pct: 60, color: 'bg-blue-400', label: 'Rev. Fiscal' };
    case 'APPROVED': return { pct: 85, color: 'bg-indigo-500', label: 'Por Pagar' };
    case 'PROCESSED': return { pct: 100, color: 'bg-emerald-500', label: 'Pagado' };
    case 'RETURNED': return { pct: 100, color: 'bg-rose-500', label: 'Rechazado' };
    default: return { pct: 0, color: 'bg-slate-200', label: 'Desconocido' };
  }
};

// FETCH DATA
const loadDashboard = async () => {
  loading.value = true;
  try {
    // 1. Check onboarding
    const status = await $fetch('/api/onboarding/status');
    if (status.requiresOnboarding) return navigateTo('/onboarding');

    // 2. Dispatch
    if (user.value?.role_name !== 'SUPER_ADMIN') {
      // Normal User Redirect or Simple Dashboard
      const target = status.homePage || '/reembolsos';
      if (target !== '/') return navigateTo(target);
      
      // Fallback simple view
      const data = await $fetch('/api/kpi');
      normalKpi.value = data.global;
      normalCharts.value = data.charts;
    } else {
      // SUPER ADMIN BI LOAD
      // Load planteles filter once
      if (plantelesList.value.length === 0) {
         const pRes = await $fetch<any[]>('/api/crud/planteles');
         plantelesList.value = pRes || [];
      }

      const data: any = await $fetch('/api/admin/bi', { params: { 
        month: filters.value.month,
        plantel_id: filters.value.plantelId 
      }});
      
      kpi.value = data.kpi || {};
      timeline.value = data.timeline || [];
      statusBreakdown.value = data.statusBreakdown || [];
      plantelStats.value = data.plantelStats || [];
    }
  } catch (error) {
    console.error('Dashboard Error:', error);
  } finally {
    loading.value = false;
  }
};

// Watch filters for live reload
watch(filters, () => {
   if (user.value?.role_name === 'SUPER_ADMIN') loadDashboard();
}, { deep: true });

onMounted(loadDashboard);

// Drill Down Action
const openDetail = (item: any) => {
  // We can reuse the specific edit modal logic or a read-only view. 
  // For quick BI drill-down, let's navigate to the reimbursement page with a query 
  // OR we can create a dedicated lightweight modal here. 
  // Let's redirect to standard view filtered by this ID for consistency.
  navigateTo(`/reembolsos?q=${item.folio}`);
};
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div class="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      <p class="text-slate-500 font-medium animate-pulse">Analizando datos...</p>
    </div>

    <!-- SUPER ADMIN BI DASHBOARD -->
    <div v-else-if="user?.role_name === 'SUPER_ADMIN'" class="space-y-8 animate-fade-in p-2">
      
      <!-- Top Control Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-10 backdrop-blur-xl bg-white/90">
         <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
               <ArrowTrendingUpIcon class="w-7 h-7 text-indigo-600" />
               Business Intelligence
            </h1>
            <p class="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
               Panorama Global Financiero
            </p>
         </div>
         
         <div class="flex flex-col sm:flex-row gap-3">
            <div class="relative group">
               <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarIcon class="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
               </div>
               <input 
                  type="month" 
                  v-model="filters.month"
                  class="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm"
               />
            </div>

            <div class="relative group">
               <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BuildingOfficeIcon class="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
               </div>
               <select 
                  v-model="filters.plantelId"
                  class="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm appearance-none min-w-[200px]"
               >
                  <option value="">Vista Global (Todos)</option>
                  <option v-for="p in plantelesList" :key="p.id" :value="p.id">{{ p.nombre }}</option>
               </select>
               <FunnelIcon class="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
         </div>
      </div>

      <!-- KPI Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <!-- Total Card -->
         <div class="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <div class="relative z-10">
               <div class="text-slate-400 text-xs font-bold uppercase mb-1">Total Solicitado</div>
               <div class="text-3xl font-black tracking-tight">{{ formatMoney(kpi.total_money) }}</div>
               <div class="mt-4 flex items-center gap-2 text-xs">
                  <span class="bg-white/20 px-2 py-0.5 rounded-md font-mono">{{ kpi.total_count }} solicitudes</span>
                  <span class="text-slate-400">en este periodo</span>
               </div>
            </div>
         </div>

         <!-- Pending Card -->
         <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-amber-300 transition-colors">
            <div class="flex justify-between items-start mb-2">
               <div class="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <ClockIcon class="w-6 h-6" />
               </div>
               <span class="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">En Proceso</span>
            </div>
            <div class="text-slate-500 text-xs font-bold uppercase">Monto Pendiente</div>
            <div class="text-2xl font-black text-slate-800">{{ formatMoney(kpi.pending_money) }}</div>
            <div class="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
               <div class="bg-amber-400 h-1.5 rounded-full" :style="{ width: calculatePercent(kpi.pending_money, kpi.total_money) + '%' }"></div>
            </div>
         </div>

         <!-- Paid Card -->
         <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-emerald-300 transition-colors">
            <div class="flex justify-between items-start mb-2">
               <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircleIcon class="w-6 h-6" />
               </div>
               <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">Completado</span>
            </div>
            <div class="text-slate-500 text-xs font-bold uppercase">Monto Pagado</div>
            <div class="text-2xl font-black text-slate-800">{{ formatMoney(kpi.paid_money) }}</div>
            <div class="mt-2 text-xs text-slate-400 flex justify-between">
               <span>Deducible: {{ formatMoney(kpi.deducible_money) }}</span>
            </div>
         </div>

         <!-- Performance Card -->
         <div class="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100">
            <div class="text-indigo-900 text-xs font-bold uppercase mb-1">Tiempo Promedio</div>
            <div class="text-3xl font-black text-indigo-700">
               {{ Math.round(Number(kpi.avg_days || 0)) }} <span class="text-lg font-medium text-indigo-400">días</span>
            </div>
            <p class="text-xs text-indigo-400 mt-2">
               Desde creación hasta pago
            </p>
         </div>
      </div>

      <!-- MAIN VIZ: STAGE TIMELINE (GANTT-LIKE) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         <!-- Left Col: The Detailed Timeline/Matrix -->
         <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 class="font-bold text-slate-800 flex items-center gap-2">
                  <ChartBarIcon class="w-5 h-5 text-indigo-600" />
                  Progreso de Solicitudes
               </h3>
               <div class="text-xs text-slate-400">Ordenado por fecha más reciente</div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
               <div v-for="item in timeline" :key="item.id" 
                    @click="openDetail(item)"
                    class="group bg-white hover:bg-slate-50 border border-slate-100 rounded-xl p-4 transition-all cursor-pointer hover:shadow-md hover:border-indigo-100"
               >
                  <div class="flex justify-between items-center mb-3">
                     <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                           {{ new Date(item.reimbursement_date).getDate() }}
                        </div>
                        <div>
                           <div class="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">{{ item.folio }} - {{ item.solicitante_nombre }}</div>
                           <div class="text-xs text-slate-400">{{ item.plantel_nombre }}</div>
                        </div>
                     </div>
                     <div class="text-right">
                        <div class="font-mono font-bold text-slate-800">{{ formatMoney(item.total_amount) }}</div>
                        <div class="text-[10px] text-slate-400 font-mono">{{ item.status }}</div>
                     </div>
                  </div>
                  
                  <!-- The Progress Bar (Gantt element) -->
                  <div class="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                     <div 
                        class="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                        :class="getStageInfo(item.status).color"
                        :style="{ width: getStageInfo(item.status).pct + '%' }"
                     ></div>
                  </div>
                  <div class="flex justify-between mt-1">
                     <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{{ getStageInfo(item.status).label }}</span>
                     <span class="text-[10px] text-slate-400">{{ getStageInfo(item.status).pct }}%</span>
                  </div>
               </div>
               
               <div v-if="timeline.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
                  <DocumentTextIcon class="w-12 h-12 mb-2 opacity-50" />
                  <p>No hay datos para este periodo.</p>
               </div>
            </div>
         </div>

         <!-- Right Col: Breakdown & Stats -->
         <div class="space-y-6">
            
            <!-- Plantel Leaderboard -->
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
               <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <BuildingOfficeIcon class="w-5 h-5 text-indigo-500" />
                  Gasto por Plantel
               </h3>
               <div class="space-y-4">
                  <div v-for="(p, idx) in plantelStats" :key="idx" class="relative">
                     <div class="flex justify-between text-xs mb-1 font-medium z-10 relative">
                        <span class="text-slate-700">{{ p.nombre }}</span>
                        <span class="text-slate-900 font-bold">{{ formatMoney(p.total) }}</span>
                     </div>
                     <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                           class="bg-indigo-500 h-2 rounded-full opacity-80" 
                           :style="{ width: calculatePercent(p.total, kpi.total_money) + '%' }"
                        ></div>
                     </div>
                  </div>
                  <div v-if="plantelStats.length === 0" class="text-xs text-slate-400 italic">Selecciona 'Vista Global' para ver comparativa.</div>
               </div>
            </div>

            <!-- Status Donut (Simulated with Bars for cleaner look) -->
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
               <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FunnelIcon class="w-5 h-5 text-emerald-500" />
                  Etapas del Proceso
               </h3>
               <div class="space-y-3">
                  <div v-for="(s, idx) in statusBreakdown" :key="idx" class="flex items-center gap-3">
                     <div :class="`w-2 h-2 rounded-full ${getStageInfo(s.status).color}`"></div>
                     <div class="flex-1 text-xs font-medium text-slate-600">{{ getStageInfo(s.status).label }}</div>
                     <div class="text-xs font-bold text-slate-800">{{ s.c }}</div>
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>

    <!-- NORMAL USER SIMPLE DASHBOARD (FALLBACK) -->
    <div v-else class="space-y-8 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Bienvenido, {{ user.nombre }}</h1>
          <p class="text-slate-500 mt-1">Resumen de actividad.</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-slate-500">Fecha</p>
          <p class="text-slate-900 font-bold">{{ new Date().toLocaleDateString('es-MX', { dateStyle: 'long' }) }}</p>
        </div>
      </div>

      <!-- Stats Cards (Simple) -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition hover:shadow-md">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DocumentTextIcon class="w-6 h-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500">Total Solicitudes</p>
              <p class="text-2xl font-bold text-slate-800">{{ normalKpi.total_count || 0 }}</p>
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
              <p class="text-2xl font-bold text-emerald-700">{{ formatMoney(normalKpi.total_pagado) }}</p>
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
              <p class="text-2xl font-bold text-amber-600">{{ formatMoney(normalKpi.total_pendiente) }}</p>
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
              <p class="text-2xl font-bold text-red-600">{{ normalKpi.total_rechazados || 0 }}</p>
            </div>
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

/* Custom Scrollbar for the Gantt List */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9; 
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; 
}
</style>