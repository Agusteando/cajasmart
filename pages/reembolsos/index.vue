<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">Mis Reembolsos</h1>
        <p class="text-slate-500">Administra tus solicitudes y gastos.</p>
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
             <option value="pagado">Pagados</option>
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
              <th class="px-6 py-4">Estatus</th>
              <th class="px-6 py-4 text-center">Evidencia</th>
              <th class="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
             <tr v-if="loading"><td colspan="5" class="p-8 text-center text-slate-400 italic">Cargando información...</td></tr>
             <tr v-else-if="items.length === 0"><td colspan="5" class="p-12 text-center text-slate-400">No hay reembolsos registrados.</td></tr>
             
             <tr v-for="it in items" :key="it.id" class="hover:bg-slate-50/80 transition-colors group">
                <td class="px-6 py-4">
                   <div class="font-bold text-slate-900">{{ it.folio }}</div>
                   <div class="text-xs text-slate-500">{{ fmtDate(it.fechaISO) }}</div>
                </td>
                <td class="px-6 py-4">
                   <span class="font-mono font-bold text-slate-700 text-base">{{ fmtMoney(it.total) }}</span>
                </td>
                <td class="px-6 py-4">
                   <span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5" :class="estadoBadgeClass(it.estado)">
                      <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {{ estadoLabel(it.estado) }}
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
                   <div class="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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

    <!-- MODAL -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        
        <div class="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-10 animate-fade-in-up">
          
          <!-- Header -->
          <div class="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
               <h2 class="text-xl font-bold text-slate-800">{{ editingId ? 'Editar Solicitud' : 'Nueva Solicitud' }}</h2>
               <p class="text-sm text-slate-500 flex items-center gap-2 mt-1">
                  <UserIcon class="w-4 h-4" /> {{ userDisplay }}
                  <span class="text-slate-300">|</span>
                  <BuildingOfficeIcon class="w-4 h-4" /> 
                  <span v-if="availablePlanteles.length <= 1">{{ plantelDisplay }}</span>
                  <select v-else v-model="form.plantel_id" class="bg-transparent border-none text-indigo-600 font-bold text-sm p-0 focus:ring-0 cursor-pointer">
                     <option v-for="p in availablePlanteles" :key="p.id" :value="p.id">{{ p.nombre }}</option>
                  </select>
               </p>
            </div>
            
            <div class="flex items-center gap-4">
               <div class="text-right hidden md:block">
                  <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Acumulado</div>
                  <div class="text-2xl font-black text-slate-900">{{ fmtMoney(formTotal) }}</div>
               </div>
               <button @click="closeModal" class="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                  <XMarkIcon class="w-6 h-6" />
               </button>
            </div>
          </div>

          <!-- Body (Scrollable) -->
          <div class="flex-1 overflow-y-auto p-8 bg-slate-50">
             <div class="max-w-4xl mx-auto space-y-8">
                
                <!-- Scanner Section -->
                <section>
                   <div class="flex items-center gap-2 mb-4">
                      <QrCodeIcon class="w-5 h-5 text-indigo-600" />
                      <h3 class="font-bold text-slate-800">Agregar Conceptos</h3>
                   </div>
                   <!-- This component handles the magic -->
                   <CfdiQrScanner @prefill="onCfdiDetected" />
                </section>

                <!-- Concepts List -->
                <section>
                   <div class="flex items-center justify-between mb-4">
                      <h3 class="font-bold text-slate-800">Conceptos ({{ form.conceptos.length }})</h3>
                      <button @click="addConceptRow" class="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition">+ Agregar Manualmente</button>
                   </div>

                   <div class="space-y-3">
                      <div v-for="(c, idx) in form.conceptos" :key="idx" 
                           class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm transition hover:shadow-md hover:border-indigo-200 relative group">
                         
                         <!-- Remove Button (Absolute) -->
                         <button @click="removeConceptRow(idx)" class="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition" tabindex="-1">
                            <TrashIcon class="w-5 h-5" />
                         </button>

                         <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <!-- Row 1 -->
                            <div class="md:col-span-3">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Fecha Factura</label>
                               <input v-model="c.invoice_date" type="date" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div class="md:col-span-3">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Folio Factura</label>
                               <input v-model="c.invoice_number" placeholder="Ej: A-1502" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div class="md:col-span-6 pr-8">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Proveedor</label>
                               <input v-model="c.provider" placeholder="Razón Social" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            
                            <!-- Row 2 -->
                            <div class="md:col-span-4">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Concepto (Gasto)</label>
                               <input v-model="c.concept" placeholder="Ej: Papelería" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div class="md:col-span-5">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Descripción / Justificación</label>
                               <input v-model="c.description" placeholder="Detalle..." class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div class="md:col-span-3">
                               <label class="block text-xs font-bold text-slate-400 uppercase mb-1 text-right">Monto Total</label>
                               <div class="relative">
                                  <span class="absolute left-3 top-2 text-slate-400">$</span>
                                  <input v-model="c.amount" type="number" step="0.01" class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-3 py-2 text-sm font-bold text-right focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                               </div>
                            </div>
                         </div>
                         <div class="mt-2 text-[10px] text-slate-400 font-mono text-right">#{{ idx + 1 }}</div>
                      </div>
                   </div>
                </section>

                <!-- Evidence Section -->
                <section class="bg-slate-100 rounded-xl p-6 border border-slate-200">
                   <div class="flex items-start gap-4">
                      <div class="bg-white p-3 rounded-lg border border-slate-200 text-slate-400">
                         <PaperClipIcon class="w-6 h-6" />
                      </div>
                      <div class="flex-1">
                         <h3 class="font-bold text-slate-800">Evidencia Digital</h3>
                         <p class="text-sm text-slate-500 mb-3">Sube el PDF o Foto que contenga las facturas de estos conceptos.</p>
                         <input type="file" @change="handleFile" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition"/>
                         <div v-if="editingId" class="mt-2 text-xs text-amber-600">
                            Nota: Si subes un archivo nuevo, reemplazará al anterior.
                         </div>
                      </div>
                   </div>
                </section>

             </div>
          </div>

          <!-- Footer -->
          <div class="px-8 py-5 border-t border-slate-200 bg-white flex items-center justify-between">
             <div class="text-sm text-slate-500">
                Fecha de registro: <span class="font-bold text-slate-700">{{ form.fechaISO }}</span>
             </div>
             <div class="flex gap-3">
                <button @click="closeModal" class="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition">
                   Cancelar
                </button>
                <button @click="save" :disabled="saving" class="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2">
                   <span v-if="saving" class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                   {{ saving ? 'Guardando...' : 'Guardar Solicitud' }}
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
   PlusIcon, MagnifyingGlassIcon, DocumentIcon, PencilIcon, TrashIcon, 
   XMarkIcon, UserIcon, BuildingOfficeIcon, QrCodeIcon, PaperClipIcon 
} from '@heroicons/vue/24/outline';
import { useUserCookie } from '~/composables/useUserCookie';

