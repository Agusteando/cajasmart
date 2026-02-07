<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Mis Reembolsos</h1>
        <p class="text-slate-500">Administra tus solicitudes y confirma recepciones.</p>
      </div>
      <button
        v-if="canCreate"
        @click="openCreate()"
        class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all flex items-center gap-2"
      >
        <PlusIcon class="w-5 h-5" />
        Nuevo Reembolso
      </button>
    </div>

    <!-- Data List -->
    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <!-- Toolbar -->
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
        <div class="relative w-full md:w-96">
          <MagnifyingGlassIcon class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
          <input 
            v-model="q" 
            @keyup.enter="refresh"
            placeholder="Buscar por folio, proveedor, concepto..." 
            class="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <div class="flex items-center gap-2">
           <select v-model="estadoFilter" @change="refresh" class="py-2 pl-3 pr-8 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
             <option value="">Todos los estados</option>
             <option value="borrador">Borradores</option>
             <option value="en_revision">En Revisión</option>
             <option value="aprobado">Aprobados</option>
             <option value="pagado">Pagados (Por Confirmar)</option>
             <option value="finalizado">Finalizados</option>
             <option value="rechazado">Rechazados</option>
           </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs">
            <tr>
              <th class="px-6 py-4">Folio / Fecha</th>
              <th class="px-6 py-4">Total</th>
              <th class="px-6 py-4">Tipo</th>
              <th class="px-6 py-4">Estatus</th>
              <th class="px-6 py-4 text-center">Evidencia</th>
              <th class="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
             <tr v-if="loading"><td colspan="6" class="p-8 text-center text-slate-400 italic">Cargando información...</td></tr>
             <tr v-else-if="items.length === 0"><td colspan="6" class="p-12 text-center text-slate-400">No hay reembolsos registrados.</td></tr>
             
             <tr v-for="it in items" :key="it.id" class="hover:bg-slate-50/80 transition-colors group">
                <td class="px-6 py-4">
                   <div class="font-bold text-slate-900">{{ it.folio }}</div>
                   <div class="text-xs text-slate-500">{{ fmtDate(it.fechaISO) }}</div>
                </td>
                <td class="px-6 py-4">
                   <span class="font-mono font-bold text-slate-700 text-base">{{ fmtMoney(it.total) }}</span>
                </td>
                <td class="px-6 py-4">
                   <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" 
                         :class="it.is_deducible ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'">
                      {{ it.is_deducible ? 'Deducible' : 'No Deducible' }}
                   </span>
                </td>
                <td class="px-6 py-4">
                   <span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5" :class="estadoBadgeClass(it.raw_status)">
                      <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {{ estadoLabel(it.raw_status) }}
                   </span>
                   <div v-if="it.notas" class="mt-1 text-xs text-rose-600 font-medium max-w-[200px] truncate">
                      Nota: {{ it.notas }}
                   </div>
                </td>
                <td class="px-6 py-4 text-center">
                   <a v-if="it.file_url" :href="`/uploads/${it.file_url}`" target="_blank" class="text-indigo-600 hover:text-indigo-800 transition">
                      <DocumentIcon class="w-5 h-5 mx-auto" />
                   </a>
                   <span v-else class="text-slate-300">—</span>
                </td>
                <td class="px-6 py-4 text-right">
                   <!-- Confirm Receipt Button (Final Stage) -->
                   <button 
                      v-if="it.raw_status === 'PROCESSED'" 
                      @click="confirmReceipt(it)"
                      class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition animate-pulse"
                   >
                      Confirmar Recepción
                   </button>

                   <!-- Edit/Delete Buttons -->
                   <div v-else class="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button v-if="canEdit(it)" @click="openEdit(it)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Editar">
                         <PencilIcon class="w-4 h-4" />
                      </button>
                      <button v-if="canDelete(it)" @click="remove(it)" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Eliminar">
                         <TrashIcon class="w-4 h-4" />
                      </button>
                   </div>
                </td>
             </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- (Modal code remains identical to previous response, just ensuring script is updated) -->
    <!-- ... Teleport Modal ... -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- ... modal content ... -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        <div class="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-10 animate-fade-in-up">
           <!-- (Modal Content Same as before) -->
           <!-- Header -->
          <div class="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
               <h2 class="text-xl font-bold text-slate-800">{{ editingId ? 'Editar Solicitud' : 'Nueva Solicitud' }}</h2>
            </div>
            <button @click="closeModal" class="p-2 rounded-full hover:bg-slate-100"><XMarkIcon class="w-6 h-6" /></button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-8 bg-slate-50">
             <div class="max-w-4xl mx-auto space-y-8">
                <!-- Type Selection -->
                <section class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 class="font-bold text-slate-800 mb-4">1. Tipo de Comprobante</h3>
                   <div class="grid grid-cols-2 gap-4">
                      <button type="button" 
                         @click="form.is_deducible = true"
                         class="p-4 rounded-xl border-2 transition-all text-left group relative overflow-hidden"
                         :class="form.is_deducible ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'"
                      >
                         <div class="relative z-10">
                            <div class="font-bold text-lg mb-1" :class="form.is_deducible ? 'text-indigo-700' : 'text-slate-700'">Fiscal (Deducible)</div>
                            <div class="text-sm text-slate-500">Factura con XML/CFDI. Se escaneará el código QR.</div>
                         </div>
                         <CheckCircleIcon v-if="form.is_deducible" class="absolute top-4 right-4 w-6 h-6 text-indigo-600" />
                      </button>

                      <button type="button" 
                         @click="form.is_deducible = false"
                         class="p-4 rounded-xl border-2 transition-all text-left group relative overflow-hidden"
                         :class="!form.is_deducible ? 'border-orange-500 bg-orange-50/50' : 'border-slate-200 hover:border-orange-300'"
                      >
                         <div class="relative z-10">
                            <div class="font-bold text-lg mb-1" :class="!form.is_deducible ? 'text-orange-700' : 'text-slate-700'">No Deducible</div>
                            <div class="text-sm text-slate-500">Recibo simple, vale o nota de remisión sin QR fiscal.</div>
                         </div>
                         <CheckCircleIcon v-if="!form.is_deducible" class="absolute top-4 right-4 w-6 h-6 text-orange-500" />
                      </button>
                   </div>
                </section>

                <!-- Concepts -->
                <section>
                   <div class="flex items-center justify-between mb-4">
                      <h3 class="font-bold text-slate-800">Conceptos</h3>
                      <button @click="addConceptRow" class="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition">+ Agregar Manualmente</button>
                   </div>
                   <div class="space-y-3">
                      <div v-for="(c, idx) in form.conceptos" :key="idx" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative">
                         <button @click="removeConceptRow(idx)" class="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition"><TrashIcon class="w-5 h-5" /></button>
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input v-model="c.provider" placeholder="Proveedor" class="border rounded p-2 text-sm" />
                            <input v-model="c.amount" type="number" placeholder="Monto" class="border rounded p-2 text-sm" />
                            <input v-model="c.concept" placeholder="Concepto" class="border rounded p-2 text-sm md:col-span-2" />
                         </div>
                      </div>
                   </div>
                </section>
                
                <!-- File -->
                <section class="bg-slate-100 rounded-xl p-6 border border-slate-200">
                   <h3 class="font-bold text-slate-800">Evidencia</h3>
                   <input type="file" @change="handleFile" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition"/>
                </section>
             </div>
          </div>

          <!-- Footer -->
          <div class="px-8 py-5 border-t border-slate-200 bg-white flex items-center justify-between">
             <div></div>
             <button @click="save" :disabled="saving" class="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                {{ saving ? 'Guardando...' : 'Guardar' }}
             </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { 
   PlusIcon, MagnifyingGlassIcon, DocumentIcon, PencilIcon, TrashIcon, 
   XMarkIcon, UserIcon, BuildingOfficeIcon, QrCodeIcon, PaperClipIcon,
   CheckCircleIcon 
} from '@heroicons/vue/24/outline';
import { useUserCookie } from '~/composables/useUserCookie';

