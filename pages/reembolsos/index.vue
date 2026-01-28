<!-- pages/reembolsos/index.vue -->
<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Reembolsos</h1>
        <p class="text-sm text-slate-600">
          Administra solicitudes de reembolso y adjunta evidencia (PDF/imagen).
        </p>
      </div>

      <button
        v-if="canCreate"
        @click="openCreate()"
        class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
      >
        Nuevo reembolso
      </button>
    </div>

    <div v-if="loadError" class="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
      {{ loadError }}
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div class="flex gap-2 items-center">
          <input
            v-model="q"
            class="w-full md:w-80 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Buscar (proveedor, factura, concepto)…"
            @keyup.enter="refresh()"
          />
          <button
            class="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
            @click="refresh()"
          >
            Buscar
          </button>
        </div>

        <div class="flex gap-2 items-center">
          <select
            v-model="statusFilter"
            class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            @change="refresh()"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
          </select>

          <button
            class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-bold hover:bg-slate-100"
            @click="resetFilters()"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr class="text-left">
              <th class="px-4 py-3 font-bold">Fecha</th>
              <th class="px-4 py-3 font-bold">Factura</th>
              <th class="px-4 py-3 font-bold">Proveedor</th>
              <th class="px-4 py-3 font-bold">Monto</th>
              <th class="px-4 py-3 font-bold">Estatus</th>
              <th class="px-4 py-3 font-bold">Archivo</th>
              <th class="px-4 py-3 font-bold w-40">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-6 text-slate-500">Cargando…</td>
            </tr>

            <tr v-else-if="items.length === 0">
              <td colspan="7" class="px-4 py-6 text-slate-500">Sin resultados.</td>
            </tr>

            <tr
              v-else
              v-for="it in items"
              :key="it.id"
              class="border-t border-slate-100 hover:bg-slate-50"
            >
              <td class="px-4 py-3">
                <span class="font-semibold text-slate-800">{{ fmtDate(it.date) }}</span>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.invoice_number || '—' }}</div>
                <div class="text-xs text-slate-500">{{ it.concept || '—' }}</div>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.provider || '—' }}</div>
              </td>

              <td class="px-4 py-3">
                <span class="font-black text-slate-900">{{ fmtMoney(it.amount) }}</span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border"
                  :class="statusBadgeClass(it.status)"
                >
                  {{ statusLabel(it.status) }}
                </span>
              </td>

              <td class="px-4 py-3">
                <a
                  v-if="it.file_url"
                  class="text-indigo-700 underline font-semibold"
                  :href="`/uploads/${it.file_url}`"
                  target="_blank"
                >
                  ver
                </a>
                <span v-else class="text-slate-400">—</span>
              </td>

              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 disabled:opacity-50"
                    :disabled="!canEdit(it)"
                    @click="openEdit(it)"
                  >
                    Editar
                  </button>

                  <button
                    class="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                    :disabled="!canDelete(it) || deletingId === it.id"
                    @click="remove(it)"
                  >
                    {{ deletingId === it.id ? 'Eliminando…' : 'Eliminar' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      @click.self="closeModal()"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div class="font-black text-lg">
            {{ editingId ? 'Editar reembolso' : 'Nuevo reembolso' }}
          </div>
          <button class="text-white/80 hover:text-white font-bold" @click="closeModal()">✕</button>
        </div>

        <div class="p-6 space-y-4">
          <!-- NEW: CFDI QR Scanner -->
          <div v-if="canCreate" class="space-y-2">
            <CfdiQrScanner
              @prefill="applyCfdiPrefill"
              @debug="lastCfdiDebug = $event"
            />
            <div v-if="lastCfdiDebug?.satMeta || lastCfdiDebug?.parsed" class="text-xs text-slate-500">
              <span class="font-semibold">CFDI:</span>
              <span class="ml-1 font-mono">
                {{ lastCfdiDebug?.parsed?.uuid || '—' }}
              </span>
              <span class="ml-2" v-if="lastCfdiDebug?.satMeta?.status">({{ lastCfdiDebug.satMeta.status }})</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Fecha de factura</label>
              <input
                v-model="form.date"
                type="date"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Número de factura</label>
              <input
                v-model="form.invoice"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: A-1234"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Proveedor</label>
              <input
                v-model="form.provider"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Proveedor"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Monto</label>
              <input
                v-model="form.amount"
                type="number"
                step="0.01"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Concepto</label>
            <input
              v-model="form.concept"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Concepto corto"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Descripción / Justificación</label>
            <textarea
              v-model="form.desc"
              rows="3"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Justificación detallada (por qué)"
            ></textarea>
          </div>

          <div class="bg-amber-50 text-amber-900 border border-amber-100 rounded-xl p-3 text-xs">
            ⚠️ La factura debe estar escaneada con las <strong>3 firmas</strong> para justificar el gasto.
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Archivo (PDF/imagen)</label>
            <input type="file" @change="handleFile" class="w-full text-sm" />
            <div v-if="editingId && existingFileUrl" class="text-xs text-slate-500 mt-2">
              Archivo actual:
              <a
                :href="`/uploads/${existingFileUrl}`"
                target="_blank"
                class="text-indigo-700 underline font-semibold"
              >
                ver
              </a>
            </div>
          </div>

          <div v-if="saveError" class="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
            {{ saveError }}
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            class="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold hover:bg-slate-100"
            @click="closeModal()"
            :disabled="saving"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-50"
            @click="save()"
            :disabled="saving"
          >
            {{ saving ? 'Guardando…' : (editingId ? 'Guardar cambios' : 'Crear') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

type Reimbursement = {
  id: number;
  date: string;                 // YYYY-MM-DD
  invoice_number: string | null;
  provider: string | null;
  amount: number;
  concept: string | null;
  description: string | null;
  status: Status;
  file_url: string | null;
  // optionally present in your API; safe to ignore if not:
  user_id?: number | null;
};

type Me = {
  id: number;
  role_name: string; // e.g. 'ADMIN_PLANTEL'
};

const items = ref<Reimbursement[]>([]);
const loading = ref(false);
const loadError = ref('');

const q = ref('');
const statusFilter = ref<string>('');

const me = ref<Me | null>(null);

const showModal = ref(false);
const saving = ref(false);
const saveError = ref('');

const deletingId = ref<number | null>(null);

const editingId = ref<number | null>(null);
const existingFileUrl = ref<string>('');

const selectedFile = ref<File | null>(null);

const form = ref({
  date: '',
  invoice: '',
  provider: '',
  amount: '',
  concept: '',
  desc: ''
});

// CFDI debug
const lastCfdiDebug = ref<any>(null);

const canCreate = computed(() => me.value?.role_name === 'ADMIN_PLANTEL');

// Edit/delete: keep conservative (pending-only). If your API includes user_id, it’ll also enforce owner.
function canEdit(it: Reimbursement) {
  if (!canCreate.value) return false;
  return it.status === 'PENDING';
}
function canDelete(it: Reimbursement) {
  if (!canCreate.value) return false;
  return it.status === 'PENDING';
}

function statusLabel(s: Status) {
  if (s === 'PENDING') return 'Pendiente';
  if (s === 'APPROVED') return 'Aprobado';
  return 'Rechazado';
}

function statusBadgeClass(s: Status) {
  if (s === 'PENDING') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s === 'APPROVED') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return 'bg-rose-50 text-rose-800 border-rose-200';
}

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
  } catch {
    return `$${Number(n || 0).toFixed(2)}`;
  }
}

function fmtDate(d: string) {
  if (!d) return '—';
  return d;
}

function resetFilters() {
  q.value = '';
  statusFilter.value = '';
  refresh();
}

async function loadMe() {
  // Adjust this endpoint if yours differs.
  // Expected: { id, role_name }
  me.value = await $fetch<Me>('/api/auth/me');
}

async function refresh() {
  loading.value = true;
  loadError.value = '';

  try {
    // Adjust this endpoint/shape if yours differs.
    const res = await $fetch<{ items: Reimbursement[] }>('/api/reembolsos', {
      params: {
        q: q.value || undefined,
        status: statusFilter.value || undefined
      }
    });
    items.value = res.items || [];
  } catch (e: any) {
    loadError.value = e?.data?.statusMessage || e?.message || 'No se pudo cargar.';
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  existingFileUrl.value = '';
  selectedFile.value = null;
  saveError.value = '';
  lastCfdiDebug.value = null;

  form.value = {
    date: new Date().toISOString().slice(0, 10),
    invoice: '',
    provider: '',
    amount: '',
    concept: '',
    desc: ''
  };

  showModal.value = true;
}

function openEdit(it: Reimbursement) {
  if (!canEdit(it)) return;

  editingId.value = it.id;
  existingFileUrl.value = it.file_url || '';
  selectedFile.value = null;
  saveError.value = '';
  lastCfdiDebug.value = null;

  form.value = {
    date: it.date || '',
    invoice: it.invoice_number || '',
    provider: it.provider || '',
    amount: String(it.amount ?? ''),
    concept: it.concept || '',
    desc: it.description || ''
  };

  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  saving.value = false;
  saveError.value = '';
  selectedFile.value = null;
}

function handleFile(ev: Event) {
  const input = ev.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] || null;
}

function applyCfdiPrefill(p: any) {
  if (p?.amount != null && String(p.amount) !== 'null') {
    form.value.amount = String(p.amount);
  }
  if (p?.provider) {
    form.value.provider = String(p.provider);
  }
  if (p?.invoiceNumber) {
    form.value.invoice = String(p.invoiceNumber);
  }
  if (p?.date) {
    form.value.date = String(p.date).slice(0, 10);
  }
}

async function save() {
  saveError.value = '';
  saving.value = true;

  try {
    const fd = new FormData();
    fd.set('date', form.value.date);
    fd.set('invoice_number', form.value.invoice);
    fd.set('provider', form.value.provider);
    fd.set('amount', form.value.amount);
    fd.set('concept', form.value.concept);
    fd.set('description', form.value.desc);
    if (selectedFile.value) fd.set('file', selectedFile.value);

    if (editingId.value) {
      // Adjust endpoint/method to match your API.
      await $fetch(`/api/reembolsos/${editingId.value}`, {
        method: 'PUT',
        body: fd
      });
    } else {
      // Adjust endpoint/method to match your API.
      await $fetch('/api/reembolsos', {
        method: 'POST',
        body: fd
      });
    }

    closeModal();
    await refresh();
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage || e?.message || 'No se pudo guardar.';
  } finally {
    saving.value = false;
  }
}

async function remove(it: Reimbursement) {
  if (!canDelete(it)) return;

  const ok = confirm(`¿Eliminar el reembolso #${it.id}?`);
  if (!ok) return;

  deletingId.value = it.id;
  try {
    // Adjust endpoint/method to match your API.
    await $fetch(`/api/reembolsos/${it.id}`, { method: 'DELETE' });
    await refresh();
  } catch (e: any) {
    alert(e?.data?.statusMessage || e?.message || 'No se pudo eliminar.');
  } finally {
    deletingId.value = null;
  }
}

onMounted(async () => {
  await loadMe();
  await refresh();
});
</script>
