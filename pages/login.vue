<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
    <div class="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 text-center">
      
      <div class="mb-8">
        <div class="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">C</div>
        <h1 class="text-2xl font-bold text-slate-900 mt-4">CajaSmart</h1>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">IECS - IEDIS</p>
      </div>

      <div class="space-y-6">
        <p class="text-slate-600 text-sm">
          Acceso para personal <strong>@casitaiedis.edu.mx</strong>
        </p>

        <!-- 
           ⚡ CRITICAL: Use a standard <a> tag. 
           Do not use <NuxtLink>.
           This forces the browser to load the URL directly.
        -->
        <a href="/api/auth/google" class="group relative w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer text-decoration-none">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="G">
          <span class="group-hover:text-slate-900">Entrar con Google</span>
        </a>

        <div v-if="errorMsg" class="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100">
          {{ errorMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'none' });
const route = useRoute();
const errorMsg = ref('');

onMounted(() => {
  const code = route.query.error;
  if (code === 'unauthorized_domain') errorMsg.value = "⚠️ Correo no autorizado.";
  if (code === 'server_error') errorMsg.value = "⚠️ Error del servidor.";
  if (code === 'no_code') errorMsg.value = "⚠️ Cancelado por usuario.";
});
</script>