const user = useUserCookie();
const items = ref<any[]>([]);
const availablePlanteles = ref<any[]>([]); 
const loading = ref(false);
const q = ref('');
const estadoFilter = ref('');

// Modal State
const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const selectedFile = ref<File | null>(null);

const form = ref({
   plantel_id: null as number | null, 
   fechaISO: new Date().toISOString().slice(0, 10),
   is_deducible: true,
   conceptos: [] as any[]
});

const formTotal = computed(() => form.value.conceptos.reduce((sum:number, c:any) => sum + (Number(c.amount)||0), 0));
const canCreate = computed(() => user.value?.role_name === 'ADMIN_PLANTEL' || user.value?.role_name === 'SUPER_ADMIN');

// Helpers
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:2})}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '-';
const estadoLabel = (s: string) => {
    switch(s) {
        case 'APPROVED': return 'Aprobado';
        case 'PROCESSED': return 'Pagado (Por Confirmar)';
        case 'RECEIVED': return 'Finalizado';
        default: return s.replace(/_/g, ' ').toUpperCase();
    }
};
const estadoBadgeClass = (s: string) => {
   if(s==='APPROVED') return 'bg-emerald-100 text-emerald-800';
   if(s==='PROCESSED') return 'bg-indigo-100 text-indigo-800';
   if(s==='RECEIVED') return 'bg-slate-800 text-white';
   if(s==='RETURNED') return 'bg-rose-100 text-rose-800';
   return 'bg-slate-100 text-slate-800';
};

