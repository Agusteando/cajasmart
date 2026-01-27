<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Tesorería</h2>
        <p class="text-slate-500 text-sm mt-1">Procesa los pagos de reembolsos aprobados</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-slate-500">
          {{ items.length }} solicitud(es) lista(s) para pago
        </span>
        <div v-if="selectedIds.length > 0" class="flex gap-2">
          <button
            @click="batchPrint"
            class="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition flex items-center gap-2"
          >
            <PrinterIcon class="w-5 h-5" />
            Imprimir ({{ selectedIds.length }})
          </button>
          <button
            @click="openBatchProcessModal"
            class="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center gap-2"
          >
            <CheckIcon class="w-5 h-5" />
            Procesar ({{ selectedIds.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && items.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
      <CheckCircleIcon class="w-16 h-16 text-green-400 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-slate-700 mb-2">Sin pagos pendientes</h3>
      <p class="text-slate-500">No hay solicitudes aprobadas esperando pago.</p>
    </div>

    <!-- Items Table -->
    <div v-else class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <table class="w-full text-left">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="px-4 py-4">
              <input 
                type="checkbox" 
                :checked="allSelected"
                @change="toggleAll"
                class="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
            </th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Plantel</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Folio</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Proveedor</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Concepto</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Monto</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Solicitante</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in items" :key="item.id" class="hover:bg-green-50/50 transition">
            <td class="px-4 py-4">
              <input 
                type="checkbox" 
                :checked="selectedIds.includes(item.id)"
                @change="toggleItem(item.id)"
                class="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
            </td>
            <td class="px-4 py-4">
              <span class="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                {{ item.plantel_codigo }}
              </span>
            </td>
            <td class="px-4 py-4">
              <div class="font-medium text-slate-700">{{ item.invoice_number }}</div>
              <div class="text-xs text-slate-500">{{ formatDate(item.invoice_date) }}</div>
            </td>
            <td class="px-4 py-4 text-sm text-slate-600">{{ item.provider }}</td>
            <td class="px-4 py-4 text-sm text-slate-600 max-w-[200px] truncate">{{ item.concept }}</td>
            <td class="px-4 py-4 font-mono font-bold text-slate-800">${{ formatAmount(item.amount) }}</td>
            <td class="px-4 py-4 text-sm text-slate-600">{{ item.solicitante_nombre }}</td>
            <td class="px-4 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <a 
                  v-if="item.file_url"
                  :href="`/uploads/${item.file_url}`"
                  target="_blank"
                  class="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  Ver
                </a>
                <button
                  @click="processSingle(item)"
                  :disabled="processing"
                  class="bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-medium hover:bg-green-200 transition"
                >
                  Procesar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot class="bg-slate-50 border-t border-slate-200">
          <tr>
            <td colspan="5" class="px-4 py-4 text-right font-medium text-slate-600">
              Total Seleccionado:
            </td>
            <td class="px-4 py-4 font-mono font-bold text-lg text-green-700">
              ${{ formatAmount(selectedTotal) }}
            </td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Batch Process Modal -->
    <Teleport to="body">
      <div v-if="showProcessModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showProcessModal = false"></div>
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div class="bg-green-50 px-6 py-4 border-b border-green-100">
            <h3 class="font-bold text-lg text-green-800">Procesar Pagos</h3>
          </div>
          <div class="p-6 space-y-4">
            <div class="bg-green-50 rounded-lg p-4">
              <p class="text-sm text-green-800">
                <strong>{{ selectedIds.length }}</strong> solicitud(es) por un total de 
                <strong>${{ formatAmount(selectedTotal) }}</strong>
              </p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Referencia de Pago (opcional)</label>
              <input
                v-model="paymentRef"
                type="text"
                placeholder="Ej: TRANSFER-001234, CHEQUE-5678"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <button 
                @click="showProcessModal = false"
                class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button 
                @click="confirmBatchProcess"
                :disabled="processing"
                class="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {{ processing ? 'Procesando...' : 'Confirmar Pago' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Print Preview (hidden, for generating printable content) -->
    <div v-if="showPrintPreview" class="fixed inset-0 z-50 bg-white overflow-auto print:relative print:overflow-visible">
      <div class="p-8 max-w-4xl mx-auto">
        <div class="flex justify-between items-start mb-8 print:hidden">
          <h2 class="text-2xl font-bold">Vista Previa de Impresión</h2>
          <div class="flex gap-2">
            <button @click="printPage" class="bg-indigo-600 text-white px-4 py-2 rounded-lg">
              Imprimir
            </button>
            <button @click="showPrintPreview = false" class="text-slate-600 px-4 py-2">
              Cerrar
            </button>
          </div>
        </div>

        <!-- Print Content -->
        <div class="print-content">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold">CajaSmart - Lote de Pagos</h1>
            <p class="text-slate-500">Generado: {{ new Date().toLocaleString('es-MX') }}</p>
            <p class="text-slate-500">Por: {{ printData?.generatedBy }}</p>
          </div>

          <div class="bg-green-50 p-4 rounded-lg mb-6 text-center">
            <p class="text-lg">
              <strong>{{ printData?.totalItems }}</strong> solicitudes · 
              Total: <strong class="text-green-700">${{ printData?.totalAmount }}</strong>
            </p>
          </div>

          <table class="w-full text-left border-collapse mb-8">
            <thead>
              <tr class="border-b-2 border-slate-300">
                <th class="py-2 text-sm font-bold">Plantel</th>
                <th class="py-2 text-sm font-bold">Folio</th>
                <th class="py-2 text-sm font-bold">Proveedor</th>
                <th class="py-2 text-sm font-bold">Concepto</th>
                <th class="py-2 text-sm font-bold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in printData?.items" :key="item.id" class="border-b border-slate-200">
                <td class="py-2 text-sm">{{ item.plantelCodigo }}</td>
                <td class="py-2 text-sm">{{ item.invoiceNumber }}</td>
                <td class="py-2 text-sm">{{ item.provider }}</td>
                <td class="py-2 text-sm">{{ item.concept }}</td>
                <td class="py-2 text-sm text-right font-mono">${{ item.amount }}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-12 pt-8 border-t border-slate-200">
            <div class="grid grid-cols-2 gap-8">
              <div class="text-center">
                <div class="border-t border-slate-400 pt-2 mt-16">
                  <p class="text-sm">Elaboró</p>
                </div>
              </div>
              <div class="text-center">
                <div class="border-t border-slate-400 pt-2 mt-16">
                  <p class="text-sm">Autorizó</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  CheckCircleIcon, 
  CheckIcon, 
  PrinterIcon
} from '@heroicons/vue/24/outline';

definePageMeta({ middleware: 'auth' });

const items = ref<any[]>([]);
const loading = ref(true);
const selectedIds = ref<number[]>([]);
const showProcessModal = ref(false);
const showPrintPreview = ref(false);
const paymentRef = ref('');
const processing = ref(false);
const printData = ref<any>(null);

const allSelected = computed(() => {
  return items.value.length > 0 && selectedIds.value.length === items.value.length;
});

const selectedTotal = computed(() => {
  return items.value
    .filter(i => selectedIds.value.includes(i.id))
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
});

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-MX');
};

const formatAmount = (amount: any) => {
  return parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
};

const fetchItems = async () => {
  loading.value = true;
  try {
    items.value = await $fetch('/api/reimbursements', {
      params: { status: 'APPROVED' }
    });
    selectedIds.value = [];
  } catch (error) {
    console.error('Error:', error);
  } finally {
    loading.value = false;
  }
};

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = items.value.map(i => i.id);
  }
};

