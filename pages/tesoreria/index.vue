<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Tesorería</h2>
        <p class="text-slate-500 text-sm mt-1">Procesa los pagos de reembolsos aprobados (con múltiples conceptos)</p>
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

    <div v-if="!loading && items.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
      <CheckCircleIcon class="w-16 h-16 text-green-400 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-slate-700 mb-2">Sin pagos pendientes</h3>
      <p class="text-slate-500">No hay solicitudes aprobadas esperando pago.</p>
    </div>

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
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Administrador</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Conceptos</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Total</th>
            <th class="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Archivo</th>
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
                {{ item.plantel || '—' }}
              </span>
            </td>
            <td class="px-4 py-4">
              <div class="font-medium text-slate-700">{{ item.folio }}</div>
              <div class="text-xs text-slate-500">{{ formatDate(item.fechaISO) }}</div>
            </td>
            <td class="px-4 py-4 text-sm text-slate-600">{{ item.solicitante || '—' }}</td>
            <td class="px-4 py-4 text-sm text-slate-600">
              <div class="font-semibold text-slate-800">{{ item.conceptos?.length || 0 }}</div>
              <div class="text-xs text-slate-500 truncate max-w-[260px]">
                {{ conceptoPreview(item) }}
              </div>
            </td>
            <td class="px-4 py-4 font-mono font-bold text-slate-800">${{ formatAmount(item.total) }}</td>
            <td class="px-4 py-4">
              <a
                v-if="item.file_url"
                :href="`/uploads/${item.file_url}`"
                target="_blank"
                class="text-indigo-600 hover:text-indigo-800 text-sm"
              >
                Ver
              </a>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-4 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
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

    <!-- Print Preview -->
    <div v-if="showPrintPreview" class="fixed inset-0 z-50 bg-white overflow-auto print:relative print:overflow-visible">
      <div class="p-8 max-w-5xl mx-auto">
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

        <div class="print-content">
          <div
            v-for="(r, idx) in printData?.items || []"
            :key="r.id"
            class="sheet"
            :class="{ 'sheet-last': idx === (printData?.items?.length || 1) - 1 }"
          >
            <div class="sheet-header">
              <div class="sheet-logo">[LOGO IEDIS]</div>
              <div class="sheet-org">
                <div class="sheet-org-name">INSTITUTO EDUCATIVO PARA EL DESARROLLO INTEGRAL DEL SABER S.C</div>
                <div class="sheet-org-title">REEMBOLSO DE CAJA DEDUCIBLE</div>
              </div>
            </div>

            <div class="sheet-meta">
              <div><span class="k">PLANTEL:</span> <span class="v">{{ r.plantel || '—' }}</span></div>
              <div><span class="k">NOMBRE DEL ADMINISTRADOR:</span> <span class="v">{{ r.solicitante || '—' }}</span></div>
              <div><span class="k">FECHA:</span> <span class="v">{{ formatDate(r.fechaISO) }}</span></div>
            </div>

            <div class="sheet-table-wrap">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>FACTURA</th>
                    <th>PROVEEDOR</th>
                    <th>CONCEPTO</th>
                    <th>DESCRIPCION</th>
                    <th class="right">MONTO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in r.conceptos" :key="c.id">
                    <td>{{ c.invoice_date || '' }}</td>
                    <td>{{ c.invoice_number || '' }}</td>
                    <td>{{ c.provider || '' }}</td>
                    <td>{{ c.concept || '' }}</td>
                    <td>{{ c.description || '' }}</td>
                    <td class="right mono">${{ formatAmount(c.amount) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="total-row">
                    <td colspan="5" class="right"><strong>DESCRIPCION: TOTAL</strong></td>
                    <td class="right mono"><strong>${{ formatAmount(r.total) }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="sheet-sign">
              <div class="sign-col">
                <div class="sign-line"></div>
                <div class="sign-text">ENTREGA ADMINISTRADOR</div>
              </div>
              <div class="sign-col">
                <div class="sign-line"></div>
                <div class="sign-text">RECIBE: L. MAXIMINA CARMONA RANGEL</div>
              </div>
            </div>
          </div>

          <div class="print-summary print:hidden mt-6 text-sm text-slate-600">
            Generado: {{ printData ? new Date(printData.generatedAtISO).toLocaleString('es-MX') : '' }}
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
} from '@heroicons/vue/24/outline'

import type { Reembolso } from '~/types/reembolso'

definePageMeta({ middleware: 'auth' })

const items = ref<Reembolso[]>([])
const loading = ref(true)
const selectedIds = ref<string[]>([])
const showProcessModal = ref(false)
const showPrintPreview = ref(false)
const paymentRef = ref('')
const processing = ref(false)
const printData = ref<any>(null)

const allSelected = computed(() => {
  return items.value.length > 0 && selectedIds.value.length === items.value.length
})

const selectedTotal = computed(() => {
  return items.value
    .filter(i => selectedIds.value.includes(i.id))
    .reduce((sum, i) => sum + Number(i.total || 0), 0)
})

const formatDate = (dateStr: string) => {
  try { return new Date(dateStr).toLocaleDateString('es-MX') } catch { return dateStr }
}

const formatAmount = (amount: any) => {
  return parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
}

function conceptoPreview(r: Reembolso) {
  const first = r.conceptos?.[0]
  if (!first) return '—'
  const parts = [first.provider || '', first.invoice_number || '', first.concept || ''].filter(Boolean)
  return parts.join(' · ') || '—'
}

const fetchItems = async () => {
  loading.value = true
  try {
    const res = await $fetch<{ items: Reembolso[] }>('/api/reembolsos', {
      params: { estado: 'aprobado' }
    })
    items.value = res.items || []
    selectedIds.value = []
  } catch (error) {
    console.error('Error:', error)
  } finally {
    loading.value = false
  }
}

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = items.value.map(i => i.id)
  }
}

