<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl font-black text-slate-900 flex items-center gap-2">
          <ShieldCheckIcon class="w-8 h-8 text-rose-600" />
          Super Admin Console
        </h1>
        <p class="text-slate-500">Gestión avanzada y limpieza de datos.</p>
      </div>
      
      <!-- Tab Switcher -->
      <div class="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        <button 
          @click="activeTab = 'reembolsos'"
          class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
          :class="activeTab === 'reembolsos' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'"
        >
          <CurrencyDollarIcon class="w-4 h-4" />
          Reembolsos
        </button>
        <button 
          @click="activeTab = 'archivos'"
          class="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
          :class="activeTab === 'archivos' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'"
        >
          <FolderOpenIcon class="w-4 h-4" />
          Archivos
        </button>
      </div>
    </div>

    <!-- REEMBOLSOS TAB -->
    <div v-if="activeTab === 'reembolsos'" class="space-y-4">
      <!-- Toolbar -->
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4">
        <div class="flex-1 min-w-[200px]">
          <input 
            v-model="rSearch" 
            @keyup.enter="fetchReembolsos"
            placeholder="Buscar por ID, folio, nombre..." 
            class="w-full border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <select v-model="rPlantelId" @change="fetchReembolsos" class="border border-slate-300 rounded-lg px-4 py-2 outline-none bg-white">
          <option :value="0">Todos los planteles</option>
          <option v-for="p in planteles" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
        <button @click="fetchReembolsos" class="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800">
          Buscar
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500">
            <tr>
              <th class="px-6 py-4">ID / Folio</th>
              <th class="px-6 py-4">Plantel</th>
              <th class="px-6 py-4">Solicitante</th>
              <th class="px-6 py-4">Estado</th>
              <th class="px-6 py-4 text-center">Items/Files</th>
              <th class="px-6 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="r in reimbursements" :key="r.id" class="hover:bg-rose-50/30 transition-colors">
              <td class="px-6 py-4">
                <div class="font-bold text-slate-900">R-{{ String(r.id).padStart(5, '0') }}</div>
                <div class="text-xs text-slate-400">{{ r.reimbursement_date }}</div>
              </td>
              <td class="px-6 py-4">{{ r.plantel_nombre }}</td>
              <td class="px-6 py-4">{{ r.solicitante_nombre }}</td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{{ r.status }}</span>
              </td>
              <td class="px-6 py-4 text-center">
                <span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                   {{ r.items_count }} items / {{ r.files_count }} files
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button 
                  @click="deleteReimbursement(r)" 
                  class="text-rose-600 hover:text-rose-800 font-bold text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition"
                >
                  ELIMINAR
                </button>
              </td>
            </tr>
            <tr v-if="!reimbursements.length">
              <td colspan="6" class="p-8 text-center text-slate-400">Sin resultados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FILES TAB -->
    <div v-if="activeTab === 'archivos'" class="space-y-4">
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4">
        <input 
          v-model="fSearch" 
          @keyup.enter="fetchFiles"
          placeholder="Buscar archivo, usuario, concepto..." 
          class="flex-1 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-rose-500"
        />
        <button @click="fetchFiles" class="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800">
          Buscar
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="f in files" :key="f.item_id" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition relative group">
          <div class="flex items-start justify-between mb-2">
            <div class="bg-indigo-50 text-indigo-700 p-2 rounded-lg">
              <DocumentIcon class="w-6 h-6" />
            </div>
            <span class="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600">
              R-{{ String(f.reimbursement_id).padStart(5,'0') }}
            </span>
          </div>
          
          <div class="mb-3">
             <div class="text-sm font-bold text-slate-800 truncate" :title="f.file_url">{{ f.file_url }}</div>
             <div class="text-xs text-slate-500">{{ f.user_name }} • {{ f.plantel_name }}</div>
             <div class="text-xs text-slate-400 mt-1 italic">{{ f.concept }}</div>
          </div>

          <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100">
             <a :href="`/uploads/${f.file_url}`" target="_blank" class="flex-1 text-center py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100">
                Ver
             </a>
             <button @click="triggerReplace(f)" class="flex-1 text-center py-1.5 text-xs font-bold text-amber-600 bg-amber-50 rounded hover:bg-amber-100">
                Reemplazar
             </button>
             <button @click="deleteFile(f)" class="flex-1 text-center py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded hover:bg-rose-100">
                Borrar
             </button>
          </div>
        </div>
      </div>
      
      <div v-if="!files.length" class="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
         No se encontraron archivos.
      </div>
    </div>

    <!-- Hidden File Input for Replacement -->
    <input type="file" ref="fileInput" class="hidden" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
import { ShieldCheckIcon, CurrencyDollarIcon, FolderOpenIcon, DocumentIcon } from '@heroicons/vue/24/outline';

definePageMeta({ middleware: 'auth' });

// State
const activeTab = ref<'reembolsos' | 'archivos'>('reembolsos');
const planteles = ref<any[]>([]);

// Reimbursement State
const rSearch = ref('');
const rPlantelId = ref(0);
const reimbursements = ref<any[]>([]);

// File State
const fSearch = ref('');
const files = ref<any[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const fileTargetItem = ref<any>(null);

// Methods
const loadMeta = async () => {
  const meta: any = await $fetch('/api/admin/meta');
  planteles.value = meta.planteles || [];
};

const fetchReembolsos = async () => {
  reimbursements.value = await $fetch<any[]>('/api/admin/super/reimbursements', {
    params: { search: rSearch.value, plantelId: rPlantelId.value }
  });
};

const deleteReimbursement = async (r: any) => {
  const code = Math.floor(1000 + Math.random() * 9000);
  const input = prompt(`PELIGRO: Esto borrará la solicitud, todos los items y sus archivos.\nEscribe "${code}" para confirmar:`);
  
  if (input !== String(code)) return alert('Código incorrecto. Cancelado.');
  
  try {
    await $fetch('/api/admin/super/reimbursements', {
      method: 'DELETE',
      body: { id: r.id }
    });
    await fetchReembolsos();
  } catch (e: any) {
    alert('Error: ' + e.message);
  }
};

const fetchFiles = async () => {
  files.value = await $fetch<any[]>('/api/admin/super/files', {
    params: { search: fSearch.value }
  });
};

const deleteFile = async (f: any) => {
  if(!confirm(`¿Borrar archivo "${f.file_url}"? No se puede deshacer.`)) return;
  try {
    await $fetch('/api/admin/super/files', {
      method: 'POST',
      body: { itemId: f.item_id, action: 'delete' }
    });
    await fetchFiles();
  } catch (e: any) {
    alert('Error: ' + e.message);
  }
};

const triggerReplace = (f: any) => {
  fileTargetItem.value = f;
  fileInput.value?.click();
};

const handleFileChange = async (e: any) => {
  const file = e.target.files[0];
  if (!file || !fileTargetItem.value) return;

  const fd = new FormData();
  fd.append('file', file);
  fd.append('itemId', fileTargetItem.value.item_id);

  try {
    await $fetch('/api/admin/super/files', { method: 'POST', body: fd });
    await fetchFiles();
    alert('Archivo reemplazado exitosamente.');
  } catch (e: any) {
    alert('Error al subir: ' + e.message);
  } finally {
    if(fileInput.value) fileInput.value.value = '';
    fileTargetItem.value = null;
  }
};

onMounted(() => {
  loadMeta();
  fetchReembolsos();
  fetchFiles();
});
</script>