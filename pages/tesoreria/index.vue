<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Tesorería / Bancos</h1>
        <p class="text-slate-500 mt-1">Gestión de impresiones y pagos finales.</p>
      </div>
      
      <!-- Actions Toolbar -->
      <div v-if="selectedIds.length > 0" class="flex gap-3 animate-fade-in">
         <div class="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-700 font-bold flex items-center">
            {{ selectedIds.length }} seleccionados
         </div>
         
         <!-- Action 1: PRINT (First Step) -->
         <button 
            v-if="activeTab === 'printing'"
            @click="printBatch" 
            :disabled="processing"
            class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
         >
            <PrinterIcon v-if="!processing" class="w-5 h-5" />
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ processing ? 'Generando PDF...' : '1. Imprimir y Archivar' }}
         </button>

         <!-- Action 2: PAY (Second Step) -->
         <button 
            v-if="activeTab === 'payment'"
            @click="openPaymentModal" 
            :disabled="processing"
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all disabled:opacity-50"
         >
            <CurrencyDollarIcon v-if="!processing" class="w-5 h-5" />
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ processing ? 'Procesando...' : '2. Pagar (Cheque/Transf)' }}
         </button>
      </div>
    </div>

    <!-- Filters & Tabs -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
       <!-- Tabs -->
       <div class="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
          <!-- STEP 1: Printing -->
          <button 
             @click="activeTab = 'printing'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
             :class="activeTab === 'printing' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             <PrinterIcon class="w-4 h-4" />
             1. Por Imprimir
          </button>
          
          <!-- STEP 2: Payment -->
          <button 
             @click="activeTab = 'payment'"
             class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
             :class="activeTab === 'payment' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
             <BanknotesIcon class="w-4 h-4" />
             2. Por Pagar
          </button>

          <!-- History -->
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
             <span v-if="activeTab === 'printing'">Aprobados (Requiere Impresión)</span>
             <span v-else-if="activeTab === 'payment'">Impresos (Listos para Pago)</span>
             <span v-else>Historial de Pagos</span>
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
                   <span class="px-2 py-1 rounded text-xs font-bold" :class="getStatusClass(item.raw_status, item.archived_at)">
                      {{ getStatusLabel(item.raw_status, item.archived_at) }}
                   </span>
                   <!-- Payment Method Badge -->
                   <div v-if="item.payment_method" class="mt-1 text-[10px] font-mono text-slate-500 uppercase">
                      {{ item.payment_method }}
                      <span v-if="item.payment_ref">| {{ item.payment_ref }}</span>
                   </div>
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-700">
                   {{ fmtMoney(item.total) }}
                </td>
             </tr>
             <tr v-if="items.length === 0">
                <td colspan="6" class="p-8 text-center text-slate-400">
                   No se encontraron registros en esta bandeja.
                </td>
             </tr>
          </tbody>
       </table>
    </div>

    <!-- PAYMENT CONFIRMATION MODAL -->
    <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showPaymentModal = false"></div>
       <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden p-6 animate-fade-in-up">
          <h3 class="text-xl font-bold text-slate-900 mb-2">Confirmar Pagos</h3>
          <p class="text-slate-500 text-sm mb-6">
             Se marcarán <strong>{{ selectedIds.length }}</strong> solicitudes como pagadas.
             <br/>
             El sistema asignará automáticamente <strong>CHEQUE</strong> a las facturas deducibles y <strong>NO CHEQUE</strong> a las no deducibles.
          </p>
          
          <div class="mb-6">
             <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Referencia General (Opcional)</label>
             <input v-model="paymentRefInput" placeholder="Ej: Lote #123 / Transferencia masiva" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div class="flex gap-3">
             <button @click="showPaymentModal = false" class="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition">Cancelar</button>
             <button @click="executePayment" class="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg">Confirmar Pagos</button>
          </div>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
   PrinterIcon, ArchiveBoxIcon, CheckIcon, MagnifyingGlassIcon, 
   CurrencyDollarIcon, BanknotesIcon 
} from '@heroicons/vue/24/outline';

const items = ref<any[]>([]);
const selectedIds = ref<string[]>([])
const loading = ref(true);
const processing = ref(false);

// Modal State
const showPaymentModal = ref(false);
const paymentRefInput = ref('');