const toggleItem = (id: number) => {
  const index = selectedIds.value.indexOf(id);
  if (index === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(index, 1);
  }
};

const batchPrint = async () => {
  if (selectedIds.value.length === 0) return;

  try {
    const result = await $fetch('/api/reimbursements/batch', {
      method: 'POST',
      body: { action: 'print', ids: selectedIds.value }
    });
    printData.value = result.data;
    showPrintPreview.value = true;
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al generar impresión');
  }
};

const printPage = () => {
  window.print();
};

const openBatchProcessModal = () => {
  if (selectedIds.value.length === 0) return;
  paymentRef.value = '';
  showProcessModal.value = true;
};

const confirmBatchProcess = async () => {
  processing.value = true;
  try {
    await $fetch('/api/reimbursements/batch', {
      method: 'POST',
      body: { 
        action: 'process', 
        ids: selectedIds.value,
        paymentRef: paymentRef.value || undefined
      }
    });
    showProcessModal.value = false;
    await fetchItems();
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al procesar');
  } finally {
    processing.value = false;
  }
};

const processSingle = async (item: any) => {
  if (!confirm(`¿Marcar como pagado: $${formatAmount(item.amount)}?`)) return;

  processing.value = true;
  try {
    await $fetch('/api/reimbursements/action', {
      method: 'POST',
      body: { id: item.id, action: 'PROCESS' }
    });
    await fetchItems();
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al procesar');
  } finally {
    processing.value = false;
  }
};

onMounted(fetchItems);
</script>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  .print-content, .print-content * {
    visibility: visible;
  }
  .print-content {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
}
</style>
