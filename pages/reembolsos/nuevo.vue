<template>
  <div class="wrap">
    <header class="head">
      <div>
        <h1>Nuevo reembolso</h1>
        <p class="subtle">Agrega múltiples conceptos (renglones). El total se arma solo.</p>
      </div>
      <NuxtLink class="btn" to="/ops">Ir a Ops</NuxtLink>
    </header>

    <section v-if="errorBanner" class="banner error">
      <div class="banner-text">{{ errorBanner }}</div>
      <button class="btn ghost" @click="errorBanner = ''">Cerrar</button>
    </section>

    <section v-if="toast" class="toast" role="status" aria-live="polite">
      {{ toast }}
    </section>

    <section class="card">
      <div class="grid2">
        <label class="field">
          <span>Plantel</span>
          <input v-model.trim="form.plantel" class="input" placeholder="Ej: IEDIS Centro" />
        </label>

        <label class="field">
          <span>Nombre del administrador (solicitante)</span>
          <input v-model.trim="form.solicitante" class="input" placeholder="Nombre y apellido" />
        </label>
      </div>

      <div class="grid2">
        <label class="field">
          <span>Fecha (encabezado)</span>
          <input v-model.trim="form.fechaISO" class="input mono" type="date" />
        </label>

        <label class="field">
          <span>Área (opcional)</span>
          <input v-model.trim="form.area" class="input" placeholder="Opcional" />
        </label>
      </div>

      <label class="field">
        <span>Notas</span>
        <textarea v-model.trim="form.notas" class="textarea" rows="3" placeholder="Contexto útil."></textarea>
      </label>

      <div class="conceptos-editor">
        <div class="ce-head">
          <div>
            <div class="ce-title">Conceptos</div>
            <div class="ce-subtle">Cada renglón = FECHA / FACTURA / PROVEEDOR / CONCEPTO / DESCRIPCIÓN / MONTO</div>
          </div>
          <button class="btn" @click="addConcepto()">+ Agregar</button>
        </div>

        <div class="concepto-editor" v-for="(c, idx) in form.conceptos" :key="c._k">
          <div class="ce-row3">
            <label class="field">
              <span>Fecha</span>
              <input v-model.trim="c.invoice_date" class="input mono" type="date" />
            </label>

            <label class="field">
              <span>Factura</span>
              <input v-model.trim="c.invoice_number" class="input mono" placeholder="Ej: A-1234" />
            </label>

            <label class="field">
              <span>Monto</span>
              <input v-model.number="c.amount" class="input mono" type="number" step="0.01" min="0" placeholder="0.00" />
            </label>
          </div>

          <div class="ce-row2">
            <label class="field">
              <span>Proveedor</span>
              <input v-model.trim="c.provider" class="input" placeholder="Proveedor" />
            </label>

            <label class="field">
              <span>Concepto</span>
              <input v-model.trim="c.concept" class="input" placeholder="Ej: Papelería, Taxi, Insumos…" />
            </label>
          </div>

          <label class="field">
            <span>Descripción</span>
            <input v-model.trim="c.description" class="input" placeholder="Una línea que ayude a auditar." />
          </label>

          <div class="ce-foot">
            <div class="mono subtle">#{{ idx + 1 }}</div>
            <button class="btn danger small" :disabled="form.conceptos.length === 1" @click="removeConcepto(idx)">
              Quitar
            </button>
          </div>
        </div>

        <div class="totalbar">
          <div class="subtle">Total</div>
          <div class="mono total">{{ fmtMoney(formTotal) }}</div>
        </div>
      </div>

      <div class="foot">
        <button class="btn" @click="reset()">Limpiar</button>
        <button class="btn primary" :disabled="creating" @click="submit()">
          {{ creating ? 'Enviando…' : 'Enviar' }}
        </button>
      </div>
    </section>

    <section v-if="created" class="card share">
      <div class="share-head">
        <div>
          <div class="kicker">Creado</div>
          <div class="headline mono">{{ created.folio }}</div>
        </div>
        <NuxtLink class="btn" :to="`/ops?open=${encodeURIComponent(created.id)}`">Ver en Ops</NuxtLink>
      </div>

      <div class="share-grid">
        <div class="qr-box">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="qr-img" />
          <div v-else class="qr-fallback">Listo para copiar.</div>
        </div>

        <div>
          <div class="share-title">Link</div>
          <div class="share-link mono">{{ shareLink }}</div>
          <div class="share-actions">
            <button class="btn primary" @click="copy(shareLink)">Copiar link</button>
            <button class="btn" @click="openInNewTab(shareLink)">Abrir</button>
          </div>
          <div class="subtle" style="margin-top:10px;">
            Si no hay QR, instala <span class="mono">qrcode</span>; el link funciona igual.
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Reembolso } from '~/types/reembolso'

