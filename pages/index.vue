<script setup lang="ts">
import { 
  ArrowTrendingUpIcon, 
  CalendarIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon
} from '@heroicons/vue/24/outline';
import { useUserCookie } from '~/composables/useUserCookie';

definePageMeta({ middleware: 'auth' });
const user = useUserCookie();

const loading = ref(true);
const month = ref(new Date().toISOString().slice(0, 7));
const data = ref<any>({ swimlanes: [], totalDaysInMonth: 30 });

// -- STAGE DEFINITIONS --
const getStageStyle = (status: string, lagDays: number) => {
  // Base Colors
  let bg = 'bg-slate-300'; // Default
  let border = 'border-slate-400';
  let pattern = ''; // For ON_HOLD stripes

  switch (status) {
    case 'PENDING_OPS_REVIEW':
      bg = 'bg-amber-400';
      border = 'border-amber-500';
      break;
    case 'PENDING_FISCAL_REVIEW':
      bg = 'bg-blue-400';
      border = 'border-blue-500';
      break;
    case 'APPROVED': // Waiting for Treasury Print/Pay
      bg = 'bg-indigo-500';
      border = 'border-indigo-600';
      break;
    case 'ON_HOLD': // Retenido (Treasury)
      bg = 'bg-fuchsia-500';
      border = 'border-fuchsia-600';
      // CSS stripe pattern class
      pattern = 'bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xIDNMMCA0TDEgNUw0IDJMMyAxTDEgM1oiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==")]';
      break;
    case 'PROCESSED': // Paid by Treasury, waiting confirmation
      bg = 'bg-teal-400'; 
      border = 'border-teal-500';
      break;
    case 'RECEIVED': // Cycle Complete
      bg = 'bg-emerald-600';
      border = 'border-emerald-700';
      break;
    case 'RETURNED':
      bg = 'bg-rose-500';
      border = 'border-rose-600';
      break;
  }

  // Lagging Indicator (If pending and > 5 days)
  // ON_HOLD is always considered "lagging" visually if it stays there too long
  const isPending = ['PENDING_OPS_REVIEW', 'PENDING_FISCAL_REVIEW', 'APPROVED', 'ON_HOLD'].includes(status);
  const isLagging = isPending && lagDays > 5;
  
  return {
    classes: `${bg} ${pattern} border-l-2 ${border} ${isLagging ? 'animate-pulse shadow-md shadow-red-200' : ''}`,
    isLagging
  };
};

const fetchBI = async () => {
  loading.value = true;
  try {
    const res = await $fetch('/api/admin/bi', { params: { month: month.value } });
    data.value = res;
  } catch(e) { console.error(e); }
  finally { loading.value = false; }
};

watch(month, fetchBI);

onMounted(async () => {
  // Redirect non-admins
  if (user.value?.role_name !== 'SUPER_ADMIN') {
     const status = await $fetch('/api/onboarding/status');
     const target = status.homePage || '/reembolsos';
     if (target !== '/') return navigateTo(target);
     return;
  }
  fetchBI();
});

// Drill down
const openTicket = (id: number) => window.open(`/reembolsos?q=R-${String(id).padStart(5,'0')}`, '_blank');
</script>

