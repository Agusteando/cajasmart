<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Revisión Operativa</h2>
        <p class="text-slate-500 text-sm mt-1">Valida las solicitudes de reembolso pendientes</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-slate-500">
          {{ items.length }} solicitud(es) pendiente(s)
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && items.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
      <CheckCircleIcon class="w-16 h-16 text-green-400 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-slate-700 mb-2">¡Todo al día!</h3>
      <p class="text-slate-500">No hay solicitudes pendientes de revisión operativa.</p>
    </div>

    <!-- Items Grid -->
    <div v-else class="grid gap-4">
      <div 
        v-for="item in items" 
        :key="item.id"
        class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition"
      >
        <div class="flex">
          <!-- Left: Details -->
          <div class="flex-1 p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="font-bold text-lg text-slate-800">{{ item.concept }}</h3>
                <p class="text-slate-500 text-sm">{{ item.provider }} · {{ item.invoice_number }}</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-slate-800">${{ formatAmount(item.amount) }}</p>
                <p class="text-xs text-slate-500">{{ formatDate(item.invoice_date) }}</p>
              </div>
            </div>

            <div class="flex items-center gap-6 text-sm text-slate-600 mb-4">
              <div class="flex items-center gap-2">
                <BuildingOfficeIcon class="w-4 h-4 text-slate-400" />
                {{ item.plantel_nombre }}
              </div>
              <div class="flex items-center gap-2">
                <UserIcon class="w-4 h-4 text-slate-400" />
                {{ item.solicitante_nombre }}
              </div>
            </div>

            <p v-if="item.description" class="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
              {{ item.description }}
            </p>

            <!-- Actions -->
            <div class="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                @click="openApproveModal(item)"
                class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <CheckIcon class="w-5 h-5" />
                Aprobar
              </button>
              <button
                @click="openRejectModal(item)"
                class="flex-1 bg-red-50 text-red-600 py-2 px-4 rounded-lg font-medium hover:bg-red-100 transition flex items-center justify-center gap-2"
              >
                <XMarkIcon class="w-5 h-5" />
                Devolver
              </button>
            </div>
          </div>

          <!-- Right: File Preview -->
          <div class="w-64 bg-slate-100 border-l border-slate-200 p-4">
            <p class="text-xs font-medium text-slate-500 uppercase mb-2">Factura</p>
            <a 
              v-if="item.file_url"
              :href="`/uploads/${item.file_url}`"
              target="_blank"
              class="block bg-white rounded-lg border border-slate-200 p-4 hover:border-indigo-300 transition text-center"
            >
              <DocumentIcon class="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <span class="text-xs text-indigo-600 font-medium">Ver documento</span>
            </a>
            <div v-else class="bg-white rounded-lg border border-slate-200 p-4 text-center">
              <ExclamationTriangleIcon class="w-12 h-12 text-amber-400 mx-auto mb-2" />
              <span class="text-xs text-slate-500">Sin archivo</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <Teleport to="body">
      <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showRejectModal = false"></div>
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div class="bg-red-50 px-6 py-4 border-b border-red-100">
            <h3 class="font-bold text-lg text-red-800">Devolver Solicitud</h3>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-slate-600">
              Esta solicitud será devuelta a <strong>{{ selectedItem?.solicitante_nombre }}</strong> para corrección.
            </p>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Motivo de devolución *</label>
              <textarea
                v-model="rejectReason"
                placeholder="Explica qué debe corregirse..."
                rows="4"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
              ></textarea>
            </div>
            <div class="flex justify-end gap-3">
              <button 
                @click="showRejectModal = false"
                class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button 
                @click="confirmReject"
                :disabled="!rejectReason.trim() || processing"
                class="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-300"
              >
                {{ processing ? 'Procesando...' : 'Confirmar Devolución' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { 
  CheckCircleIcon, 
  CheckIcon, 
  XMarkIcon, 
  BuildingOfficeIcon, 
  UserIcon,
  DocumentIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline';

definePageMeta({ middleware: 'auth' });

const items = ref<any[]>([]);
const loading = ref(true);
const showRejectModal = ref(false);
const selectedItem = ref<any>(null);
const rejectReason = ref('');
const processing = ref(false);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-MX');
};

const formatAmount = (amount: any) => {
  return parseFloat(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 });
};

const fetchItems = async () => {
  loading.value = true;
  try {
    items.value = await $fetch('/api/reimbursements', {
      params: { status: 'PENDING_OPS_REVIEW' }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    loading.value = false;
  }
};

const openApproveModal = async (item: any) => {
  if (!confirm(`¿Aprobar esta solicitud de $${formatAmount(item.amount)}?\n\nSe enviará a revisión fiscal.`)) return;
  
  processing.value = true;
  try {
    await $fetch('/api/reimbursements/action', {
      method: 'POST',
      body: { id: item.id, action: 'APPROVE' }
    });
    await fetchItems();
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al aprobar');
  } finally {
    processing.value = false;
  }
};

const openRejectModal = (item: any) => {
  selectedItem.value = item;
  rejectReason.value = '';
  showRejectModal.value = true;
};

const confirmReject = async () => {
  if (!rejectReason.value.trim()) return;

  processing.value = true;
  try {
    await $fetch('/api/reimbursements/action', {
      method: 'POST',
      body: { 
        id: selectedItem.value.id, 
        action: 'RETURN',
        reason: rejectReason.value
      }
    });
    showRejectModal.value = false;
    await fetchItems();
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al devolver');
  } finally {
    processing.value = false;
  }
};

onMounted(fetchItems);
</script>
