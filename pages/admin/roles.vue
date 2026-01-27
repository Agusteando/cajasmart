<template>
  <div>
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Roles</h1>
        <p class="text-slate-500 mt-1">Administra roles y niveles de permiso.</p>
      </div>
      <button
        @click="openModal()"
        class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all"
      >
        + Nuevo Rol
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nivel Permiso</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in roles" :key="r.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 font-semibold text-slate-900">{{ r.nombre }}</td>
            <td class="px-6 py-4 font-mono text-slate-700">{{ r.nivel_permiso }}</td>
            <td class="px-6 py-4 text-right">
              <button @click="openModal(r)" class="text-indigo-600 hover:text-indigo-900 font-medium text-sm">
                Editar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showModal = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-bold text-lg text-slate-800">{{ isEditing ? 'Editar Rol' : 'Crear Rol' }}</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form @submit.prevent="save" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              v-model="form.nombre"
              type="text"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              required
              placeholder="Ej: REVISOR_OPS"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nivel de permiso</label>
            <input
              v-model.number="form.nivel_permiso"
              type="number"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
              required
              min="1"
            />
          </div>

          <div class="pt-4 flex justify-end gap-3">
            <button
              type="button"
              @click="showModal = false"
              class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md transition"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

type RoleRow = { id: number; nombre: string; nivel_permiso: number };

const roles = ref<RoleRow[]>([]);
const showModal = ref(false);
const isEditing = ref(false);

const form = ref<any>({
  id: null,
  nombre: '',
  nivel_permiso: 1
});

const refresh = async () => {
  roles.value = await $fetch('/api/crud/roles');
};

const openModal = (item: any = null) => {
  if (item) {
    form.value = { ...item };
    isEditing.value = true;
  } else {
    form.value = { id: null, nombre: '', nivel_permiso: 1 };
    isEditing.value = false;
  }
  showModal.value = true;
};

const save = async () => {
  const method = isEditing.value ? 'PUT' : 'POST';
  await $fetch('/api/crud/roles', { method, body: form.value });
  showModal.value = false;
  await refresh();
};

onMounted(refresh);
</script>
