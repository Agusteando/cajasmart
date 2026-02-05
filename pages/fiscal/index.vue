<template>
  <div>
    <div class="flex justify-between items-center mb-6">
       <h2 class="text-2xl font-bold text-slate-800">Revisión Fiscal</h2>
       <div class="text-sm text-slate-500">{{ items.length }} pendientes</div>
    </div>

    <div v-if="items.length > 0" class="space-y-4">
      <div v-for="item in items" :key="item.id" class="bg-white p-6 rounded-xl border shadow-sm">
         <div class="flex justify-between items-start">
            <div>
               <h3 class="font-bold text-lg flex items-center gap-2">
                  {{ item.folio }} 
                  <span class="text-slate-400">|</span> 
                  {{ item.plantel }}
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                        :class="item.is_deducible ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'">
                     {{ item.is_deducible ? 'Deducible' : 'No Deducible' }}
                  </span>
               </h3>
               <p class="text-sm text-slate-500">Solicitante: {{ item.solicitante }} &bull; {{ fmtDate(item.fechaISO) }}</p>
               <div v-if="item.notas" class="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded">Nota: {{ item.notas }}</div>
            </div>
            <div class="text-right">
               <p class="font-bold text-xl">${{ item.total }}</p>
               <a v-if="item.file_url" :href="`/uploads/${item.file_url}`" target="_blank" class="text-indigo-600 underline text-sm font-bold">Ver Archivo</a>
            </div>
         </div>
         
         <table class="w-full mt-4 text-sm bg-slate-50 rounded border border-slate-100">
            <thead>
               <tr class="text-left text-slate-500 border-b border-slate-200">
                  <th class="p-2">Factura</th>
                  <th class="p-2">Proveedor</th>
                  <th class="p-2">Concepto</th>
                  <th class="p-2 text-right">Monto</th>
               </tr>
            </thead>
            <tbody>
               <tr v-for="c in item.conceptos" :key="c.id">
                  <td class="p-2">{{ c.invoice_number }}</td>
                  <td class="p-2">{{ c.provider }}</td>
                  <td class="p-2">{{ c.concept }}</td>
                  <td class="p-2 text-right font-mono">${{ c.amount }}</td>
               </tr>
            </tbody>
         </table>

         <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button @click="approve(item)" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold flex-1 hover:bg-emerald-700">Aprobar</button>
            <button @click="reject(item)" class="bg-rose-100 text-rose-700 px-4 py-2 rounded font-bold flex-1 hover:bg-rose-200">Regresar</button>
         </div>
      </div>
    </div>
    <div v-else class="p-10 text-center text-slate-500 bg-white rounded-xl border">Sin pendientes</div>
  </div>
</template>

<script setup lang="ts">
const items = ref<any[]>([])
const loading = ref(false)

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '-'

async function fetchItems() {
  loading.value = true
  const res = await $fetch<any>('/api/reimbursements', { params: { estado: 'en_revision' } })
  items.value = res.items
  loading.value = false
}

async function approve(item: any) {
  if(!confirm('¿Aprobar?')) return
  await $fetch('/api/reimbursements/action', {
     method: 'POST',
     body: { id: item.id, action: 'APPROVE' }
  })
  await fetchItems()
}

async function reject(item: any) {
  const reason = prompt('Motivo de devolución:')
  if(!reason) return
  await $fetch('/api/reimbursements/action', {
     method: 'POST',
     body: { id: item.id, action: 'RETURN', reason }
  })
  await fetchItems()
}

onMounted(fetchItems)
</script>