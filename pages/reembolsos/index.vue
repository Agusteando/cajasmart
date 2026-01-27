<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Solicitudes de Reembolso</h2>
        <p class="text-slate-500 text-sm mt-1">Crea, corrige y da seguimiento a tus reembolsos</p>
      </div>

      <button
        v-if="canCreate"
        @click="openCreateModal"
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm font-semibold"
      >
        + Nueva Solicitud
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col md:flex-row gap-3">
      <input
        v-model="search"
        placeholder="Buscar por concepto, proveedor o factura..."
        class="border border-slate-300 p-2 rounded-lg w-full md:w-1/2 outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select
        v-model="statusFilter"
        class="border border-slate-300 p-2 rounded-lg w-full md:w-1/4 outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Todos los estatus</option>
        <option value="DRAFT">Borrador</option>
        <option value="PENDING_OPS_REVIEW">Revisión Operativa</option>
        <option value="PENDING_FISCAL_REVIEW">Revisión Fiscal</option>
        <option value="RETURNED">Regresado</option>
        <option value="APPROVED">Aprobado (por pagar)</option>
        <option value="PROCESSED">Pagado</option>
      </select>

      <button
        @click="fetchItems"
        class="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-800"
      >
        Actualizar
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 text-slate-600 uppercase text-xs border-b border-slate-200">
          <tr>
            <th class="p-4">Factura/Fecha</th>
            <th class="p-4">Plantel</th>
            <th class="p-4">Concepto</th>
            <th class="p-4">Monto</th>
            <th class="p-4">Estatus</th>
            <th class="p-4 text-right">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-slate-50">
            <td class="p-4">
              <div class="font-bold text-slate-700">{{ item.invoice_number || `#${item.id}` }}</div>
              <div class="text-xs text-slate-500">{{ formatDate(item.invoice_date) }}</div>
            </td>

            <td class="p-4 text-sm">
              <div class="font-medium text-slate-700">{{ item.plantel_codigo || '—' }}</div>
              <div class="text-xs text-slate-500">{{ item.plantel_nombre || '—' }}</div>
            </td>

            <td class="p-4">
              <div class="font-medium text-slate-800">{{ item.concept }}</div>
              <div class="text-xs text-slate-500 truncate max-w-[280px]">
                {{ item.provider }} · {{ item.description || '' }}
              </div>
              <div v-if="item.status === 'RETURNED' && item.rejection_reason" class="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">
                <span class="font-bold">Observaciones:</span> {{ item.rejection_reason }}
              </div>
            </td>

            <td class="p-4 font-mono font-bold text-slate-800">
              ${{ formatMoney(item.amount) }}
            </td>

            <td class="p-4">
              <span :class="badgeClass(item.status)" class="px-2 py-1 rounded text-xs font-bold border">
                {{ formatStatus(item.status) }}
              </span>
            </td>

            <td class="p-4 text-right space-x-2">
              <a
                v-if="item.file_url"
                :href="`/uploads/${item.file_url}`"
                target="_blank"
                class="text-indigo-700 text-xs font-semibold underline"
              >
                Ver archivo
              </a>

              <button
                v-if="canEdit(item)"
                @click="openEditModal(item)"
                class="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-bold hover:bg-slate-200"
              >
                Editar
              </button>

              <button
                v-if="canSubmit(item)"
                @click="quickSubmit(item)"
                class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold hover:bg-emerald-200"
              >
                Enviar
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filteredItems.length === 0">
            <td colspan="6" class="p-10 text-center text-slate-500">
              Sin resultados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-800">
              {{ editingId ? 'Editar solicitud' : 'Nueva solicitud' }}
            </h3>
            <button @click="closeModal" class="text-slate-500 hover:text-slate-700 font-bold">✕</button>
          </div>

          <div class="p-6 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1">Fecha de factura</label>
                <input v-model="form.date" type="date" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1">Número de factura</label>
                <input v-model="form.invoice" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: A-1234" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1">Proveedor</label>
                <input v-model="form.provider" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Proveedor" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1">Monto</label>
                <input v-model="form.amount" type="number" step="0.01" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Concepto</label>
              <input v-model="form.concept" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Concepto corto" />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Descripción / Justificación</label>
              <textarea v-model="form.desc" rows="3" class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Justificación detallada (por qué)"></textarea>
            </div>

            <div class="bg-amber-50 text-amber-900 border border-amber-100 rounded-xl p-3 text-xs">
              ⚠️ La factura debe estar escaneada con las <strong>3 firmas</strong> para justificar el gasto.
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Archivo (PDF/imagen)</label>
              <input type="file" @change="handleFile" class="w-full text-sm" />
              <div v-if="editingId && existingFileUrl" class="text-xs text-slate-500 mt-2">
                Archivo actual:
                <a :href="`/uploads/${existingFileUrl}`" target="_blank" class="text-indigo-700 underline font-semibold">
                  ver
                </a>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              @click="closeModal"
              class="px-4 py-2 rounded-lg text-slate-700 font-semibold hover:bg-slate-100"
              :disabled="saving"
            >
              Cancelar
            </button>

            <button
              @click="saveDraft"
              class="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
              :disabled="saving"
            >
              {{ saving ? 'Guardando...' : 'Guardar borrador' }}
            </button>

            <button
              @click="submitToReview"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              :disabled="saving"
            >
              {{ saving ? 'Enviando...' : 'Enviar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useUserCookie } from '~/composables/useUserCookie';

definePageMeta({ middleware: 'auth' });

const userCookie = useUserCookie();
const user = computed(() => userCookie.value);

const items = ref<any[]>([]);
const loading = ref(false);

const search = ref('');
const statusFilter = ref('');

const showModal = ref(false);
const saving = ref(false);

const editingId = ref<number | null>(null);
const existingFileUrl = ref<string>('');

const form = ref({
  date: '',
  invoice: '',
  provider: '',
  amount: '',
  concept: '',
  desc: ''
});

const fileData = ref<File | null>(null);

const canCreate = computed(() => {
  const r = user.value?.role_name;
  return r ? ['ADMIN_PLANTEL', 'SUPER_ADMIN'].includes(r) : false;
});

const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-MX') : '—');

const formatMoney = (val: any) =>
  Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

const formatStatus = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'BORRADOR',
    PENDING_OPS_REVIEW: 'REVISIÓN OPS',
    PENDING_FISCAL_REVIEW: 'REVISIÓN FISCAL',
    RETURNED: 'REGRESADO',
    APPROVED: 'APROBADO',
    PROCESSED: 'PAGADO'
  };
  return map[s] || String(s || '').replace(/_/g, ' ');
};

