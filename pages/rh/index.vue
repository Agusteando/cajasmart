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
            {{ generating ? 'Generando PDF...' : 'Imprimir Lote Oficial' }}
         </button>
      </div>
    </div>

    <!-- Stats / Info -->
    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
       <div class="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <ArchiveBoxIcon class="w-8 h-8" />
       </div>
       <div>
          <h3 class="font-bold text-lg text-slate-800">Archivo Digital</h3>
          <p class="text-slate-500 text-sm">
             Seleccione las solicitudes <span class="font-bold text-emerald-600">PAGADAS (PROCESSED)</span> para generar el expediente físico/digital.
             El sistema fusionará automáticamente la carátula con las facturas adjuntas.
          </p>
       </div>
    </div>

    <!-- Table -->
    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
       <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 class="font-bold text-slate-700">Solicitudes Procesadas</h3>
          <button @click="toggleSelectAll" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
             {{ allSelected ? 'Deseleccionar todo' : 'Seleccionar todo visible' }}
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
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-700">
                   {{ fmtMoney(item.total) }}
                </td>
             </tr>
             <tr v-if="items.length === 0">
                <td colspan="5" class="p-8 text-center text-slate-400">No hay solicitudes procesadas pendientes de archivo.</td>
             </tr>
          </tbody>
       </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PrinterIcon, ArchiveBoxIcon, CheckIcon } from '@heroicons/vue/24/outline';

const items = ref<any[]>([]);
const selectedIds = ref<string[]>([]);
const loading = ref(true);
const generating = ref(false);

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const fetchItems = async () => {
   loading.value = true;
   try {
      // RH views 'pagado' (PROCESSED) items
      const res = await $fetch<any>('/api/reimbursements', { params: { estado: 'pagado' } });
      items.value = res.items || [];
   } finally {
      loading.value = false;
   }
};

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
      // Fetch binary PDF directly
      const blob = await $fetch<Blob>('/api/reimbursements/pdf-batch', {
         method: 'POST',
         body: { ids: selectedIds.value },
         responseType: 'blob' // Important for Nuxt 3 to handle binary response
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CajaSmart_Batch_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
   } catch (e: any) {
      alert('Error al generar PDF: ' + (e.message || 'Desconocido'));
   } finally {
      generating.value = false;
   }
};

onMounted(fetchItems);
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