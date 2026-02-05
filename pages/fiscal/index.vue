<template>
  <div class="h-[calc(100vh-8rem)] flex flex-col">
    <!-- Header Summary -->
    <div class="flex justify-between items-center mb-4 shrink-0">
       <div>
         <h2 class="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ScaleIcon class="w-7 h-7 text-indigo-600" />
            Revisión Fiscal
         </h2>
         <p class="text-slate-500 text-sm">Valida la deducibilidad y la evidencia adjunta.</p>
       </div>
       <div class="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
          Pendientes: <span class="text-indigo-600 text-lg">{{ items.length }}</span>
       </div>
    </div>

    <!-- Main Split View -->
    <div class="flex-1 flex gap-4 overflow-hidden">
      
      <!-- LEFT: List of Requests -->
      <div class="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-1 pb-2">
        <div v-if="loading" class="p-10 text-center text-slate-400">
           <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
           Cargando...
        </div>

        <div v-else-if="items.length === 0" class="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
           <CheckBadgeIcon class="w-12 h-12 text-emerald-500 mx-auto mb-2" />
           <p class="text-slate-600 font-bold">Todo al día</p>
           <p class="text-xs text-slate-400">No hay solicitudes pendientes de revisión fiscal.</p>
        </div>

        <div 
          v-for="item in items" 
          :key="item.id" 
          @click="selectItem(item)"
          class="bg-white p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md relative group"
          :class="activeItem?.id === item.id ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md z-10' : 'border-slate-200 hover:border-indigo-300'"
        >
           <!-- Red Flag Dot for Missing File -->
           <div v-if="!item.file_url" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full animate-pulse border-2 border-white shadow-sm" title="Sin Archivo"></div>

           <div class="flex justify-between items-start mb-2">
              <span class="font-mono text-xs font-bold text-slate-400">{{ item.folio }}</span>
              <span class="font-bold text-slate-800 text-lg">${{ item.total }}</span>
           </div>

           <div class="mb-2">
              <div class="text-sm font-bold text-slate-700 truncate">{{ item.plantel }}</div>
              <div class="text-xs text-slate-500 truncate">{{ item.solicitante }}</div>
           </div>

           <div class="flex items-center gap-2">
              <!-- Prominent Deducible Badge -->
              <span 
                class="flex-1 text-center py-1 rounded-md text-[10px] font-black uppercase tracking-wider border"
                :class="item.is_deducible 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-orange-50 text-orange-700 border-orange-100'"
              >
                {{ item.is_deducible ? 'FISCAL / DEDUCIBLE' : 'NO DEDUCIBLE' }}
              </span>
              
              <!-- Icon for File Existence -->
              <div class="w-6 h-6 flex items-center justify-center rounded bg-slate-50 border border-slate-100">
                 <PaperClipIcon v-if="item.file_url" class="w-3.5 h-3.5 text-indigo-600" />
                 <ExclamationTriangleIcon v-else class="w-3.5 h-3.5 text-rose-500" />
              </div>
           </div>
        </div>
      </div>

      <!-- RIGHT: Preview & Action Panel -->
      <div class="hidden lg:flex lg:w-2/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col overflow-hidden relative">
         
         <div v-if="!activeItem" class="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <DocumentMagnifyingGlassIcon class="w-16 h-16 mb-4 opacity-50" />
            <p>Selecciona una solicitud de la lista para auditar.</p>
         </div>

         <div v-else class="flex flex-col h-full">
            <!-- Header Detail -->
            <div class="p-4 border-b border-slate-100 flex justify-between items-start bg-white z-10 shadow-sm">
               <div>
                  <h3 class="font-bold text-lg text-slate-800">{{ activeItem.folio }} — {{ activeItem.plantel }}</h3>
                  <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                     <span>{{ fmtDate(activeItem.fechaISO) }}</span>
                     <span>&bull;</span>
                     <span>{{ activeItem.conceptos.length }} concepto(s)</span>
                  </div>
                  <!-- Inline Warning if No File -->
                  <div v-if="!activeItem.file_url" class="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                     <ExclamationTriangleIcon class="w-4 h-4" /> ALERTA: No hay archivo adjunto.
                  </div>
                  <div v-if="activeItem.notas" class="mt-2 text-xs bg-amber-50 text-amber-800 p-2 rounded border border-amber-100">
                     Nota previa: {{ activeItem.notas }}
                  </div>
               </div>

               <!-- Concept Table (Mini) -->
               <div class="w-1/2 text-xs">
                  <table class="w-full text-left">
                     <thead class="text-slate-400 font-medium border-b border-slate-100">
                        <tr><th class="pb-1">Prov / Concepto</th><th class="pb-1 text-right">Monto</th></tr>
                     </thead>
                     <tbody class="divide-y divide-slate-50">
                        <tr v-for="c in activeItem.conceptos" :key="c.id">
                           <td class="py-1 truncate max-w-[150px]" :title="`${c.provider} - ${c.concept}`">
                              <div class="font-bold text-slate-700">{{ c.provider }}</div>
                              <div class="text-slate-500">{{ c.concept }}</div>
                           </td>
                           <td class="py-1 text-right font-mono">${{ c.amount }}</td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>

            <!-- Viewer Component -->
            <div class="flex-1 p-4 bg-slate-50 overflow-hidden">
               <FileViewer :url="activeItem.file_url" />
            </div>

            <!-- Actions Footer -->
            <div class="p-4 border-t border-slate-200 bg-white flex gap-3">
               <button 
                  @click="reject(activeItem)" 
                  class="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
               >
                  <XCircleIcon class="w-5 h-5" />
                  Rechazar / Devolver
               </button>
               
               <button 
                  @click="approve(activeItem)"
                  :disabled="!activeItem.file_url && !confirmNoFile" 
                  class="flex-[2] text-white px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2"
                  :class="(!activeItem.file_url && !confirmNoFile) ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'"
               >
                  <CheckCircleIcon class="w-5 h-5" />
                  {{ (!activeItem.file_url && !confirmNoFile) ? 'Falta Archivo' : 'Validar y Aprobar' }}
               </button>
            </div>
            
            <!-- Safety Toggle for No File -->
            <div v-if="!activeItem.file_url" class="absolute bottom-20 left-0 right-0 text-center pb-2 pointer-events-none">
               <label class="pointer-events-auto inline-flex items-center gap-2 bg-rose-100 px-4 py-1 rounded-full border border-rose-200 shadow-sm cursor-pointer">
                  <input type="checkbox" v-model="confirmNoFile" class="rounded text-rose-600 focus:ring-rose-500">
                  <span class="text-xs font-bold text-rose-800">Forzar aprobación sin archivo</span>
               </label>
            </div>

         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
   ScaleIcon, CheckBadgeIcon, DocumentMagnifyingGlassIcon, 
   PaperClipIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon 
} from '@heroicons/vue/24/outline';

