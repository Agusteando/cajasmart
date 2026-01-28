<!-- pages/reembolsos/index.vue -->
<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Reembolsos</h1>
        <p class="text-sm text-slate-600">
          Un reembolso contiene múltiples conceptos (renglones) y un total.
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
            placeholder="Buscar (plantel, admin, proveedor, factura, concepto)…"
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
            v-model="estadoFilter"
            class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            @change="refresh()"
          >
            <option value="">Todos</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="pagado">Pagado</option>
            <option value="borrador">Borrador</option>
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
              <th class="px-4 py-3 font-bold">Folio</th>
              <th class="px-4 py-3 font-bold">Plantel</th>
              <th class="px-4 py-3 font-bold">Administrador</th>
              <th class="px-4 py-3 font-bold">Conceptos</th>
              <th class="px-4 py-3 font-bold">Total</th>
              <th class="px-4 py-3 font-bold">Estatus</th>
              <th class="px-4 py-3 font-bold">Archivo</th>
              <th class="px-4 py-3 font-bold w-40">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="px-4 py-6 text-slate-500">Cargando…</td>
            </tr>

            <tr v-else-if="items.length === 0">
              <td colspan="9" class="px-4 py-6 text-slate-500">Sin resultados.</td>
            </tr>

            <tr
              v-else
              v-for="it in items"
              :key="it.id"
              class="border-t border-slate-100 hover:bg-slate-50"
            >
              <td class="px-4 py-3">
                <span class="font-semibold text-slate-800">{{ fmtDate(it.fechaISO) }}</span>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.folio }}</div>
                <div class="text-xs text-slate-500" v-if="it.notas">Con notas</div>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.plantel || '—' }}</div>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.solicitante || '—' }}</div>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ it.conceptos?.length || 0 }}</div>
                <div class="text-xs text-slate-500 truncate max-w-[260px]">
                  {{ conceptoPreview(it) }}
                </div>
              </td>

              <td class="px-4 py-3">
                <span class="font-black text-slate-900">{{ fmtMoney(it.total) }}</span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border"
                  :class="estadoBadgeClass(it.estado)"
                >
                  {{ estadoLabel(it.estado) }}
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
      <div class="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div class="font-black text-lg">
            {{ editingId ? 'Editar reembolso' : 'Nuevo reembolso' }}
          </div>
          <button class="text-white/80 hover:text-white font-bold" @click="closeModal()">✕</button>
        </div>

        <div class="p-6 space-y-4">
          <!-- CFDI QR Scanner -->
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
              <span class="ml-2">
                Se aplicará al concepto #{{ (activeConceptIdx ?? 0) + 1 }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Plantel</label>
              <input
                v-model="form.plantel"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: IEDIS Centro"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Nombre del administrador</label>
              <input
                v-model="form.solicitante"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nombre y apellido"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Fecha (encabezado)</label>
              <input
                v-model="form.fechaISO"
                type="date"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
            <textarea
              v-model="form.notas"
              rows="3"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Opcional"
            ></textarea>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div>
                <div class="font-black text-slate-900">Conceptos</div>
                <div class="text-xs text-slate-600">Cada renglón se imprime en la hoja del reembolso.</div>
              </div>
              <button
                class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100"
                @click="addConceptRow()"
              >
                + Agregar
              </button>
            </div>

            <div class="space-y-3">
              <div
                v-for="(c, idx) in form.conceptos"
                :key="c._k"
                class="bg-white border border-slate-200 rounded-xl p-3"
              >
                <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div class="md:col-span-1">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Fecha</label>
                    <input
                      v-model="c.invoice_date"
                      type="date"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>

                  <div class="md:col-span-1">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Factura</label>
                    <input
                      v-model="c.invoice_number"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="A-1234"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Proveedor</label>
                    <input
                      v-model="c.provider"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Proveedor"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Concepto</label>
                    <input
                      v-model="c.concept"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Concepto"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>

                  <div class="md:col-span-5">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                    <input
                      v-model="c.description"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Descripción / justificación"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>

                  <div class="md:col-span-1">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Monto</label>
                    <input
                      v-model="c.amount"
                      type="number"
                      step="0.01"
                      class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      @focus="activeConceptIdx = idx"
                    />
                  </div>
                </div>

                <div class="mt-3 flex items-center justify-between">
                  <div class="text-xs text-slate-500 font-mono">
                    #{{ idx + 1 }}
                  </div>
                  <button
                    class="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-50"
                    :disabled="form.conceptos.length === 1"
                    @click="removeConceptRow(idx)"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div class="text-sm text-slate-600 font-bold">Total</div>
              <div class="text-lg font-black text-slate-900">{{ fmtMoney(formTotal) }}</div>
            </div>
          </div>

          <div class="bg-amber-50 text-amber-900 border border-amber-100 rounded-xl p-3 text-xs">
            ⚠️ La evidencia (PDF/imagen) puede contener varias facturas; se adjunta <strong>1 archivo</strong> por reembolso.
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
import type { Reembolso, ReembolsoEstado, ReembolsoConcepto } from '~/types/reembolso'

