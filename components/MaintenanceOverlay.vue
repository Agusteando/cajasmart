<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md text-white px-4 text-center">
      
      <div class="mb-8 relative">
        <div class="w-24 h-24 rounded-full border-4 border-indigo-500/30 flex items-center justify-center animate-pulse">
          <div class="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8 animate-spin">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>
      </div>

      <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-4">
        Se está actualizando el sistema
      </h1>
      
      <p class="text-slate-300 text-lg max-w-md mx-auto mb-8 leading-relaxed">
        Estamos aplicando mejoras en este momento. La aplicación se recargará automáticamente cuando termine.
      </p>

      <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 max-w-sm w-full">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tiempo estimado restante</div>
        <div class="text-4xl font-mono font-bold text-emerald-400">
          {{ formattedTime }}
        </div>
        <div class="w-full bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
          <div class="h-full bg-emerald-500 animate-progress origin-left" style="width: 100%"></div>
        </div>
      </div>

      <p class="mt-10 text-slate-500 text-sm">
        No cierres esta ventana.
      </p>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ visible: boolean }>();

// Fake countdown logic (5 minutes)
const secondsLeft = ref(300); 

const formattedTime = computed(() => {
  const m = Math.floor(secondsLeft.value / 60);
  const s = secondsLeft.value % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

let timer: any = null;

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Reset timer when overlay appears
    secondsLeft.value = 300; 
    timer = setInterval(() => {
      if (secondsLeft.value > 0) secondsLeft.value--;
    }, 1000);
  } else {
    if (timer) clearInterval(timer);
  }
});
</script>

<style scoped>
.animate-progress {
  animation: shrink 300s linear forwards;
}

@keyframes shrink {
  from { width: 100%; }
  to { width: 0%; }
}
</style>