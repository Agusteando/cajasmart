<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Tesorería</h2>
      <div v-if="selectedIds.length" class="flex gap-2">
         <button @click="batchPrint" class="bg-slate-200 px-4 py-2 rounded">Imprimir</button>
         <button @click="confirmBatchProcess" class="bg-green-600 text-white px-4 py-2 rounded">Pagar Seleccionados</button>
      </div>
    </div>

    <table class="w-full bg-white shadow rounded-lg overflow-hidden">
       <thead class="bg-slate-50 border-b">
          <tr>
             <th class="p-4 w-10"></th>
             <th class="p-4 text-left">Folio</th>
             <th class="p-4 text-left">Admin</th>
             <th class="p-4 text-left">Total</th>
             <th class="p-4">Accion</th>
          </tr>
       </thead>
       <tbody>
          <tr v-for="i in items" :key="i.id" class="border-b">
             <td class="p-4"><input type="checkbox" :checked="selectedIds.includes(i.id)" @change="toggleItem(i.id)"></td>
             <td class="p-4">{{ i.folio }} - {{ i.plantel }}</td>
             <td class="p-4">{{ i.solicitante }}</td>
             <td class="p-4 font-bold">${{ i.total }}</td>
             <td class="p-4"><button @click="processSingle(i)" class="text-green-600 font-bold">Pagar</button></td>
          </tr>
       </tbody>
    </table>

    <!-- Hidden Print Section (Restored Styles) -->
    <div v-if="printData" class="print-container">
       <div v-for="p in printData.items" :key="p.id" class="sheet">
          <div class="sheet-header">
             <div class="sheet-logo">IEDIS</div>
             <div class="sheet-title">REEMBOLSO DE CAJA</div>
          </div>
          <div class="sheet-meta">
             <div>PLANTEL: {{ p.plantel }}</div>
             <div>ADMINISTRADOR: {{ p.solicitante }}</div>
          </div>
          <table class="sheet-table">
             <thead><tr><th>FECHA</th><th>FACTURA</th><th>CONCEPTO</th><th>MONTO</th></tr></thead>
             <tbody>
                <tr v-for="c in p.conceptos" :key="c.id">
                   <td>{{ c.invoice_date }}</td>
                   <td>{{ c.invoice_number }}</td>
                   <td>{{ c.concept }}</td>
                   <td class="right">${{ c.amount }}</td>
                </tr>
             </tbody>
             <tfoot><tr><td colspan="3" class="right">TOTAL</td><td class="right">${{ p.total }}</td></tr></tfoot>
          </table>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const items = ref<any[]>([])
const selectedIds = ref<string[]>([])
const printData = ref<any>(null)

async function fetchItems() {
  const res = await $fetch<any>('/api/reimbursements', { params: { estado: 'aprobado' } })
  items.value = res.items
  selectedIds.value = []
}

async function batchPrint() {
  // Use batch endpoint to get print data
  const res: any = await $fetch('/api/reimbursements/batch', { method: 'POST', body: { action: 'print', ids: selectedIds.value } })
  printData.value = res.data
  setTimeout(() => window.print(), 500)
}

async function confirmBatchProcess() {
  await $fetch('/api/reimbursements/batch', { method: 'POST', body: { action: 'process', ids: selectedIds.value } })
  await fetchItems()
}

async function processSingle(item: any) {
  if(!confirm('¿Pagar?')) return
  await $fetch('/api/reimbursements/action', { method: 'POST', body: { id: item.id, action: 'PROCESS' } })
  await fetchItems()
}

const toggleItem = (id:string) => {
   if(selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter(x=>x!==id)
   else selectedIds.value.push(id)
}

onMounted(fetchItems)
</script>

<style>
@media print {
  body * { visibility: hidden; }
  .print-container, .print-container * { visibility: visible; }
  .print-container { position: absolute; left: 0; top: 0; width: 100%; }
  .sheet { page-break-after: always; padding: 20px; border: 2px solid black; margin-bottom: 20px; }
  .sheet-header { text-align: center; font-weight: bold; margin-bottom: 20px; }
  .sheet-table { width: 100%; border-collapse: collapse; }
  .sheet-table th, .sheet-table td { border: 1px solid black; padding: 5px; }
  .right { text-align: right; }
}
</style>