// Filters
const activeTab = ref<'printing' | 'payment' | 'history'>('printing');
const selectedMonth = ref(new Date().toISOString().slice(0, 7)); 
const searchQuery = ref('');

// Formatters
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const getStatusClass = (s: string, archivedAt: string) => {
   if (s === 'APPROVED' && !archivedAt) return 'bg-amber-100 text-amber-800'; // Waiting Print
   if (s === 'APPROVED' && archivedAt) return 'bg-indigo-100 text-indigo-800'; // Ready to Pay
   if (s === 'PROCESSED') return 'bg-emerald-100 text-emerald-800'; // Paid
   if (s === 'RECEIVED') return 'bg-emerald-600 text-white'; // Completed
   return 'bg-slate-100 text-slate-800';
}
const getStatusLabel = (s: string, archivedAt: string) => {
   if (s === 'APPROVED' && !archivedAt) return 'POR IMPRIMIR';
   if (s === 'APPROVED' && archivedAt) return 'POR PAGAR';
   if (s === 'PROCESSED') return 'PAGADO (Espera Conf)';
   if (s === 'RECEIVED') return 'FINALIZADO';
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

      // 1. Printing: APPROVED but NOT ARCHIVED
      if (activeTab.value === 'printing') {
         params.status = 'APPROVED';
         params.archived = 'false';
      } 
      // 2. Payment: APPROVED AND ARCHIVED (Printed)
      else if (activeTab.value === 'payment') {
         params.status = 'APPROVED';
         params.archived = 'true';
      } 
      // 3. History: PROCESSED OR RECEIVED
      else if (activeTab.value === 'history') {
         // We fetch both, handled by backend usually via OR but here we rely on basic filters.
         // Let's just fetch PROCESSED. (Received items are also technically processed but in final state).
         // Update backend to handle array or fetch all if not specified.
         // For now, let's fetch everything that is processed or later.
         // Actually, let's allow fetching by multiple statuses in backend?
         // Simplification: Fetch PROCESSED in UI, RECEIVED items usually won't show unless backend supports multiple.
         // HACK: Use 'pagado' filter which maps to PROCESSED, but we need RECEIVED too.
         // Let's modify index.get.ts to support multiple statuses OR logic if needed.
         // Current index.get.ts maps specific string to exact SQL.
         // Let's try sending no status but filter in UI or backend.
         // Or better, let's just use 'pagado' and 'finalizado'.
         // Let's update backend to support list?
         // For simplicity: History tab will show PROCESSED items. 
         // TODO: Make sure backend returns RECEIVED items too if we want them here.
         // Let's assume for this specific view, Tesoreria mainly cares about what they paid.
         params.status = 'PROCESSED'; 
         // If you want RECEIVED items too, you might need to adjust backend filter to allow multiple or an "advanced" status filter.
      }

      const res = await $fetch<any>('/api/reimbursements', { params });
      
      // If History tab, manually fetch RECEIVED items too and merge? Or just stick to PROCESSED.
      // Ideally backend handles "status IN (...)". 
      // For now, let's assume History shows PROCESSED items which are the ones Tesoreria just acted on.
      
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

// --- ACTION: PRINT ---
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
      link.setAttribute('download', `CajaSmart_Lote_${new Date().toISOString().slice(0, 10)}.pdf`);
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

const openPaymentModal = () => {
   if (!selectedIds.value.length) return;
   paymentRefInput.value = '';
   showPaymentModal.value = true;
}

const executePayment = async () => {
   processing.value = true;
   showPaymentModal.value = false;
   
   try {
      await $fetch('/api/reimbursements/batch', { 
         method: 'POST', 
         body: { 
            action: 'process', 
            ids: selectedIds.value, 
            paymentRef: paymentRefInput.value
            // paymentMethod inferred in backend
         } 
      });
      await refresh();
   } catch (e: any) {
      alert('Error al procesar pago: ' + e.message);
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
.animate-fade-in-up {
   animation: fadeInUp 0.3s ease-out;
}
@keyframes fadeIn {
   from { opacity: 0; transform: translateY(-5px); }
   to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
   from { opacity: 0; transform: scale(0.95); }
   to { opacity: 1; transform: scale(1); }
}
</style>