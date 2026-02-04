<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Recursos Humanos</h1>
        <p class="text-slate-500 mt-1">Gestión documental y archivo de comprobantes.</p>
      </div>
      <div v-if="selectedIds.length > 0" class="flex gap-3 animate-fade-in">
         <div class="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-700 font-bold flex items-center">
            {{ selectedIds.length }} seleccionados
         </div>
         <button 
            @click="printBatch" 
            :disabled="generating"
            class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
         >
            <PrinterIcon v-if="!generating" class="w-5 h-5" />
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ generating ? 'Procesando...' : (activeTab === 'pending' ? 'Imprimir y Archivar' : 'Re-Imprimir Copia') }}
         </button>
      </div>
    </div>

    <!-- Filters & Tabs -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
       <!-- Tabs -->
       <div class="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
          <button 
             @click="activeTab = 'pending'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
             :class="activeTab === 'pending' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             Pendientes de Archivo
          </button>
          <button 
             @click="activeTab = 'history'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
             :class="activeTab === 'history' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             Historial / Archivo
          </button>
       </div>

       <!-- Search & Month -->
       <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
             <MagnifyingGlassIcon class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
             <input 
               v-model="searchQuery" 
               @keyup.enter="refresh"
               placeholder="Buscar por folio, nombre, plantel..." 
               class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition"
             />
          </div>
          <input 
             type="month" 
             v-model="selectedMonth" 
             @change="refresh"
             class="px-4 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition text-slate-700 font-medium"
          />
       </div>
    </div>

    <!-- Table -->
    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
       <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 class="font-bold text-slate-700 flex items-center gap-2">
             <ArchiveBoxIcon v-if="activeTab === 'history'" class="w-5 h-5 text-slate-400" />
             <DocumentDuplicateIcon v-else class="w-5 h-5 text-indigo-600" />
             {{ activeTab === 'pending' ? 'Listos para Imprimir' : 'Historial de Impresiones' }}
          </h3>
          <button @click="toggleSelectAll" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
             {{ allSelected ? 'Deseleccionar todo' : 'Seleccionar todo' }}
          </button>
       </div>
       
       <div v-if="loading" class="p-12 text-center text-slate-400">
          <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          Cargando...
       </div>

       <table v-else class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
             <tr>
                <th class="px-6 py-4 w-10"></th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Folio / Fecha</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plantel / Solicitante</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase" v-if="activeTab === 'history'">Archivado</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Total</th>
             </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
             <tr v-for="item in items" :key="item.id" class="hover:bg-slate-50 transition cursor-pointer" @click="toggleItem(item.id)">
                <td class="px-6 py-4">
                   <div 
                      class="w-5 h-5 rounded border flex items-center justify-center transition"
                      :class="selectedIds.includes(item.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'"
                   >
                      <CheckIcon v-if="selectedIds.includes(item.id)" class="w-3.5 h-3.5 text-white" />
                   </div>
                </td>
                <td class="px-6 py-4">
                   <div class="font-bold text-slate-900">{{ item.folio }}</div>
                   <div class="text-xs text-slate-500">{{ fmtDate(item.fechaISO) }}</div>
                </td>
                <td class="px-6 py-4">
                   <div class="font-medium text-slate-800">{{ item.plantel }}</div>
                   <div class="text-xs text-slate-500">{{ item.solicitante }}</div>
                </td>
                <td class="px-6 py-4">
                   <span class="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800">PAGADO</span>
                </td>
                <td class="px-6 py-4" v-if="activeTab === 'history'">
                   <div class="text-xs text-slate-600 font-mono">{{ fmtDateTime(item.archived_at) }}</div>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-700">
                   {{ fmtMoney(item.total) }}
                </td>
             </tr>
             <tr v-if="items.length === 0">
                <td :colspan="activeTab === 'history' ? 6 : 5" class="p-8 text-center text-slate-400">
                   {{ activeTab === 'pending' ? 'No hay solicitudes pendientes de imprimir.' : 'No se encontraron registros en el historial con estos filtros.' }}
                </td>
             </tr>
          </tbody>
       </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PrinterIcon, ArchiveBoxIcon, CheckIcon, MagnifyingGlassIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/outline';

const items = ref<any[]>([]);
const selectedIds = ref<string[]>([]);
const loading = ref(true);
const generating = ref(false);

// Filters
const activeTab = ref<'pending' | 'history'>('pending');
const selectedMonth = ref(new Date().toISOString().slice(0, 7)); // Current month YYYY-MM
const searchQuery = ref('');

// Formatters
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '-';
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const refresh = async () => {
   loading.value = true;
   selectedIds.value = []; // Clear selections on refresh
   try {
      // Logic:
      // - Pending: Show items that are 'pagado' (PROCESSED) but NOT archived. 
      //            Month filter is optional but usually we show all pending.
      // - History: Show items that are 'pagado' AND archived. Month filter applies.
      
      const params: any = { 
         estado: 'pagado', 
         q: searchQuery.value,
         archived: activeTab.value === 'history' ? 'true' : 'false'
      };

      // Apply month filter. For pending it's usually irrelevant (we want to clear the queue), 
      // but let's allow it if user sets it.
      if (selectedMonth.value) {
         params.month = selectedMonth.value;
      }

      const res = await $fetch<any>('/api/reimbursements', { params });
      items.value = res.items || [];
   } finally {
      loading.value = false;
   }
};

// Watch for tab changes to auto-refresh
watch(activeTab, () => {
   // Optional: Reset month filter when switching to pending to see everything
   // if(activeTab.value === 'pending') selectedMonth.value = ''; 
   // But user might want to filter pending by month too.
   refresh();
});

const toggleItem = (id: string) => {
   if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter(x => x !== id);
   } else {
      selectedIds.value.push(id);
   }
};

const allSelected = computed(() => items.value.length > 0 && selectedIds.value.length === items.value.length);

const toggleSelectAll = () => {
   if (allSelected.value) selectedIds.value = [];
   else selectedIds.value = items.value.map(x => x.id);
};

const printBatch = async () => {
   if (!selectedIds.value.length) return;
   generating.value = true;

   try {
      const blob = await $fetch<Blob>('/api/reimbursements/pdf-batch', {
         method: 'POST',
         body: { ids: selectedIds.value },
         responseType: 'blob' 
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CajaSmart_Batch_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // If we are in 'pending', refresh to move them to history
      if(activeTab.value === 'pending') {
         // wait a moment for DB
         setTimeout(() => refresh(), 1000);
      }
   } catch (e: any) {
      alert('Error al generar PDF: ' + (e.message || 'Desconocido'));
   } finally {
      generating.value = false;
   }
};

onMounted(refresh);
</script>

<style scoped>
.animate-fade-in {
   animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
   from { opacity: 0; transform: translateY(-5px); }
   to { opacity: 1; transform: translateY(0); }
}
</style>