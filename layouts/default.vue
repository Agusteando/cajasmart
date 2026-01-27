<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">
    <!-- Sidebar -->
    <aside class="w-72 bg-slate-900 text-white flex flex-col transition-all duration-300 shadow-xl z-20">
      <!-- Brand Header -->
      <div class="h-20 flex items-center px-8 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/50"
          >
            C
          </div>
          <span class="text-xl font-bold tracking-tight">CajaSmart</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <p class="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Principal</p>

        <!-- Keep Dashboard; middleware will redirect non-super admins from / to their role home -->
        <NavLink to="/" icon="HomeIcon">Dashboard</NavLink>

        <!-- Role workspaces -->
        <NavLink
          v-if="user?.role_name === 'ADMIN_PLANTEL' || user?.role_name === 'SUPER_ADMIN'"
          to="/reembolsos"
          icon="CurrencyDollarIcon"
        >
          Mis Reembolsos
        </NavLink>

        <NavLink
          v-if="user?.role_name === 'REVISOR_OPS' || user?.role_name === 'SUPER_ADMIN'"
          to="/ops"
          icon="ClipboardDocumentCheckIcon"
        >
          Revisión Operativa
        </NavLink>

        <NavLink
          v-if="user?.role_name === 'REVISOR_FISCAL' || user?.role_name === 'SUPER_ADMIN'"
          to="/fiscal"
          icon="ScaleIcon"
        >
          Revisión Fiscal
        </NavLink>

        <NavLink
          v-if="user?.role_name === 'TESORERIA' || user?.role_name === 'SUPER_ADMIN'"
          to="/tesoreria"
          icon="BanknotesIcon"
        >
          Tesorería
        </NavLink>

        <NavLink to="/notificaciones" icon="BellIcon">Notificaciones</NavLink>

        <!-- Admin Section -->
        <div v-if="user?.role_name === 'SUPER_ADMIN'">
          <p class="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2">Gestión</p>
          <NavLink to="/admin/planteles" icon="BuildingOfficeIcon">Planteles</NavLink>
          <NavLink to="/admin/usuarios" icon="UsersIcon">Usuarios</NavLink>
          <NavLink to="/admin/roles" icon="ShieldCheckIcon">Roles</NavLink>
        </div>
      </nav>

      <!-- User Profile & Logout -->
      <div class="p-6 border-t border-slate-800 bg-slate-900 space-y-4">
        <!-- Impersonation banner -->
        <div
          v-if="user?.is_impersonating"
          class="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2"
        >
          <div class="text-[11px] uppercase tracking-wider text-amber-200 font-semibold">
            Impersonando
          </div>
          <div class="text-sm font-bold text-amber-100">
            {{ user.role_name }}
            <span class="text-amber-200/80 font-semibold">
              · {{ user.plantel_nombre || 'Corporativo Global' }}
            </span>
          </div>
          <button
            @click="stopImpersonation"
            class="mt-2 w-full text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-lg py-2 transition"
          >
            Detener impersonación
          </button>
        </div>

        <div class="flex items-center gap-3">
          <img
            v-if="user?.avatar"
            :src="user.avatar"
            class="w-10 h-10 rounded-full border-2 border-slate-700 object-cover"
            alt="Avatar"
          />

          <div
            v-else
            class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold text-white border-2 border-slate-700"
          >
            {{ user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'U' }}
          </div>

          <div class="overflow-hidden">
            <p class="text-sm font-medium text-white truncate w-32">{{ user?.nombre || 'Usuario' }}</p>
            <p class="text-xs text-slate-400 truncate">{{ user?.email }}</p>
          </div>
        </div>

        <button
          @click="logout"
          class="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 py-2 rounded transition-colors"
        >
          <ArrowLeftStartOnRectangleIcon class="w-4 h-4" /> Cerrar Sesión
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
      <!-- Top Header -->
      <header
        class="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10"
      >
        <h2 class="text-2xl font-semibold text-slate-800 capitalize tracking-tight">
          {{ route.meta.title || route.name }}
        </h2>

        <div class="flex items-center gap-4">
          <!-- Notifications bell (unread badge) -->
          <NotificationsBell />

          <span
            class="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100 flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {{ user?.plantel_nombre || 'Corporativo Global' }}
          </span>
        </div>
      </header>

      <div class="flex-1 overflow-auto p-8 bg-slate-50">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftStartOnRectangleIcon } from '@heroicons/vue/24/outline';
import { useUserCookie } from '~/composables/useUserCookie';

const route = useRoute();
const userCookie = useUserCookie();

const user = computed(() => userCookie.value);

const stopImpersonation = async () => {
  try {
    const res: any = await $fetch('/api/admin/impersonate/stop', { method: 'POST' });
    if (res?.user) userCookie.value = res.user;
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'No se pudo detener la impersonación');
  }
};

const logout = () => {
  userCookie.value = null;
  return navigateTo('/login');
};
</script>