type Me = {
  id: number
  role_name: string
}

type ConceptDraft = {
  _k: string
  id?: string
  invoice_date: string
  invoice_number: string
  provider: string
  concept: string
  description: string
  amount: string
}

function mkConceptDraft(): ConceptDraft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    _k: Math.random().toString(16).slice(2),
    invoice_date: today,
    invoice_number: '',
    provider: '',
    concept: '',
    description: '',
    amount: ''
  }
}

const items = ref<Reembolso[]>([])
const loading = ref(false)
const loadError = ref('')

const q = ref('')
const estadoFilter = ref<string>('')

const me = ref<Me | null>(null)

const showModal = ref(false)
const saving = ref(false)
const saveError = ref('')

const deletingId = ref<string | null>(null)

const editingId = ref<string | null>(null)
const existingFileUrl = ref<string>('')

const selectedFile = ref<File | null>(null)

// CFDI debug
const lastCfdiDebug = ref<any>(null)
const activeConceptIdx = ref<number | null>(0)

const form = ref({
  plantel: '',
  solicitante: '',
  fechaISO: '',
  notas: '',
  conceptos: [mkConceptDraft()] as ConceptDraft[],
})

const formTotal = computed(() => {
  return form.value.conceptos.reduce((acc, c) => acc + (Number(c.amount) || 0), 0)
})

const canCreate = computed(() => me.value?.role_name === 'ADMIN_PLANTEL')

function canEdit(it: Reembolso) {
  if (!canCreate.value) return false
  return it.estado === 'en_revision' || it.estado === 'borrador'
}
function canDelete(it: Reembolso) {
  if (!canCreate.value) return false
  return it.estado === 'en_revision' || it.estado === 'borrador'
}

function estadoLabel(s: ReembolsoEstado) {
  if (s === 'en_revision') return 'En revisión'
  if (s === 'aprobado') return 'Aprobado'
  if (s === 'rechazado') return 'Rechazado'
  if (s === 'pagado') return 'Pagado'
  return 'Borrador'
}

function estadoBadgeClass(s: ReembolsoEstado) {
  if (s === 'en_revision') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (s === 'aprobado') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (s === 'rechazado') return 'bg-rose-50 text-rose-800 border-rose-200'
  if (s === 'pagado') return 'bg-slate-100 text-slate-800 border-slate-200'
  return 'bg-indigo-50 text-indigo-800 border-indigo-200'
}

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0))
  } catch {
    return `$${Number(n || 0).toFixed(2)}`
  }
}

function fmtDate(dISO: string) {
  if (!dISO) return '—'
  try {
    return new Date(dISO).toLocaleDateString('es-MX')
  } catch {
    return dISO
  }
}

function conceptoPreview(r: Reembolso) {
  const first = r.conceptos?.[0]
  if (!first) return '—'
  const parts = [
    first.provider || '',
    first.invoice_number || '',
    first.concept || ''
  ].filter(Boolean)
  return parts.join(' · ') || '—'
}

function resetFilters() {
  q.value = ''
  estadoFilter.value = ''
  refresh()
}

async function loadMe() {
  me.value = await $fetch<Me>('/api/auth/me')
}

