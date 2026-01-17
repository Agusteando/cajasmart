<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800">Solicitudes de Reembolso</h2>
      <button @click="showCreateModal = true" v-if="canCreate" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow">
        + Nueva Solicitud
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white p-4 rounded shadow mb-4 flex gap-4">
      <input v-model="search" placeholder="Buscar por concepto o proveedor..." class="border p-2 rounded w-1/3">
      <select v-model="statusFilter" class="border p-2 rounded">
        <option value="">Todos los Estatus</option>
        <option value="REVISION_OPS">Revisión Operativa</option>
        <option value="REVISION_FISCAL">Revisión Fiscal</option>
        <option value="APROBADO_PAGO">Por Pagar</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
          <tr>
            <th class="p-4">Folio/Fecha</th>
            <th class="p-4">Plantel</th>
            <th class="p-4">Concepto</th>
            <th class="p-4">Monto</th>
            <th class="p-4">Estatus</th>
            <th class="p-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-gray-50">
            <td class="p-4">
              <div class="font-bold text-slate-700">{{ item.folio_factura }}</div>
              <div class="text-xs text-gray-500">{{ new Date(item.fecha_factura).toLocaleDateString() }}</div>
            </td>
            <td class="p-4 text-sm">{{ item.nombre_plantel }}</td>
            <td class="p-4">
              <div class="font-medium">{{ item.concepto }}</div>
              <div class="text-xs text-gray-500 truncate max-w-[200px]">{{ item.descripcion }}</div>
            </td>
            <td class="p-4 font-mono font-bold text-slate-700">${{ item.monto }}</td>
            <td class="p-4">
              <span :class="badgeClass(item.estatus)" class="px-2 py-1 rounded text-xs font-bold border">
                {{ formatStatus(item.estatus) }}
              </span>
            </td>
            <td class="p-4 text-right space-x-2">
              <a :href="`/uploads/${item.archivo_url}`" target="_blank" class="text-blue-600 text-xs underline">Ver PDF</a>
              
              <!-- Review Buttons -->
              <button v-if="canApprove(item)" @click="approve(item)" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold hover:bg-green-200">
                ✓ Aprobar
              </button>
               <button v-if="canApprove(item)" @click="reject(item)" class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">
                ✕ Rechazar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal (Simplified for brevity) -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white p-8 rounded-xl w-full max-w-lg shadow-2xl">
        <h3 class="text-xl font-bold mb-4">Registrar Nuevo Gasto</h3>
        <form @submit.prevent="submitCreate" class="space-y-3">
          <input v-model="form.date" type="date" required class="w-full border p-2 rounded">
          <input v-model="form.invoice" placeholder="Folio Factura" required class="w-full border p-2 rounded">
          <input v-model="form.provider" placeholder="Proveedor" required class="w-full border p-2 rounded">
          <input v-model="form.amount" type="number" placeholder="Monto Total" required class="w-full border p-2 rounded">
          <input v-model="form.concept" placeholder="Concepto Corto" required class="w-full border p-2 rounded">
          <textarea v-model="form.desc" placeholder="Justificación Detallada (¿Por qué?)" class="w-full border p-2 rounded"></textarea>
          
          <div class="bg-yellow-50 p-2 text-xs text-yellow-800 border border-yellow-200 rounded">
            ⚠️ Recuerda escanear la factura con las 3 firmas físicas antes de subirla.
          </div>
          <input type="file" @change="handleFile" required class="w-full text-sm">
          
          <div class="flex justify-end gap-2 mt-4">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 text-gray-600">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
const user = useCookie('user');
const items = ref([]);
const search = ref('');
const statusFilter = ref('');
const showCreateModal = ref(false);
const form = ref({});
const fileData = ref(null);

// Permission Logic
const canCreate = computed(() => ['ADMIN_PLANTEL', 'SUPER_ADMIN'].includes(user.value.role_name));

// Status Badge Helper
const badgeClass = (s) => {
  if (s.includes('RECHAZADO')) return 'bg-red-50 text-red-600 border-red-200';
  if (s.includes('APROBADO') || s === 'PAGADO') return 'bg-green-50 text-green-600 border-green-200';
  return 'bg-yellow-50 text-yellow-600 border-yellow-200'; // Pending states
}
const formatStatus = (s) => s.replace(/_/g, ' ');

// Filter Logic
const filteredItems = computed(() => {
  return items.value.filter(i => {
    const matchesSearch = i.concepto.toLowerCase().includes(search.value.toLowerCase()) || i.proveedor.toLowerCase().includes(search.value.toLowerCase());
    const matchesStatus = statusFilter.value ? i.estatus === statusFilter.value : true;
    return matchesSearch && matchesStatus;
  });
});

const canApprove = (item) => {
  const role = user.value.role_name;
  if (role === 'REVISOR_OPS' && item.estatus === 'REVISION_OPS') return true;
  if (role === 'REVISOR_FISCAL' && item.estatus === 'REVISION_FISCAL') return true;
  if (role === 'TESORERIA' && item.estatus === 'APROBADO_PAGO') return true;
  return false;
};

// Actions
const fetchItems = async () => {
  items.value = await $fetch('/api/solicitudes', {
    params: { userId: user.value.id, role: user.value.role_name, plantelId: user.value.plantel_id }
  });
};

const handleFile = (e) => { fileData.value = e.target.files[0]; }

const submitCreate = async () => {
  const fd = new FormData();
  Object.keys(form.value).forEach(k => fd.append(k, form.value[k]));
  fd.append('file', fileData.value);
  fd.append('userId', user.value.id);
  fd.append('plantelId', user.value.plantel_id);

  await $fetch('/api/solicitudes', { method: 'POST', body: fd });
  showCreateModal.value = false;
  fetchItems();
};

const approve = async (item) => {
  await $fetch('/api/acciones', { 
    method: 'POST', 
    body: { id: item.id, action: 'APPROVE', role: user.value.role_name } 
  });
  fetchItems();
};

const reject = async (item) => {
  const reason = prompt("Motivo del rechazo:");
  if(!reason) return;
  await $fetch('/api/acciones', { 
    method: 'POST', 
    body: { id: item.id, action: 'REJECT', role: user.value.role_name, reason } 
  });
  fetchItems();
};

onMounted(fetchItems);
</script>