// State
const user = useUserCookie();
const items = ref<any[]>([]);
const availablePlanteles = ref<any[]>([]); // For the dropdown if needed
const loading = ref(false);
const q = ref('');
const estadoFilter = ref('');

// Modal State
const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const selectedFile = ref<File | null>(null);

// Form
const form = ref({
   plantel_id: null as number | null, 
   fechaISO: new Date().toISOString().slice(0, 10),
   conceptos: [] as any[]
});

// Computed
const formTotal = computed(() => form.value.conceptos.reduce((sum:number, c:any) => sum + (Number(c.amount)||0), 0));
const canCreate = computed(() => user.value?.role_name === 'ADMIN_PLANTEL' || user.value?.role_name === 'SUPER_ADMIN');

const userDisplay = computed(() => user.value?.nombre || 'Usuario');
const plantelDisplay = computed(() => {
   if(form.value.plantel_id) {
      const p = availablePlanteles.value.find(x => x.id === form.value.plantel_id);
      if(p) return p.nombre;
   }
   return user.value?.plantel_nombre || 'Sin Plantel';
});

// --- HELPER FUNCTIONS ---
const fmtMoney = (n: number) => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:2})}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '-';
const estadoLabel = (s: string) => s.replace(/_/g, ' ').toUpperCase();
const estadoBadgeClass = (s: string) => {
   if(s==='aprobado') return 'bg-emerald-100 text-emerald-800';
   if(s==='rechazado') return 'bg-rose-100 text-rose-800';
   if(s==='pagado') return 'bg-slate-100 text-slate-800';
   return 'bg-indigo-50 text-indigo-800';
};
const canEdit = (it:any) => it.estado === 'borrador' || it.estado === 'rechazado';
const canDelete = (it:any) => canEdit(it);

