<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Tesorería / Bancos</h1>
        <p class="text-slate-500 mt-1">Gestión de pagos, impresión y archivo.</p>
      </div>
      
      <!-- Actions Toolbar -->
      <div v-if="selectedIds.length > 0" class="flex gap-3 animate-fade-in">
         <div class="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-700 font-bold flex items-center">
            {{ selectedIds.length }} seleccionados
         </div>
         
         <!-- Action: PAY (Process) -->
         <button 
            v-if="activeTab === 'approval'"
            @click="confirmBatchProcess" 
            :disabled="processing"
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all disabled:opacity-50"
         >
            <CurrencyDollarIcon v-if="!processing" class="w-5 h-5" />
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ processing ? 'Procesando...' : 'Marcar PAGADO' }}
         </button>

         <!-- Action: PRINT (Archive) -->
         <button 
            v-if="activeTab !== 'approval'"
            @click="printBatch" 
            :disabled="processing"
            class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
         >
            <PrinterIcon v-if="!processing" class="w-5 h-5" />
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ processing ? 'Generando...' : (activeTab === 'printing' ? 'Imprimir y Archivar' : 'Re-Imprimir Copia') }}
         </button>
      </div>
    </div>

    <!-- Filters & Tabs -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
       <!-- Tabs -->
       <div class="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
          <button 
             @click="activeTab = 'approval'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
             :class="activeTab === 'approval' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             <BanknotesIcon class="w-4 h-4" />
             Por Pagar
          </button>
          <button 
             @click="activeTab = 'printing'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
             :class="activeTab === 'printing' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             <DocumentDuplicateIcon class="w-4 h-4" />
             Impresión / Archivo
          </button>
          <button 
             @click="activeTab = 'history'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
             :class="activeTab === 'history' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             <ArchiveBoxIcon class="w-4 h-4" />
             Historial
          </button>
       </div>

       <!-- Search & Month -->
       <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
             <MagnifyingGlassIcon class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
             <input 
               v-model="searchQuery" 
               @keyup.enter="refresh"
               placeholder="Buscar..." 
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
             <span v-if="activeTab === 'approval'">Solicitudes Aprobadas (Pendientes de Pago)</span>
             <span v-else-if="activeTab === 'printing'">Pagadas (Pendientes de Archivo Físico)</span>
             <span v-else>Historial Completo</span>
          </h3>
          <button @click="toggleSelectAll" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
             {{ allSelected ? 'Deseleccionar todo' : 'Seleccionar todo' }}
          </button>
       </div>
       
       <div v-if="loading" class="p-12 text-center text-slate-400">
          <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          Cargando datos...
       </div>

       <table v-else class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
             <tr>
                <th class="px-6 py-4 w-10"></th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Folio / Fecha</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plantel / Solicitante</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Total</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right" v-if="activeTab==='approval'">Acciones</th>
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
                   <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                         :class="item.is_deducible ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'">
                      {{ item.is_deducible ? 'Deducible' : 'No Deduc.' }}
                   </span>
                </td>
                <td class="px-6 py-4">
                   <span class="px-2 py-1 rounded text-xs font-bold" :class="getStatusClass(item.raw_status)">
                      {{ getStatusLabel(item.raw_status) }}
                   </span>
                   <div v-if="activeTab==='history' && item.archived_at" class="text-[10px] text-slate-400 mt-1">
                      Archivado: {{ fmtDate(item.archived_at) }}
                   </div>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-700">
                   {{ fmtMoney(item.total) }}
                </td>
                <td class="px-6 py-4 text-right" v-if="activeTab==='approval'">
                   <button @click.stop="processSingle(item)" class="text-emerald-600 hover:text-emerald-800 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition">
                      Pagar Indiv.
                   </button>
                </td>
             </tr>
             <tr v-if="items.length === 0">
                <td colspan="7" class="p-8 text-center text-slate-400">
                   No se encontraron registros.
                </td>
             </tr>
          </tbody>
       </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
   PrinterIcon, ArchiveBoxIcon, CheckIcon, MagnifyingGlassIcon, 
   DocumentDuplicateIcon, CurrencyDollarIcon, BanknotesIcon 
} from '@heroicons/vue/24/outline';

const items = ref<any[]>([]);
const selectedIds = ref<string[]>([]);
const loading = ref(true);
const processing = ref(false);

// Filters
const activeTab = ref<'approval' | 'printing' | 'history'>('approval');
const selectedMonth = ref(new Date().toISOString().slice(0, 7)); // Current month YYYY-MM
const searchQuery = ref('');

// Formatters
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const getStatusClass = (s: string) => {
   if (s === 'APPROVED') return 'bg-indigo-100 text-indigo-800';
   if (s === 'PROCESSED') return 'bg-emerald-100 text-emerald-800';
   return 'bg-slate-100 text-slate-800';
}
const getStatusLabel = (s: string) => {
   if (s === 'APPROVED') return 'POR PAGAR';
   if (s === 'PROCESSED') return 'PAGADO';
   return s;
}

const refresh = async () => {
   loading.value = true;
   selectedIds.value = []; 
   try {
      const params: any = { 
         q: searchQuery.value,
         month: selectedMonth.value
      };

      // Map tabs to statuses
      if (activeTab.value === 'approval') {
         params.status = 'APPROVED';
      } else if (activeTab.value === 'printing') {
         params.status = 'PROCESSED';
         params.archived = 'false';
      } else if (activeTab.value === 'history') {
         params.status = 'PROCESSED';
         params.archived = 'true';
      }

      const res = await $fetch<any>('/api/reimbursements', { params });
      items.value = res.items || [];
   } finally {
      loading.value = false;
   }
};

watch(activeTab, refresh);

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

// Action: Batch Payment
const confirmBatchProcess = async () => {
   if (!selectedIds.value.length) return;
   if (!confirm(`¿Confirmas el pago de ${selectedIds.value.length} solicitudes?`)) return;

   processing.value = true;
   try {
      // Prompt for reference optionally
      const ref = prompt('Referencia de pago / Lote (Opcional):') || '';
      
      await $fetch('/api/reimbursements/batch', { 
         method: 'POST', 
         body: { action: 'process', ids: selectedIds.value, paymentRef: ref } 
      });
      await refresh();
   } catch (e: any) {
      alert('Error: ' + e.message);
   } finally {
      processing.value = false;
   }
};

// Action: Single Payment
const processSingle = async (item: any) => {
   if (!confirm(`¿Marcar como pagado: ${item.folio}?`)) return;
   try {
      await $fetch('/api/reimbursements/action', { 
         method: 'POST', 
         body: { id: item.id, action: 'PROCESS' } 
      });
      await refresh();
   } catch (e: any) {
      alert('Error: ' + e.message);
   }
};

// Action: Print & Archive
const printBatch = async () => {
   if (!selectedIds.value.length) return;
   processing.value = true;

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
      
      if(activeTab.value === 'printing') {
         setTimeout(() => refresh(), 1000);
      }
   } catch (e: any) {
      alert('Error al generar PDF: ' + (e.message || 'Desconocido'));
   } finally {
      processing.value = false;
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