const items = ref<any[]>([]);
const loading = ref(false);
const activeItem = ref<any>(null);
const confirmNoFile = ref(false);

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '-';

async function fetchItems() {
  loading.value = true;
  // Fetch pending review items
  const res = await $fetch<any>('/api/reimbursements', { params: { estado: 'en_revision' } });
  
  // Filter specifically for items in the FISCAL queue if the API returns mixed states
  // Assuming 'en_revision' might return Ops Pending too. We filter by raw status.
  items.value = (res.items || []).filter((i: any) => i.raw_status === 'PENDING_FISCAL_REVIEW');
  
  // Auto-select first if available and none selected
  if (items.value.length > 0 && !activeItem.value) {
     activeItem.value = items.value[0];
  } else if (items.value.length === 0) {
     activeItem.value = null;
  }
  
  loading.value = false;
}

function selectItem(item: any) {
   activeItem.value = item;
   confirmNoFile.value = false; // Reset safety toggle
}

async function approve(item: any) {
  if(!item.file_url && !confirm('ADVERTENCIA: Estás aprobando una solicitud SIN ARCHIVO ADJUNTO. ¿Continuar?')) return;
  
  try {
     await $fetch('/api/reimbursements/action', {
        method: 'POST',
        body: { id: item.id, action: 'APPROVE' }
     });
     
     // Remove from list locally for instant feedback
     items.value = items.value.filter(i => i.id !== item.id);
     activeItem.value = items.value[0] || null;
     
     // Background refresh to be safe
     fetchItems();
  } catch (e: any) {
     alert(e.data?.statusMessage || 'Error al aprobar');
  }
}

async function reject(item: any) {
  const reason = prompt('Motivo de devolución (Requerido):');
  if(!reason) return;
  
  try {
     await $fetch('/api/reimbursements/action', {
        method: 'POST',
        body: { id: item.id, action: 'RETURN', reason }
     });
     items.value = items.value.filter(i => i.id !== item.id);
     activeItem.value = items.value[0] || null;
     fetchItems();
  } catch (e: any) {
     alert(e.data?.statusMessage || 'Error al rechazar');
  }
}

onMounted(fetchItems);
</script>