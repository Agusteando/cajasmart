<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
    
    <!-- Login Card -->
    <div class="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 text-center">
      
      <!-- Brand Identity -->
      <div class="mb-10">
        <div class="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">
          C
        </div>
        <h1 class="text-2xl font-bold text-slate-900 mt-4 tracking-tight">CajaSmart</h1>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">IECS - IEDIS</p>
      </div>

      <!-- Actions -->
      <div class="space-y-6">
        
        <!-- Google Button -->
        <a href="/api/auth/google" class="group relative w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer text-decoration-none">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="G">
          <span class="group-hover:text-slate-900">Iniciar Sesión con Google</span>
        </a>

        <!-- Error Feedback (Only appears if something goes wrong) -->
        <div v-if="errorMsg" class="animate-fade-in p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100 flex items-center gap-2 justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          {{ errorMsg }}
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="mt-8 text-slate-400 text-xs text-center opacity-80">
      <p>&copy; 2026 Sistema Financiero IEDIS</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'none' });
const route = useRoute();
const errorMsg = ref('');

// Handle errors returned from the server (e.g. wrong domain)
onMounted(() => {
  const code = route.query.error;
  if (code === 'unauthorized_domain') errorMsg.value = "Acceso no autorizado para este dominio.";
  if (code === 'unauthorized_email') errorMsg.value = "Usuario no registrado en el sistema.";
  if (code === 'server_error') errorMsg.value = "Error de conexión temporal.";
  if (code === 'no_code') errorMsg.value = "Inicio de sesión cancelado.";
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>