// --- LOGIC ---

// 1. Load Data
async function refresh() {
   loading.value = true;
   try {
      const res = await $fetch<any>('/api/reimbursements', { 
         params: { q: q.value, estado: estadoFilter.value } 
      });
      items.value = res.items || [];
   } catch(e) { console.error(e); }
   finally { loading.value = false; }
}

// 2. Setup Context (Plantels)
async function loadContext() {
   // If super admin or no plantel assigned, fetch list
   if(user.value?.role_name === 'SUPER_ADMIN' || !user.value?.plantel_id) {
      try {
         // Assuming a simple list endpoint exists or using the generic crud
         const all = await $fetch<any[]>('/api/crud/planteles'); 
         availablePlanteles.value = all.filter(p => p.activo);
      } catch {}
   } else {
      // Just push current user's plantel
      availablePlanteles.value = [{ id: user.value?.plantel_id, nombre: user.value?.plantel_nombre }];
   }
}

// 3. Modal Actions
function openCreate() {
   editingId.value = null;
   selectedFile.value = null;
   form.value = {
      plantel_id: user.value?.plantel_id || (availablePlanteles.value[0]?.id || null),
      fechaISO: new Date().toISOString().slice(0, 10),
      conceptos: [{ invoice_date: new Date().toISOString().slice(0,10), invoice_number: '', amount: '' }]
   };
   showModal.value = true;
}

function openEdit(it: any) {
   editingId.value = it.id;
   selectedFile.value = null;
   // Find the plantel ID based on name if possible, or keep it (API should return ID ideally)
   // For now assuming the list view returns plantel name.
   // We might need to fetch the single item details to get the ID properly, 
   // but let's assume `user.plantel_id` is sufficient for ADMIN_PLANTEL context.
   
   form.value = {
      plantel_id: user.value?.plantel_id, // Default to user's
      fechaISO: it.fechaISO.slice(0,10),
      conceptos: it.conceptos.map((c: any) => ({ ...c }))
   };
   showModal.value = true;
}

function closeModal() { showModal.value = false; }

// 4. Form Logic
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

// 5. CFDI Handler (The "Magic")
function onCfdiDetected(data: any) {
   // Find the first empty row or create new
   let targetRow = form.value.conceptos.find((c:any) => !c.amount && !c.provider);
   
   if (!targetRow) {
      addConceptRow();
      targetRow = form.value.conceptos[form.value.conceptos.length - 1];
   }

   // Auto-fill
   if (data.amount) targetRow.amount = data.amount;
   if (data.provider) targetRow.provider = data.provider;
   if (data.invoiceNumber) targetRow.invoice_number = data.invoiceNumber;
   if (data.date) targetRow.invoice_date = data.date.slice(0, 10);
   
   // Optional: Flash UI or Sound to indicate success
}

// 6. Save
async function save() {
   if(!form.value.conceptos.length) return alert('Agrega al menos un concepto');
   
   saving.value = true;
   
   const fd = new FormData();
   // User name is inferred from session on server, no need to send
   // Plantel:
   if (form.value.plantel_id) fd.append('plantel_id', String(form.value.plantel_id));
   fd.append('fechaISO', form.value.fechaISO);
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

// 7. Delete
async function remove(it: any) {
   if(!confirm('¿Eliminar esta solicitud?')) return;
   try {
      await $fetch(`/api/reimbursements/${it.id}`, { method: 'DELETE' });
      await refresh();
   } catch { alert('No se pudo eliminar'); }
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