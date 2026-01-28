import type { Reembolso, ReembolsoEstado, ReembolsoConcepto } from '~/types/reembolso'

type ConceptoInput = {
  id?: string
  invoice_date: string
  invoice_number?: string
  provider?: string
  concept: string
  description?: string
  amount: number
}

type CreateInput = {
  plantel?: string
  solicitante: string
  area?: string
  fechaISO?: string
  notas?: string
  file_url?: string
  conceptos: ConceptoInput[]
}

type UpdateInput = {
  plantel?: string
  solicitante: string
  area?: string
  fechaISO?: string
  notas?: string
  file_url?: string
  conceptos: ConceptoInput[]
}

type PatchInput = {
  estado?: ReembolsoEstado
  notas?: string
  file_url?: string
}

function nowISO() {
  return new Date().toISOString()
}

function uid(prefix = '') {
  return `${prefix}${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

function computeTotal(conceptos: ReembolsoConcepto[]) {
  return conceptos.reduce((acc, c) => acc + (Number.isFinite(c.amount) ? c.amount : 0), 0)
}

function nextFolio(n: number) {
  const s = String(n).padStart(5, '0')
  return `R-${s}`
}

type Store = {
  seq: number
  items: Reembolso[]
}

const g = globalThis as unknown as { __reembolsosStore?: Store }

function getStore(): Store {
  if (!g.__reembolsosStore) {
    g.__reembolsosStore = { seq: 1, items: [] }
  }
  return g.__reembolsosStore
}

function normStr(v: any) {
  const s = String(v ?? '').trim()
  return s || ''
}

function optStr(v: any) {
  const s = String(v ?? '').trim()
  return s ? s : undefined
}

function normalizeConceptos(conceptos: ConceptoInput[]): ReembolsoConcepto[] {
  return (conceptos || []).map((c) => ({
    id: optStr(c.id) || uid('c_'),
    invoice_date: normStr(c.invoice_date),
    invoice_number: optStr(c.invoice_number),
    provider: optStr(c.provider),
    concept: normStr(c.concept),
    description: optStr(c.description),
    amount: Number(c.amount),
  }))
}

export function listReembolsos() {
  const store = getStore()
  return [...store.items].sort((a, b) => (a.createdAtISO < b.createdAtISO ? 1 : -1))
}

export function getReembolso(id: string) {
  const store = getStore()
  return store.items.find((r) => r.id === id) || null
}

export function createReembolso(input: CreateInput) {
  const store = getStore()

  const conceptos = normalizeConceptos(input.conceptos || [])
  const total = computeTotal(conceptos)

  const id = uid('r_')
  const folio = nextFolio(store.seq++)

  const ts = nowISO()
  const reembolso: Reembolso = {
    id,
    folio,
    plantel: optStr(input.plantel) || optStr(input.area), // compat
    solicitante: normStr(input.solicitante),
    area: optStr(input.area),
    fechaISO: (input.fechaISO && String(input.fechaISO)) || ts,
    estado: 'en_revision',
    conceptos,
    total,
    notas: optStr(input.notas),
    file_url: optStr(input.file_url),
    createdAtISO: ts,
    updatedAtISO: ts,
  }

  store.items.push(reembolso)
  return reembolso
}

export function updateReembolso(id: string, input: UpdateInput) {
  const store = getStore()
  const idx = store.items.findIndex((r) => r.id === id)
  if (idx === -1) return null

  const curr = store.items[idx]
  const conceptos = normalizeConceptos(input.conceptos || [])
  const total = computeTotal(conceptos)

  const next: Reembolso = {
    ...curr,
    plantel: optStr(input.plantel) || optStr(input.area) || curr.plantel,
    solicitante: normStr(input.solicitante),
    area: optStr(input.area),
    fechaISO: (input.fechaISO && String(input.fechaISO)) || curr.fechaISO,
    conceptos,
    total,
    notas: optStr(input.notas),
    file_url: optStr(input.file_url) ?? curr.file_url,
    updatedAtISO: nowISO(),
  }

  store.items[idx] = next
  return next
}

export function patchReembolso(id: string, patch: PatchInput) {
  const store = getStore()
  const idx = store.items.findIndex((r) => r.id === id)
  if (idx === -1) return null

  const curr = store.items[idx]
  const next: Reembolso = {
    ...curr,
    estado: patch.estado ?? curr.estado,
    notas: patch.notas ?? curr.notas,
    file_url: patch.file_url ?? curr.file_url,
    updatedAtISO: nowISO(),
  }
  store.items[idx] = next
  return next
}

export function deleteReembolso(id: string) {
  const store = getStore()
  const idx = store.items.findIndex((r) => r.id === id)
  if (idx === -1) return false
  store.items.splice(idx, 1)
  return true
}