const badgeClass = (s: string) => {
  switch (s) {
    case 'PROCESSED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'APPROVED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'RETURNED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'PENDING_OPS_REVIEW':
    case 'PENDING_FISCAL_REVIEW':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'DRAFT':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const filteredItems = computed(() => {
  const q = (search.value || '').trim().toLowerCase();
  return items.value.filter((i: any) => {
    const matchesSearch =
      !q ||
      String(i.concept || '').toLowerCase().includes(q) ||
      String(i.provider || '').toLowerCase().includes(q) ||
      String(i.invoice_number || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter.value ? i.status === statusFilter.value : true;
    return matchesSearch && matchesStatus;
  });
});

const canEdit = (item: any) => {
  const r = user.value?.role_name;
  if (!r || !['ADMIN_PLANTEL', 'SUPER_ADMIN'].includes(r)) return false;
  return ['DRAFT', 'RETURNED'].includes(String(item.status));
};

const canSubmit = (item: any) => canEdit(item) && !!item.id;

const fetchItems = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (statusFilter.value) params.status = statusFilter.value;
    items.value = await $fetch('/api/reimbursements', { params });
  } catch (e: any) {
    console.error(e);
    alert(e?.data?.statusMessage || 'No se pudo cargar');
  } finally {
    loading.value = false;
  }
};

const handleFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  fileData.value = input.files?.[0] || null;
};

const openCreateModal = () => {
  editingId.value = null;
  existingFileUrl.value = '';
  form.value = { date: '', invoice: '', provider: '', amount: '', concept: '', desc: '' };
  fileData.value = null;
  showModal.value = true;
};

const openEditModal = (item: any) => {
  editingId.value = Number(item.id);
  existingFileUrl.value = String(item.file_url || '');
  form.value = {
    date: item.invoice_date ? String(item.invoice_date).slice(0, 10) : '',
    invoice: String(item.invoice_number || ''),
    provider: String(item.provider || ''),
    amount: String(item.amount || ''),
    concept: String(item.concept || ''),
    desc: String(item.description || '')
  };
  fileData.value = null;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

function buildFormData(action: 'DRAFT' | 'SUBMIT') {
  const fd = new FormData();
  fd.append('date', form.value.date || '');
  fd.append('invoice', form.value.invoice || '');
  fd.append('provider', form.value.provider || '');
  fd.append('amount', String(form.value.amount || ''));
  fd.append('concept', form.value.concept || '');
  fd.append('desc', form.value.desc || '');
  fd.append('action', action);

  if (fileData.value) fd.append('file', fileData.value);
  if (editingId.value) fd.append('id', String(editingId.value));

  return fd;
}

const saveDraft = async () => {
  saving.value = true;
  try {
    const fd = buildFormData('DRAFT');
    if (editingId.value) {
      await $fetch('/api/reimbursements/update', { method: 'POST', body: fd });
    } else {
      await $fetch('/api/reimbursements', { method: 'POST', body: fd });
    }
    showModal.value = false;
    await fetchItems();
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Error al guardar borrador');
  } finally {
    saving.value = false;
  }
};

const submitToReview = async () => {
  saving.value = true;
  try {
    const fd = buildFormData('SUBMIT');
    if (editingId.value) {
      await $fetch('/api/reimbursements/update', { method: 'POST', body: fd });
    } else {
      await $fetch('/api/reimbursements', { method: 'POST', body: fd });
    }
    showModal.value = false;
    await fetchItems();
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Error al enviar');
  } finally {
    saving.value = false;
  }
};

const quickSubmit = async (item: any) => {
  // quick submit uses the same modal semantics: force user to ensure file exists if needed
  openEditModal(item);
};

onMounted(fetchItems);
</script>