async function refresh() {
  loading.value = true
  loadError.value = ''

  try {
    const res = await $fetch<{ items: Reembolso[] }>('/api/reembolsos', {
      params: {
        q: q.value || undefined,
        estado: estadoFilter.value || undefined,
      }
    })
    items.value = res.items || []
  } catch (e: any) {
    loadError.value = e?.data?.statusMessage || e?.message || 'No se pudo cargar.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  existingFileUrl.value = ''
  selectedFile.value = null
  saveError.value = ''
  lastCfdiDebug.value = null
  activeConceptIdx.value = 0

  form.value = {
    plantel: '',
    solicitante: '',
    fechaISO: new Date().toISOString().slice(0, 10),
    notas: '',
    conceptos: [mkConceptDraft()],
  }

  showModal.value = true
}

function openEdit(it: Reembolso) {
  if (!canEdit(it)) return

  editingId.value = it.id
  existingFileUrl.value = it.file_url || ''
  selectedFile.value = null
  saveError.value = ''
  lastCfdiDebug.value = null
  activeConceptIdx.value = 0

  form.value = {
    plantel: it.plantel || '',
    solicitante: it.solicitante || '',
    fechaISO: (it.fechaISO ? new Date(it.fechaISO).toISOString().slice(0, 10) : ''),
    notas: it.notas || '',
    conceptos: (it.conceptos || []).map((c: ReembolsoConcepto) => ({
      _k: Math.random().toString(16).slice(2),
      id: c.id,
      invoice_date: c.invoice_date || new Date().toISOString().slice(0, 10),
      invoice_number: c.invoice_number || '',
      provider: c.provider || '',
      concept: c.concept || '',
      description: c.description || '',
      amount: String(c.amount ?? ''),
    })),
  }

  if (!form.value.conceptos.length) form.value.conceptos = [mkConceptDraft()]
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  saving.value = false
  saveError.value = ''
  selectedFile.value = null
}

function handleFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

function addConceptRow() {
  form.value.conceptos.push(mkConceptDraft())
}

function removeConceptRow(idx: number) {
  if (form.value.conceptos.length === 1) return
  form.value.conceptos.splice(idx, 1)
  if ((activeConceptIdx.value ?? 0) >= form.value.conceptos.length) activeConceptIdx.value = form.value.conceptos.length - 1
}

function applyCfdiPrefill(p: any) {
  const idx = activeConceptIdx.value ?? 0
  const row = form.value.conceptos[idx] || form.value.conceptos[0]
  if (!row) return

  if (p?.amount != null && String(p.amount) !== 'null') row.amount = String(p.amount)
  if (p?.provider) row.provider = String(p.provider)
  if (p?.invoiceNumber) row.invoice_number = String(p.invoiceNumber)
  if (p?.date) row.invoice_date = String(p.date).slice(0, 10)
}

function validateForm(): string | null {
  if (!form.value.solicitante.trim()) return 'Falta el nombre del administrador.'
  if (!form.value.conceptos.length) return 'Agrega al menos un concepto.'
  for (let i = 0; i < form.value.conceptos.length; i++) {
    const c = form.value.conceptos[i]
    if (!c.invoice_date) return `Concepto #${i + 1}: falta fecha.`
    if (!c.concept.trim()) return `Concepto #${i + 1}: falta concepto.`
    const amt = Number(c.amount)
    if (!Number.isFinite(amt) || amt <= 0) return `Concepto #${i + 1}: monto inválido.`
  }
  return null
}

async function save() {
  saveError.value = ''
  const err = validateForm()
  if (err) {
    saveError.value = err
    return
  }

  saving.value = true

  try {
    const conceptos = form.value.conceptos.map((c) => ({
      id: c.id || undefined,
      invoice_date: c.invoice_date,
      invoice_number: c.invoice_number.trim() || undefined,
      provider: c.provider.trim() || undefined,
      concept: c.concept.trim(),
      description: c.description.trim() || undefined,
      amount: Number(c.amount),
    }))

    const fd = new FormData()
    fd.set('plantel', form.value.plantel)
    fd.set('solicitante', form.value.solicitante)
    fd.set('fechaISO', form.value.fechaISO ? new Date(form.value.fechaISO).toISOString() : new Date().toISOString())
    fd.set('notas', form.value.notas || '')
    fd.set('conceptos', JSON.stringify(conceptos))

    if (selectedFile.value) {
      fd.set('file', selectedFile.value)
    } else if (editingId.value && existingFileUrl.value) {
      fd.set('file_url', existingFileUrl.value)
    }

    if (editingId.value) {
      await $fetch(`/api/reembolsos/${editingId.value}`, { method: 'PUT', body: fd })
    } else {
      await $fetch('/api/reembolsos', { method: 'POST', body: fd })
    }

    closeModal()
    await refresh()
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage || e?.message || 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}

async function remove(it: Reembolso) {
  if (!canDelete(it)) return

  const ok = confirm(`¿Eliminar el reembolso ${it.folio}?`)
  if (!ok) return

  deletingId.value = it.id
  try {
    await $fetch(`/api/reembolsos/${it.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.statusMessage || e?.message || 'No se pudo eliminar.')
  } finally {
    deletingId.value = null
  }
}

onMounted(async () => {
  await loadMe()
  await refresh()
})
</script>