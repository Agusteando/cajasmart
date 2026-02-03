<template>
  <div class="wrap">
    <header class="head">
      <div>
        <h1>Nuevo reembolso</h1>
        <p class="subtle">Agrega múltiples conceptos.</p>
      </div>
      <NuxtLink class="btn" to="/ops">Ir a Ops</NuxtLink>
    </header>

    <section v-if="errorBanner" class="banner error">
      <div class="banner-text">{{ errorBanner }}</div>
      <button class="btn ghost" @click="errorBanner = ''">Cerrar</button>
    </section>

    <section class="card">
      <div class="grid2">
        <label class="field"><span>Plantel</span><input v-model.trim="form.plantel" class="input" /></label>
        <label class="field"><span>Administrador</span><input v-model.trim="form.solicitante" class="input" /></label>
      </div>
      <label class="field"><span>Fecha</span><input v-model.trim="form.fechaISO" class="input mono" type="date" /></label>

      <div class="conceptos-editor">
        <div class="ce-head">
          <div class="ce-title">Conceptos</div>
          <button class="btn" @click="addConcepto()">+ Agregar</button>
        </div>
        <div class="concepto-editor" v-for="(c, idx) in form.conceptos" :key="c._k">
          <div class="ce-row3">
            <label class="field"><span>Fecha</span><input v-model.trim="c.invoice_date" class="input mono" type="date" /></label>
            <label class="field"><span>Factura</span><input v-model.trim="c.invoice_number" class="input mono" /></label>
            <label class="field"><span>Monto</span><input v-model.number="c.amount" class="input mono" type="number" /></label>
          </div>
          <div class="ce-row2">
            <label class="field"><span>Proveedor</span><input v-model.trim="c.provider" class="input" /></label>
            <label class="field"><span>Concepto</span><input v-model.trim="c.concept" class="input" /></label>
          </div>
          <div class="ce-foot">
             <button class="btn danger small" :disabled="form.conceptos.length===1" @click="removeConcepto(idx)">Quitar</button>
          </div>
        </div>
      </div>

      <div class="foot">
        <button class="btn primary" :disabled="creating" @click="submit()">{{ creating ? 'Enviando…' : 'Enviar' }}</button>
      </div>
    </section>

    <section v-if="created" class="card share">
      <div class="share-head">
        <div><div class="kicker">Creado</div><div class="headline mono">{{ created.folio }}</div></div>
      </div>
      <div class="share-grid">
        <div class="qr-box">
          <img v-if="qrDataUrl" :src="qrDataUrl" class="qr-img" />
          <div v-else>Copiado.</div>
        </div>
        <div>
          <div class="share-link mono">{{ shareLink }}</div>
          <button class="btn primary" @click="copy(shareLink)">Copiar Link</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Reembolso } from '~/types/reembolso' // Ensure this type exists or map loosely

let QRCode: any = null
if (process.client) { try { QRCode = await import('qrcode') } catch {} }

const errorBanner = ref('')
const creating = ref(false)
const created = ref<any>(null)
const shareLink = ref('')
const qrDataUrl = ref('')

function mkConcepto() {
  return { _k: Math.random(), invoice_date: new Date().toISOString().slice(0,10), invoice_number:'', provider:'', concept:'', amount:0 }
}
const form = reactive({
  plantel: '', solicitante: '', fechaISO: new Date().toISOString().slice(0,10), conceptos: [mkConcepto()]
})

function addConcepto() { form.conceptos.push(mkConcepto()) }
function removeConcepto(i:number) { if(form.conceptos.length>1) form.conceptos.splice(i,1) }

async function submit() {
  creating.value = true
  errorBanner.value = ''
  
  const fd = new FormData()
  fd.append('plantel', form.plantel)
  fd.append('solicitante', form.solicitante)
  fd.append('fechaISO', form.fechaISO)
  fd.append('conceptos', JSON.stringify(form.conceptos))

  try {
    // CORRECTED: Point to unified DB endpoint
    const res: any = await $fetch('/api/reimbursements', { method: 'POST', body: fd })
    created.value = res.data
    
    // Generate QR
    shareLink.value = `${window.location.origin}/ops?open=${res.data.id}`
    if (QRCode) qrDataUrl.value = await QRCode.toDataURL(shareLink.value, { width: 280 })
  } catch(e:any) {
    errorBanner.value = e.data?.statusMessage || 'Error'
  } finally { creating.value = false }
}

function copy(txt:string) { navigator.clipboard.writeText(txt) }
</script>

<style scoped>
/* Restored Styles */
.wrap { padding: 20px; max-width: 800px; margin: 0 auto; }
.card { border: 1px solid #ddd; background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
.input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
.btn { padding: 10px 15px; border-radius: 8px; cursor: pointer; border: 1px solid #ccc; background: white; }
.btn.primary { background: #000; color: white; border-color: #000; }
.share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
.qr-img { width: 100%; max-width: 200px; }
</style>