const canEdit = (it:any) => {
   const s = it.raw_status;
   return s === 'DRAFT' || s === 'RETURNED' || s === 'PENDING_OPS_REVIEW';
};
const canDelete = (it:any) => canEdit(it);

// --- LOGIC ---
async function refresh() {
   loading.value = true;
   try {
      const res = await $fetch<any>('/api/reimbursements', { 
         params: { q: q.value, estado: estadoFilter.value } 
      });
      items.value = res.items || [];
   } finally { loading.value = false; }
}

async function loadContext() {
   if(user.value?.role_name === 'SUPER_ADMIN' || !user.value?.plantel_id) {
      try {
         const all = await $fetch<any[]>('/api/crud/planteles'); 
         availablePlanteles.value = all.filter(p => p.activo);
      } catch {}
   } else {
      availablePlanteles.value = [{ id: user.value?.plantel_id, nombre: user.value?.plantel_nombre }];
   }
}

function openCreate() {
   editingId.value = null;
   selectedFile.value = null;
   form.value = {
      plantel_id: user.value?.plantel_id || (availablePlanteles.value[0]?.id || null),
      fechaISO: new Date().toISOString().slice(0, 10),
      is_deducible: true, 
      conceptos: [{ invoice_date: new Date().toISOString().slice(0,10), invoice_number: '', amount: '' }]
   };
   showModal.value = true;
}

function openEdit(it: any) {
   editingId.value = it.id;
   selectedFile.value = null;
   form.value = {
      plantel_id: user.value?.plantel_id,
      fechaISO: it.fechaISO.slice(0,10),
      is_deducible: !!it.is_deducible,
      conceptos: it.conceptos.map((c: any) => ({ ...c }))
   };
   showModal.value = true;
}

function closeModal() { showModal.value = false; }

function addConceptRow() {
   form.value.conceptos.push({ 
      invoice_date: new Date().toISOString().slice(0,10), 
      invoice_number: '', 
      amount: '' 
   });
}

function removeConceptRow(idx: number) {
   if(form.value.conceptos.length > 1) form.value.conceptos.splice(idx, 1);
}

function handleFile(e: any) {
   selectedFile.value = e.target.files[0];
}

async function save() {
   if(!form.value.conceptos.length) return alert('Agrega al menos un concepto');
   saving.value = true;
   
   const fd = new FormData();
   if (form.value.plantel_id) fd.append('plantel_id', String(form.value.plantel_id));
   fd.append('fechaISO', form.value.fechaISO);
   fd.append('is_deducible', String(form.value.is_deducible));
   fd.append('conceptos', JSON.stringify(form.value.conceptos));
   if (selectedFile.value) fd.append('file', selectedFile.value);
   if (editingId.value) fd.append('id', editingId.value);

   try {
      const endpoint = editingId.value ? '/api/reimbursements/update' : '/api/reimbursements';
      await $fetch(endpoint, { method: 'POST', body: fd });
      closeModal();
      await refresh();
   } catch (e: any) {
      alert(e.data?.statusMessage || 'Error al guardar');
   } finally {
      saving.value = false;
   }
}

async function remove(it: any) {
   if(!confirm('¿Eliminar esta solicitud?')) return;
   try {
      await $fetch(`/api/reimbursements/${it.id}`, { method: 'DELETE' });
      await refresh();
   } catch (e: any) { 
      alert(e.data?.statusMessage || 'No se pudo eliminar'); 
   }
}

// --- CONFIRM RECEIPT (Final Step) ---
async function confirmReceipt(it: any) {
   if(!confirm(`¿Confirmas que ya recibiste el dinero/cheque del folio ${it.folio}?`)) return;
   
   try {
      await $fetch('/api/reimbursements/action', { 
         method: 'POST', 
         body: { id: it.id, action: 'CONFIRM_RECEIPT' } 
      });
      await refresh();
      alert('¡Confirmado! El proceso ha finalizado.');
   } catch (e: any) {
      alert('Error: ' + e.message);
   }
}

onMounted(async () => {
   await loadContext();
   await refresh();
});
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>