const toggleItem = (id: string) => {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) selectedIds.value.push(id)
  else selectedIds.value.splice(index, 1)
}

const batchPrint = async () => {
  if (selectedIds.value.length === 0) return

  try {
    const result = await $fetch('/api/reembolsos/batch', {
      method: 'POST',
      body: { action: 'print', ids: selectedIds.value }
    })
    printData.value = (result as any).data
    showPrintPreview.value = true
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al generar impresión')
  }
}

const printPage = () => window.print()

const openBatchProcessModal = () => {
  if (selectedIds.value.length === 0) return
  paymentRef.value = ''
  showProcessModal.value = true
}

const confirmBatchProcess = async () => {
  processing.value = true
  try {
    await $fetch('/api/reembolsos/batch', {
      method: 'POST',
      body: {
        action: 'process',
        ids: selectedIds.value,
        paymentRef: paymentRef.value || undefined
      }
    })
    showProcessModal.value = false
    await fetchItems()
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al procesar')
  } finally {
    processing.value = false
  }
}

const processSingle = async (item: Reembolso) => {
  if (!confirm(`¿Marcar como pagado ${item.folio} por $${formatAmount(item.total)}?`)) return

  processing.value = true
  try {
    await $fetch('/api/reembolsos/action', {
      method: 'POST',
      body: { id: item.id, action: 'PROCESS' }
    })
    await fetchItems()
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al procesar')
  } finally {
    processing.value = false
  }
}

onMounted(fetchItems)
</script>

<style>
@media print {
  body * { visibility: hidden; }
  .print-content, .print-content * { visibility: visible; }
  .print-content {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
}

/* Hoja (aprox al layout solicitado) */
.sheet {
  border: 2px solid #0f172a;
  padding: 16px;
  margin-bottom: 18px;
  page-break-after: always;
}
.sheet.sheet-last { page-break-after: auto; }

.sheet-header {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.sheet-logo {
  border: 1px solid #94a3b8;
  color: #334155;
  font-weight: 800;
  font-size: 12px;
  padding: 10px;
  text-align: center;
}
.sheet-org-name {
  font-weight: 900;
  text-align: center;
  font-size: 13px;
}
.sheet-org-title {
  font-weight: 900;
  text-align: center;
  margin-top: 4px;
  font-size: 14px;
}

.sheet-meta {
  border-top: 1px solid #0f172a;
  border-bottom: 1px solid #0f172a;
  padding: 10px 0;
  margin-bottom: 10px;
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.sheet-meta .k { font-weight: 800; }
.sheet-meta .v { font-weight: 600; }

.sheet-table-wrap {
  border: 1px solid #0f172a;
}
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.sheet-table th, .sheet-table td {
  border: 1px solid #0f172a;
  padding: 6px 6px;
  vertical-align: top;
}
.sheet-table thead th {
  background: #f8fafc;
  font-weight: 900;
}
.sheet-table .right { text-align: right; }
.sheet-table .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.total-row td {
  background: #f8fafc;
}

.sheet-sign {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  font-size: 11px;
}
.sign-col { text-align: center; }
.sign-line { border-top: 1px solid #0f172a; margin-top: 34px; }
.sign-text { margin-top: 6px; font-weight: 700; }
</style>