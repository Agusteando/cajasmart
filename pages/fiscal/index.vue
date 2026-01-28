<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Revisión Fiscal</h2>
        <p class="text-slate-500 text-sm mt-1">Valida conceptos y justificación fiscal (por reembolso)</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-slate-500">
          {{ items.length }} solicitud(es) pendiente(s)
        </span>
      </div>
    </div>

    <div v-if="!loading && items.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
      <CheckCircleIcon class="w-16 h-16 text-emerald-400 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-slate-700 mb-2">Sin pendientes</h3>
      <p class="text-slate-500">No hay solicitudes en revisión fiscal.</p>
    </div>

    <div v-else class="grid gap-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition"
      >
        <div class="flex">
          <div class="flex-1 p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="font-bold text-lg text-slate-800">
                  {{ item.folio }} · {{ item.plantel || '—' }}
                </h3>
                <p class="text-slate-500 text-sm">
                  Admin: {{ item.solicitante || '—' }} · Fecha: {{ formatDate(item.fechaISO) }}
                </p>
                <p v-if="item.notas" class="text-slate-600 text-sm mt-2 bg-slate-50 p-3 rounded-lg">
                  <span class="font-semibold">Notas:</span> {{ item.notas }}
                </p>
              </div>

              <div class="text-right">
                <p class="text-2xl font-bold text-slate-800">${{ formatAmount(item.total) }}</p>
                <p class="text-xs text-slate-500">{{ item.conceptos?.length || 0 }} concepto(s)</p>
              </div>
            </div>

            <div class="overflow-x-auto border border-slate-200 rounded-xl">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-600">
                  <tr class="text-left">
                    <th class="px-3 py-2 font-bold">Fecha</th>
                    <th class="px-3 py-2 font-bold">Factura</th>
                    <th class="px-3 py-2 font-bold">Proveedor</th>
                    <th class="px-3 py-2 font-bold">Concepto</th>
                    <th class="px-3 py-2 font-bold">Descripción</th>
                    <th class="px-3 py-2 font-bold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in item.conceptos" :key="c.id" class="border-t border-slate-100">
                    <td class="px-3 py-2 whitespace-nowrap">{{ c.invoice_date || '—' }}</td>
                    <td class="px-3 py-2 whitespace-nowrap">{{ c.invoice_number || '—' }}</td>
                    <td class="px-3 py-2">{{ c.provider || '—' }}</td>
                    <td class="px-3 py-2">{{ c.concept || '—' }}</td>
                    <td class="px-3 py-2 text-slate-600">{{ c.description || '—' }}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold">${{ formatAmount(c.amount) }}</td>
                  </tr>
                </tbody>
                <tfoot class="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colspan="5" class="px-3 py-2 text-right font-bold text-slate-700">Total</td>
                    <td class="px-3 py-2 text-right font-mono font-black text-slate-900">
                      ${{ formatAmount(item.total) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                @click="approve(item)"
                class="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                :disabled="processing"
              >
                <CheckIcon class="w-5 h-5" />
                Aprobar (a Tesorería)
              </button>
              <button
                @click="openRejectModal(item)"
                class="flex-1 bg-rose-50 text-rose-700 py-2 px-4 rounded-lg font-medium hover:bg-rose-100 transition flex items-center justify-center gap-2"
                :disabled="processing"
              >
                <XMarkIcon class="w-5 h-5" />
                Regresar con observaciones
              </button>
            </div>
          </div>

          <div class="w-64 bg-slate-100 border-l border-slate-200 p-4">
            <p class="text-xs font-medium text-slate-500 uppercase mb-2">Evidencia</p>
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

    <Teleport to="body">
      <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showRejectModal = false"></div>
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div class="bg-rose-50 px-6 py-4 border-b border-rose-100">
            <h3 class="font-bold text-lg text-rose-800">Regresar Solicitud</h3>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-slate-600">
              Se regresará a <strong>{{ selectedItem?.solicitante }}</strong> con observaciones.
            </p>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Observaciones *</label>
              <textarea
                v-model="rejectReason"
                placeholder="Ej: Concepto no autorizado / falta justificación / monto no coincide..."
                rows="4"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none"
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
                class="px-6 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 disabled:bg-rose-300"
              >
                {{ processing ? 'Procesando...' : 'Confirmar' }}
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
  DocumentIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

import type { Reembolso } from '~/types/reembolso'

definePageMeta({ middleware: 'auth' })

const items = ref<Reembolso[]>([])
const loading = ref(true)
const showRejectModal = ref(false)
const selectedItem = ref<Reembolso | null>(null)
const rejectReason = ref('')
const processing = ref(false)

const formatDate = (dateStr: string) => {
  try { return new Date(dateStr).toLocaleDateString('es-MX') } catch { return dateStr }
}

const formatAmount = (amount: any) =>
  parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

const fetchItems = async () => {
  loading.value = true
  try {
    const res = await $fetch<{ items: Reembolso[] }>('/api/reembolsos', {
      params: { estado: 'en_revision' }
    })
    items.value = res.items || []
  } catch (error) {
    console.error('Error:', error)
  } finally {
    loading.value = false
  }
}

const approve = async (item: Reembolso) => {
  if (!confirm(`¿Aprobar fiscalmente ${item.folio} por $${formatAmount(item.total)}?\n\nSe enviará a Tesorería.`)) return

  processing.value = true
  try {
    await $fetch('/api/reembolsos/action', {
      method: 'POST',
      body: { id: item.id, action: 'APPROVE' }
    })
    await fetchItems()
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al aprobar')
  } finally {
    processing.value = false
  }
}

const openRejectModal = (item: Reembolso) => {
  selectedItem.value = item
  rejectReason.value = ''
  showRejectModal.value = true
}

const confirmReject = async () => {
  if (!rejectReason.value.trim() || !selectedItem.value) return

  processing.value = true
  try {
    await $fetch('/api/reembolsos/action', {
      method: 'POST',
      body: {
        id: selectedItem.value.id,
        action: 'RETURN',
        reason: rejectReason.value
      }
    })
    showRejectModal.value = false
    await fetchItems()
  } catch (error: any) {
    alert(error.data?.statusMessage || 'Error al regresar')
  } finally {
    processing.value = false
  }
}

onMounted(fetchItems)
</script>