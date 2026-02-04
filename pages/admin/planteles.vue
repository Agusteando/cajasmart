<template>
  <div>
    <!-- Action Bar -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Planteles</h1>
        <p class="text-slate-500 mt-1">Administra las sucursales, presupuestos y razón social.</p>
      </div>
      <button @click="openModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
        <PlusIcon class="w-5 h-5" /> Nuevo Plantel
      </button>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Razón Social</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Presupuesto</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="p in planteles" :key="p.id" class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 font-mono text-sm text-slate-600">{{ p.codigo }}</td>
            <td class="px-6 py-4 font-medium text-slate-900">{{ p.nombre }}</td>
            <td class="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate">{{ p.razon_social_nombre || 'Sin asignar' }}</td>
            <td class="px-6 py-4 text-slate-600">${{ Number(p.presupuesto_mensual).toLocaleString() }}</td>
            <td class="px-6 py-4">
              <span :class="p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'" class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                <div :class="p.activo ? 'bg-emerald-500' : 'bg-red-500'" class="w-1.5 h-1.5 rounded-full"></div>
                {{ p.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button @click="openModal(p)" class="text-indigo-600 hover:text-indigo-900 font-medium text-sm">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal (Floating) -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showModal = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-fade-in-up">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-bold text-lg text-slate-800">{{ isEditing ? 'Editar Plantel' : 'Crear Plantel' }}</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <form @submit.prevent="save" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Código (Acronimo)</label>
              <input v-model="form.codigo" type="text" placeholder="Ej: PM" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" required>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Presupuesto Mensual</label>
              <input v-model="form.presupuesto_mensual" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
            <input v-model="form.nombre" type="text" placeholder="Ej: Plantel Metepec" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" required>
          </div>

          <div>
             <label class="block text-sm font-medium text-slate-700 mb-1">Razón Social (Para Facturas)</label>
             <select v-model="form.razon_social_id" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
                <option :value="null">-- Seleccionar --</option>
                <option v-for="rs in razonesList" :key="rs.id" :value="rs.id">{{ rs.nombre }}</option>
             </select>
          </div>

          <div class="flex items-center gap-2 mt-2">
            <input v-model="form.activo" type="checkbox" id="active" class="w-4 h-4 text-indigo-600 rounded">
            <label for="active" class="text-sm text-slate-700">Sucursal Operativa</label>
          </div>

          <div class="pt-4 flex justify-end gap-3">
            <button type="button" @click="showModal = false" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancelar</button>
            <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md transition">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PlusIcon } from '@heroicons/vue/24/solid';

const planteles = ref([]);
const razonesList = ref([]);
const showModal = ref(false);
const isEditing = ref(false);
const form = ref({ codigo: '', nombre: '', presupuesto_mensual: 0, razon_social_id: null, activo: true });

// Fetch Data
const refresh = async () => {
  planteles.value = await $fetch('/api/crud/planteles');
  const meta = await $fetch('/api/admin/meta');
  razonesList.value = meta.razones_sociales || [];
}

// Modal Logic
const openModal = (item = null) => {
  if (item) {
    form.value = { ...item };
    isEditing.value = true;
  } else {
    // Default to first RS if available
    const defaultRS = razonesList.value.length ? razonesList.value[0].id : null;
    form.value = { codigo: '', nombre: '', presupuesto_mensual: 0, razon_social_id: defaultRS, activo: true };
    isEditing.value = false;
  }
  showModal.value = true;
};

// Save Logic
const save = async () => {
  const method = isEditing.value ? 'PUT' : 'POST';
  await $fetch('/api/crud/planteles', { method, body: form.value });
  showModal.value = false;
  refresh();
};

onMounted(refresh);
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>