let QRCode: any = null
if (process.client) {
  try { QRCode = await import('qrcode') } catch { QRCode = null }
}

const errorBanner = ref('')
const toast = ref('')
let toastT: any = null
function showToast(msg: string) {
  toast.value = msg
  if (toastT) clearTimeout(toastT)
  toastT = setTimeout(() => (toast.value = ''), 1800)
}

type ConceptoDraft = {
  _k: string
  invoice_date: string
  invoice_number: string
  provider: string
  concept: string
  description: string
  amount: number | null
}

function mkConcepto(): ConceptoDraft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    _k: Math.random().toString(16).slice(2),
    invoice_date: today,
    invoice_number: '',
    provider: '',
    concept: '',
    description: '',
    amount: null,
  }
}

const form = reactive({
  plantel: '',
  solicitante: '',
  area: '',
  fechaISO: new Date().toISOString().slice(0, 10),
  notas: '',
  conceptos: [mkConcepto()] as ConceptoDraft[],
})

const creating = ref(false)
const created = ref<Reembolso | null>(null)

const formTotal = computed(() => form.conceptos.reduce((acc, c) => acc + (Number(c.amount) || 0), 0))

function fmtMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MXN' }).format(Number(n || 0))
}

function addConcepto() {
  form.conceptos.push(mkConcepto())
}

function removeConcepto(idx: number) {
  if (form.conceptos.length === 1) return
  form.conceptos.splice(idx, 1)
}

function reset() {
  form.plantel = ''
  form.solicitante = ''
  form.area = ''
  form.fechaISO = new Date().toISOString().slice(0, 10)
  form.notas = ''
  form.conceptos = [mkConcepto()]
  created.value = null
  shareLink.value = ''
  qrDataUrl.value = ''
  errorBanner.value = ''
}

function validate(): string | null {
  if (!form.solicitante.trim()) return 'Pon el nombre del administrador (solicitante).'
  if (!form.conceptos.length) return 'Agrega al menos un concepto.'
  for (let i = 0; i < form.conceptos.length; i++) {
    const c = form.conceptos[i]
    if (!c.invoice_date) return `Concepto #${i + 1}: falta fecha.`
    if (!c.concept.trim()) return `Concepto #${i + 1}: falta concepto.`
    const m = Number(c.amount)
    if (!Number.isFinite(m) || m <= 0) return `Concepto #${i + 1}: monto inválido.`
  }
  return null
}

function origin() {
  if (!process.client) return ''
  return window.location.origin
}

const shareLink = ref('')
const qrDataUrl = ref('')

