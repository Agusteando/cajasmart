<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Usuarios</h1>
        <p class="text-slate-500 mt-1">
          Asigna roles/planteles/activo y usa impersonación para probar permisos.
        </p>
      </div>

      <!-- Impersonation Card -->
      <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div class="flex items-center justify-between">
          <div class="font-bold text-slate-900">Impersonación (testing)</div>
          <span
            v-if="user?.is_impersonating"
            class="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
          >
            ACTIVA
          </span>
        </div>

        <div v-if="user?.is_impersonating" class="mt-3 text-sm text-slate-700">
          <div class="font-semibold">
            Actuando como: <span class="font-bold">{{ user.role_name }}</span>
          </div>
          <div class="text-slate-500">
            Plantel: <span class="font-semibold">{{ user.plantel_nombre || 'Corporativo Global' }}</span>
          </div>
          <div class="mt-3">
            <button
              class="w-full px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              @click="stopImpersonation"
              :disabled="busyImpersonation"
            >
              {{ busyImpersonation ? 'Procesando...' : 'Detener impersonación' }}
            </button>
          </div>
        </div>

        <div v-else class="mt-4 space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Rol
            </label>
            <select
              v-model="impRole"
              class="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option v-for="r in roles" :key="r.id" :value="r.nombre">
                {{ r.nombre }} (nivel {{ r.nivel_permiso }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Plantel (opcional)
            </label>
            <select
              v-model="impPlantel"
              class="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option :value="null">— Corporativo Global —</option>
              <option v-for="p in planteles" :key="p.id" :value="p.id">
                {{ p.codigo }} — {{ p.nombre }}
              </option>
            </select>
            <p class="text-xs text-slate-500 mt-1">
              Para <span class="font-semibold">ADMIN_PLANTEL</span> es requerido para evitar onboarding.
            </p>
          </div>

          <button
            class="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            @click="startImpersonation"
            :disabled="busyImpersonation"
          >
            {{ busyImpersonation ? 'Iniciando...' : 'Impersonar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
      <input
        v-model="q"
        placeholder="Buscar por nombre o email..."
        class="flex-1 border border-slate-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        class="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
        @click="refreshAll"
        :disabled="loading"
      >
        {{ loading ? 'Cargando...' : 'Actualizar' }}
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table class="w-full text-left">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Usuario</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rol</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plantel</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Activo</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="u in filteredUsers"
            :key="u.id"
            class="hover:bg-slate-50 transition"
          >
            <td class="px-6 py-4">
              <div class="font-semibold text-slate-900">{{ u.nombre }}</div>
              <div class="text-sm text-slate-500">{{ u.email }}</div>
              <div class="text-xs text-slate-400 mt-1">ID: {{ u.id }}</div>
            </td>

            <td class="px-6 py-4">
              <select
                v-model="u._edit.role_name"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="r in roles" :key="r.id" :value="r.nombre">
                  {{ r.nombre }}
                </option>
              </select>
              <div class="text-xs text-slate-400 mt-1">
                Nivel: {{ roleLevelFor(u._edit.role_name) }}
              </div>
            </td>

            <td class="px-6 py-4">
              <select
                v-model="u._edit.plantel_id"
                class="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                :disabled="u._edit.role_name !== 'ADMIN_PLANTEL'"
              >
                <option :value="null">—</option>
                <option v-for="p in planteles" :key="p.id" :value="p.id">
                  {{ p.codigo }} — {{ p.nombre }}
                </option>
              </select>
              <div class="text-xs text-slate-500 mt-1">
                <span v-if="u._edit.role_name !== 'ADMIN_PLANTEL'">
                  (No aplica para este rol)
                </span>
                <span v-else>
                  Requerido para solicitantes.
                </span>
              </div>
            </td>

            <td class="px-6 py-4">
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" v-model="u._edit.activo" class="w-4 h-4 rounded border-slate-300" />
                <span class="text-sm font-semibold" :class="u._edit.activo ? 'text-emerald-700' : 'text-red-600'">
                  {{ u._edit.activo ? 'Sí' : 'No' }}
                </span>
              </label>
            </td>

            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                  @click="saveUser(u)"
                  :disabled="u._saving"
                >
                  {{ u._saving ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
              <div v-if="u._error" class="text-xs text-red-600 mt-2">
                {{ u._error }}
              </div>
              <div v-if="u._saved" class="text-xs text-emerald-700 mt-2">
                Guardado.
              </div>
            </td>
          </tr>

          <tr v-if="!loading && filteredUsers.length === 0">
            <td colspan="5" class="px-6 py-10 text-center text-slate-500">
              Sin resultados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

import { useUserCookie } from '~/composables/useUserCookie';

type RoleRow = { id: number; nombre: string; nivel_permiso: number };
type PlantelRow = { id: number; codigo: string; nombre: string; activo?: number | boolean };

type UserRow = {
  id: number;
  nombre: string;
  email: string;
  activo: number | boolean;
  plantel_id: number | null;
  plantel_codigo?: string | null;
  plantel_nombre?: string | null;
  role_name: string;
  role_level: number;

  _edit: {
    role_name: string;
    plantel_id: number | null;
    activo: boolean;
  };
  _saving: boolean;
  _saved: boolean;
  _error: string;
};

const userCookie = useUserCookie();
const user = computed(() => userCookie.value);

const loading = ref(true);
const q = ref('');

const roles = ref<RoleRow[]>([]);
const planteles = ref<PlantelRow[]>([]);
const users = ref<UserRow[]>([]);

const busyImpersonation = ref(false);
const impRole = ref<string>('REVISOR_OPS');
const impPlantel = ref<number | null>(null);

const roleLevelFor = (roleName: string) => {
  const r = roles.value.find(x => x.nombre === roleName);
  return r ? r.nivel_permiso : 0;
};

const filteredUsers = computed(() => {
  const s = (q.value || '').trim().toLowerCase();
  if (!s) return users.value;
  return users.value.filter(u =>
    String(u.nombre || '').toLowerCase().includes(s) ||
    String(u.email || '').toLowerCase().includes(s)
  );
});

const hydrateUsers = (rows: any[]) => {
  users.value = (rows || []).map((u: any) => ({
    ...u,
    _edit: {
      role_name: String(u.role_name || ''),
      plantel_id: u.plantel_id == null ? null : Number(u.plantel_id),
      activo: Number(u.activo) === 1
    },
    _saving: false,
    _saved: false,
    _error: ''
  }));
};

const loadMeta = async () => {
  const meta: any = await $fetch('/api/admin/meta');
  roles.value = meta.roles || [];
  planteles.value = meta.planteles || [];
  // default impersonation selection (first non-super-admin role if exists)
  if (!roles.value.find(r => r.nombre === impRole.value)) {
    const fallback = roles.value.find(r => r.nombre !== 'SUPER_ADMIN') || roles.value[0];
    if (fallback) impRole.value = fallback.nombre;
  }
};

const loadUsers = async () => {
  const rows: any[] = await $fetch('/api/admin/users');
  hydrateUsers(rows);
};

const refreshAll = async () => {
  loading.value = true;
  try {
    await loadMeta();
    await loadUsers();
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'No se pudo cargar usuarios/meta');
  } finally {
    loading.value = false;
  }
};

const saveUser = async (u: UserRow) => {
  u._saving = true;
  u._saved = false;
  u._error = '';

  try {
    // small guard: if ADMIN_PLANTEL, require plantel
    if (u._edit.role_name === 'ADMIN_PLANTEL' && !u._edit.plantel_id) {
      throw { data: { statusMessage: 'ADMIN_PLANTEL requiere plantel' } };
    }

    const res: any = await $fetch('/api/admin/users/update', {
      method: 'POST',
      body: {
        userId: u.id,
        roleName: u._edit.role_name,
        plantelId: u._edit.plantel_id,
        activo: u._edit.activo
      }
    });

    u._saved = true;
    setTimeout(() => (u._saved = false), 1200);

    if (res?.user) {
      // keep row fresh
      const fresh = res.user;
      u.role_name = fresh.role_name;
      u.role_level = fresh.role_level;
      u.plantel_id = fresh.plantel_id == null ? null : Number(fresh.plantel_id);
      u.plantel_nombre = fresh.plantel_nombre || null;
      u.activo = fresh.activo;

      // keep edits aligned
      u._edit.role_name = String(fresh.role_name || u._edit.role_name);
      u._edit.plantel_id = fresh.plantel_id == null ? null : Number(fresh.plantel_id);
      u._edit.activo = Number(fresh.activo) === 1;
    }
  } catch (e: any) {
    u._error = e?.data?.statusMessage || 'Error al guardar';
  } finally {
    u._saving = false;
  }
};

const startImpersonation = async () => {
  busyImpersonation.value = true;
  try {
    const res: any = await $fetch('/api/admin/impersonate/start', {
      method: 'POST',
      body: {
        roleName: impRole.value,
        plantelId: impPlantel.value
      }
    });
    if (res?.user) userCookie.value = res.user;
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'No se pudo iniciar impersonación');
  } finally {
    busyImpersonation.value = false;
  }
};

const stopImpersonation = async () => {
  busyImpersonation.value = true;
  try {
    const res: any = await $fetch('/api/admin/impersonate/stop', { method: 'POST' });
    if (res?.user) userCookie.value = res.user;
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'No se pudo detener impersonación');
  } finally {
    busyImpersonation.value = false;
  }
};

onMounted(refreshAll);
</script>
