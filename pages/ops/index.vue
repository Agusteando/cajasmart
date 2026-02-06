<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800">Revisión Operativa</h2>
      <span class="text-sm text-slate-500">{{ items.length }} pendientes</span>
    </div>

    <div v-if="loading" class="p-12 text-center text-slate-400">
       <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
       Cargando...
    </div>

    <div v-else-if="items.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
      <h3 class="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
      <p class="text-slate-400 mt-2">No hay solicitudes pendientes de revisión operativa.</p>
    </div>

    <div v-else class="grid gap-4">
      <div v-for="item in items" :key="item.id" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="flex flex-col md:flex-row">
          <div class="flex-1 p-6">
            <div class="flex justify-between mb-4">
              <div>
                <h3 class="font-bold text-lg flex items-center gap-2">
                   Folio: {{ item.folio }}
                   <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                         :class="item.is_deducible ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'">
                      {{ item.is_deducible ? 'Deducible' : 'No Deducible' }}
                   </span>
                </h3>
                <p class="text-sm text-slate-500">{{ item.plantel }} | {{ item.solicitante }}</p>
                <div class="text-xs text-slate-400 mt-1">{{ fmtDate(item.fechaISO) }}</div>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold">${{ formatAmount(item.total) }}</p>
                <p class="text-xs text-slate-500">{{ item.conceptos.length }} conceptos</p>
              </div>
            </div>

            <!-- Concept Preview -->
            <div class="mb-4 overflow-x-auto border border-slate-100 rounded-lg">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50"><tr><th class="p-2">Proveedor</th><th class="p-2">Concepto</th><th class="p-2 text-right">Monto</th></tr></thead>
                <tbody>
                  <tr v-for="c in item.conceptos" :key="c.id">
                    <td class="p-2">{{ c.provider }}</td>
                    <td class="p-2">{{ c.concept }}</td>
                    <td class="p-2 text-right font-mono">${{ formatAmount(c.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex gap-3 pt-4 border-t">
              <button @click="openApproveModal(item)" class="flex-1 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700 transition">Aprobar</button>
              <button @click="openRejectModal(item)" class="flex-1 bg-red-50 text-red-600 py-2 rounded font-medium hover:bg-red-100 transition">Devolver</button>
            </div>
          </div>

          <div class="w-full md:w-64 bg-slate-100 border-l p-4 flex flex-col justify-center text-center">
            <p class="text-xs font-medium text-slate-500 uppercase mb-2">Evidencia</p>
            <a v-if="item.file_url" :href="`/uploads/${item.file_url}`" target="_blank" class="bg-white p-4 rounded border block text-indigo-600 font-bold hover:shadow-md transition">Ver Archivo</a>
            <div v-else class="text-slate-400 flex flex-col items-center">
              <span class="text-2xl mb-1">⚠️</span>
              Sin archivo
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const items = ref<any[]>([])
const loading = ref(false)

const formatAmount = (n:any) => parseFloat(n).toLocaleString('es-MX', {minimumFractionDigits:2})
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '-'

const fetchItems = async () => {
  loading.value = true
  try {
    // Explicitly requesting only PENDING_OPS_REVIEW items.
    // The backend now correctly respects the 'status' param.
    const res = await $fetch<any>('/api/reimbursements', { params: { status: 'PENDING_OPS_REVIEW' } })
    items.value = res.items || []
  } catch(e) {
    console.error(e)
  } finally { 
    loading.value = false 
  }
}

const openApproveModal = async (item:any) => {
  if(!confirm(`¿Aprobar solicitud ${item.folio}?`)) return
  try {
    await $fetch('/api/reimbursements/action', { method: 'POST', body: { id: item.id, action: 'APPROVE' } })
    await fetchItems()
  } catch(e:any) {
    alert(e.data?.statusMessage || 'Error al aprobar')
  }
}

const openRejectModal = async (item:any) => {
  const reason = prompt('Motivo de devolución (Requerido):')
  if(!reason) return
  
  try {
    await $fetch('/api/reimbursements/action', { method: 'POST', body: { id: item.id, action: 'RETURN', reason } })
    await fetchItems()
  } catch(e:any) {
    alert(e.data?.statusMessage || 'Error al devolver')
  }
}

onMounted(fetchItems)
</script>