<template>
  <div v-if="user?.role_name === 'SUPER_ADMIN'" class="min-h-screen bg-slate-50 pb-20">
    
    <!-- HEADER CONTROLS -->
    <div class="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 class="text-2xl font-black text-slate-900 flex items-center gap-2">
              <ArrowTrendingUpIcon class="w-7 h-7 text-indigo-600" />
              Timeline Operativo
           </h1>
           <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Seguimiento de tiempos: Ops &rarr; Fiscal &rarr; Tesorería &rarr; Pago
           </p>
        </div>

        <div class="flex items-center gap-3">
           <!-- Legend -->
           <div class="hidden xl:flex items-center gap-3 text-[10px] font-bold uppercase text-slate-500 mr-4 border-r border-slate-200 pr-4">
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-amber-400 rounded-sm"></div> Ops</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-blue-400 rounded-sm"></div> Fiscal</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-indigo-500 rounded-sm"></div> Tesorería</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-fuchsia-500 rounded-sm"></div> Retenido</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-teal-400 rounded-sm"></div> Pagado</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-emerald-600 rounded-sm"></div> Finalizado</div>
           </div>

           <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <CalendarIcon class="h-5 w-5 text-slate-400" />
              </div>
              <input 
                 type="month" 
                 v-model="month"
                 class="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
              />
           </div>
           
           <button @click="fetchBI" class="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition">
              <ArrowPathIcon class="w-5 h-5" :class="loading ? 'animate-spin' : ''" />
           </button>
        </div>
      </div>
    </div>

    <!-- MAIN MATRIX -->
    <div class="max-w-7xl mx-auto p-4 md:p-6 overflow-x-auto">
       
       <div v-if="loading" class="py-20 text-center">
          <div class="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-slate-400 font-medium">Calculando tiempos de proceso...</p>
       </div>

       <div v-else class="min-w-[800px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          
          <!-- MATRIX HEADER (DAYS) -->
          <div class="flex border-b border-slate-200 bg-slate-50">
             <div class="w-48 md:w-64 p-4 shrink-0 font-bold text-xs text-slate-400 uppercase tracking-wider border-r border-slate-200">
                Plantel
             </div>
             <div class="flex-1 relative h-10">
                <!-- Day Markers -->
                <div v-for="d in data.totalDaysInMonth" :key="d" 
                     class="absolute top-0 bottom-0 border-l border-slate-100 text-[9px] text-slate-300 pl-0.5 pt-1"
                     :style="{ left: `${((d-1)/data.totalDaysInMonth)*100}%` }"
                >
                   {{ d }}
                </div>
             </div>
          </div>

          <!-- SWIMLANES -->
          <div class="divide-y divide-slate-100">
             <div v-for="lane in data.swimlanes" :key="lane.id" class="flex group hover:bg-slate-50/50 transition-colors">
                
                <!-- ROW HEADER (Plantel Info) -->
                <div class="w-48 md:w-64 p-4 shrink-0 border-r border-slate-200 bg-white z-10">
                   <div class="font-bold text-slate-800 text-sm truncate" :title="lane.name">{{ lane.name }}</div>
                   <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">
                         {{ lane.items.length }} solicitudes
                      </span>
                      <!-- Alert if lagging items exist -->
                      <span v-if="lane.items.some((i:any) => i.lagDays > 5 && i.status !== 'PROCESSED' && i.status !== 'RECEIVED')" class="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                         <ExclamationCircleIcon class="w-3 h-3" /> Atraso
                      </span>
                   </div>
                </div>

                <!-- TIMELINE TRACK -->
                <div class="flex-1 relative py-2">
                   <!-- Vertical Day Grid Lines (Background) -->
                   <div class="absolute inset-0 pointer-events-none">
                      <div v-for="d in data.totalDaysInMonth" :key="d" 
                           class="absolute top-0 bottom-0 border-l border-slate-50"
                           :style="{ left: `${((d-1)/data.totalDaysInMonth)*100}%` }"
                      ></div>
                   </div>

                   <!-- BARS STACK -->
                   <div class="relative space-y-1 px-1 min-h-[30px]">
                      <div v-for="item in lane.items" :key="item.id"
                           @click="openTicket(item.id)"
                           class="h-6 rounded-md shadow-sm relative text-[10px] flex items-center px-2 text-white font-bold cursor-pointer hover:brightness-110 hover:scale-[1.01] transition-all group/bar overflow-hidden whitespace-nowrap"
                           :class="getStageStyle(item.status, item.lagDays).classes"
                           :style="{ 
                              marginLeft: `${item.startPct}%`, 
                              width: `${item.widthPct}%` 
                           }"
                           :title="`Folio: ${item.folio}\nEstado: ${item.status}\nDías: ${item.lagDays}\nSolicitante: ${item.solicitante}`"
                      >
                         <!-- Status Icons inside Bar -->
                         <PauseCircleIcon v-if="item.status === 'ON_HOLD'" class="w-3 h-3 mr-1" />
                         <CheckCircleIcon v-if="item.status === 'RECEIVED'" class="w-3 h-3 mr-1" />
                         
                         <!-- Label -->
                         <span v-if="item.widthPct > 5" class="drop-shadow-md mr-1 opacity-95">{{ item.folio }}</span>
                         
                         <!-- Details on Hover -->
                         <div v-if="item.widthPct > 15" class="opacity-0 group-hover/bar:opacity-100 transition-opacity ml-auto flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded text-[9px]">
                            <ClockIcon class="w-3 h-3" /> {{ item.lagDays }}d
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <!-- Empty State -->
             <div v-if="data.swimlanes.length === 0" class="p-10 text-center text-slate-400">
                No hay actividad registrada en este mes.
             </div>
          </div>
       </div>

       <!-- LEGEND FOOTER -->
       <div class="mt-6 flex flex-wrap gap-4 justify-center text-xs text-slate-500">
          <!-- Ops -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-amber-400 rounded border border-amber-500"></div>
             <span>Ops</span>
          </div>
          <!-- Fiscal -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-blue-400 rounded border border-blue-500"></div>
             <span>Fiscal</span>
          </div>
          <!-- Treasury -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-indigo-500 rounded border border-indigo-600"></div>
             <span>Por Pagar</span>
          </div>
          <!-- On Hold -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-fuchsia-500 rounded border border-fuchsia-600"></div>
             <span>Retenido</span>
          </div>
          <!-- Processed -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-teal-400 rounded border border-teal-500"></div>
             <span>Pagado (Tránsito)</span>
          </div>
          <!-- Received -->
          <div class="flex items-center gap-2">
             <div class="w-4 h-4 bg-emerald-600 rounded border border-emerald-700"></div>
             <span>Finalizado</span>
          </div>
          
          <div class="flex items-center gap-2 ml-4">
             <ExclamationCircleIcon class="w-4 h-4 text-rose-600" />
             <span class="font-bold text-rose-600">Alerta de Atraso (>5 días)</span>
          </div>
       </div>
    </div>
  </div>

  <!-- Normal User View Fallback (If logic fails, just empty div as redirection handles it) -->
  <div v-else></div>
</template>

<style scoped>
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
</style>