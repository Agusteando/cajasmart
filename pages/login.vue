<script setup lang="ts">
definePageMeta({ 
  layout: 'none',
  middleware: 'guest' // Prevents logged-in users from accessing this page
});

const route = useRoute();
const errorMsg = ref('');

onMounted(() => {
  const code = route.query.error;
  if (code === 'unauthorized_domain') errorMsg.value = "Acceso no autorizado para este dominio.";
  else if (code === 'unauthorized_email') errorMsg.value = "Usuario no registrado en el sistema.";
  else if (code === 'server_error') errorMsg.value = "Error de conexión temporal.";
  else if (code === 'no_code') errorMsg.value = "Inicio de sesión cancelado.";
  else if (code === 'oauth_client') errorMsg.value = "Error de configuración OAuth.";
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
    <div class="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 text-center">
      <div class="mb-10">
        <div class="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">
          C
        </div>
        <h1 class="text-2xl font-bold text-slate-900 mt-4 tracking-tight">CajaSmart</h1>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">IECS - IEDIS</p>
      </div>

      <div class="space-y-6">
        <a href="/api/auth/google" class="group relative w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer text-decoration-none">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="G" />
          <span class="group-hover:text-slate-900">Iniciar Sesión con Google</span>
        </a>

        <div v-if="errorMsg" class="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100 flex items-center gap-2 justify-center">
          {{ errorMsg }}
        </div>
      </div>
    </div>
    <div class="mt-8 text-slate-400 text-xs text-center opacity-80">
      <p>&copy; 2026 Sistema Financiero IEDIS</p>
    </div>
  </div>
</template>