async function buildShareArtifacts(r: Reembolso) {
  shareLink.value = `${origin()}/ops?open=${encodeURIComponent(r.id)}`
  qrDataUrl.value = ''
  if (process.client && QRCode?.toDataURL) {
    try {
      qrDataUrl.value = await QRCode.toDataURL(shareLink.value, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
    } catch {
      qrDataUrl.value = ''
    }
  }
}

async function submit() {
  const err = validate()
  if (err) {
    errorBanner.value = err
    return
  }

  try {
    creating.value = true
    errorBanner.value = ''

    const body = {
      plantel: form.plantel.trim() || undefined,
      solicitante: form.solicitante.trim(),
      area: form.area.trim() || undefined,
      fechaISO: form.fechaISO ? new Date(form.fechaISO).toISOString() : undefined,
      notas: form.notas.trim() || undefined,
      conceptos: form.conceptos.map(c => ({
        invoice_date: c.invoice_date,
        invoice_number: c.invoice_number.trim() || undefined,
        provider: c.provider.trim() || undefined,
        concept: c.concept.trim(),
        description: c.description.trim() || undefined,
        amount: Number(c.amount),
      })),
    }

    const res = await $fetch<{ ok: boolean; data: Reembolso }>('/api/reembolsos', { method: 'POST', body })
    created.value = res.data
    await buildShareArtifacts(res.data)
    showToast('Enviado.')
  } catch (e: any) {
    errorBanner.value = e?.data?.statusMessage || e?.statusMessage || e?.message || 'No se pudo enviar.'
  } finally {
    creating.value = false
  }
}

async function copy(text: string) {
  try {
    if (process.client && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      showToast('Copiado.')
      return
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    showToast('Copiado.')
  } catch {
    showToast('No se pudo copiar.')
  }
}

function openInNewTab(url: string) {
  if (!process.client) return
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.wrap { padding: 20px; max-width: 980px; margin: 0 auto; }
.head { display:flex; align-items:flex-end; justify-content:space-between; gap: 12px; margin-bottom: 14px; }
h1 { margin: 0; font-size: 22px; }
.subtle { color: rgba(0,0,0,.6); font-size: 13px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.card { border: 1px solid rgba(0,0,0,.12); border-radius: 14px; background: #fff; padding: 14px; }
.grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.field { display:flex; flex-direction:column; gap: 6px; margin-bottom: 12px; }
.field > span { font-size: 12px; color: rgba(0,0,0,.65); font-weight: 700; }

.input, .textarea {
  width:100%;
  border:1px solid rgba(0,0,0,.14);
  border-radius: 10px;
  padding: 9px 10px;
  background:#fff;
  outline: none;
}
.input:focus, .textarea:focus { border-color: rgba(0,0,0,.35); box-shadow: 0 0 0 3px rgba(0,0,0,.06); }

.btn { border:1px solid rgba(0,0,0,.14); background:#fff; padding: 9px 12px; border-radius: 10px; cursor:pointer; font-weight: 700; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
.btn:hover { background: rgba(0,0,0,.03); }
.btn.primary { background: rgba(0,0,0,.92); color:#fff; border-color: rgba(0,0,0,.2); }
.btn.primary:hover { background: rgba(0,0,0,.84); }
.btn.danger { border-color: rgba(244,67,54,.35); color: rgba(180,0,0,.9); }
.btn.small { padding: 7px 10px; border-radius: 9px; font-size: 12px; }
.btn.ghost { border-color: transparent; background: transparent; }

.conceptos-editor { border: 1px solid rgba(0,0,0,.12); border-radius: 12px; padding: 12px; background: rgba(0,0,0,.015); }
.ce-head { display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; margin-bottom: 10px; }
.ce-title { font-weight: 900; }
.ce-subtle { color: rgba(0,0,0,.6); font-size: 13px; margin-top: 3px; }

.concepto-editor { background:#fff; border: 1px solid rgba(0,0,0,.10); border-radius: 12px; padding: 12px; margin-top: 10px; }
.ce-row3 { display:grid; grid-template-columns: 1fr 1fr 0.7fr; gap: 12px; }
.ce-row2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ce-foot { margin-top: 10px; display:flex; align-items:center; justify-content:space-between; }

.totalbar { display:flex; align-items:center; justify-content:space-between; padding: 12px 2px 2px; }
.total { font-weight: 950; font-size: 16px; }

.foot { display:flex; justify-content:flex-end; gap: 10px; margin-top: 12px; }

.banner { display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; margin-bottom: 12px; }
.banner.error { border: 1px solid rgba(244, 67, 54, .35); background: rgba(244, 67, 54, .08); }
.banner-text { font-weight: 750; color: rgba(140,0,0,.9); }

.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  background: rgba(0,0,0,.92);
  color: #fff;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 750;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
}

.share { margin-top: 14px; }
.share-head { display:flex; align-items:center; justify-content:space-between; gap: 12px; }
.kicker { font-size: 12px; color: rgba(0,0,0,.55); font-weight: 800; letter-spacing: .02em; }
.headline { font-size: 16px; font-weight: 950; }

.share-grid { display:grid; grid-template-columns: 320px 1fr; gap: 16px; margin-top: 12px; }
.qr-box { border: 1px solid rgba(0,0,0,.12); border-radius: 14px; background: rgba(0,0,0,.02); padding: 12px; display:flex; align-items:center; justify-content:center; }
.qr-img { width: 280px; height: 280px; border-radius: 10px; background:#fff; }
.qr-fallback { color: rgba(0,0,0,.6); font-weight: 800; }
.share-title { font-weight: 950; }
.share-link { margin-top: 8px; padding: 10px 12px; border: 1px solid rgba(0,0,0,.12); border-radius: 12px; background: rgba(0,0,0,.02); word-break: break-all; }
.share-actions { margin-top: 12px; display:flex; gap: 10px; flex-wrap: wrap; }

@media (max-width: 860px) {
  .grid2 { grid-template-columns: 1fr; }
  .ce-row3, .ce-row2 { grid-template-columns: 1fr; }
  .share-grid { grid-template-columns: 1fr; }
}
</style>