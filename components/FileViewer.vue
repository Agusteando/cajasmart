<template>
  <div class="h-full w-full flex flex-col bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative group">
    
    <!-- Red Flag: No File -->
    <div v-if="!src" class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-rose-50 border-2 border-rose-200 border-dashed m-2 rounded-xl">
      <ExclamationTriangleIcon class="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
      <h3 class="text-xl font-bold text-rose-700">SIN EVIDENCIA ADJUNTA</h3>
      <p class="text-rose-600 mt-2">Esta solicitud no tiene archivo de soporte.</p>
      <div class="mt-4 px-3 py-1 bg-rose-200 text-rose-800 text-xs font-bold rounded uppercase">
        Acción Requerida: Rechazar
      </div>
    </div>

    <!-- PDF Viewer -->
    <iframe 
      v-else-if="isPdf" 
      :src="`${src}#toolbar=0&navpanes=0&scrollbar=0`"
      class="flex-1 w-full h-full object-contain bg-slate-200"
      title="Vista previa del documento"
    ></iframe>

    <!-- Image Viewer -->
    <div v-else class="flex-1 overflow-auto flex items-center justify-center bg-slate-800/5 p-4">
      <img :src="src" class="max-w-full max-h-full object-contain shadow-lg rounded" alt="Evidencia" />
    </div>

    <!-- Floating Action: Open in New Tab -->
    <a 
      v-if="src" 
      :href="src" 
      target="_blank"
      class="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
      title="Abrir en pestaña nueva"
    >
      <ArrowTopRightOnSquareIcon class="w-5 h-5" />
    </a>
  </div>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  url: string | null;
}>();

const src = computed(() => props.url ? `/uploads/${props.url}` : null);
const isPdf = computed(() => props.url?.toLowerCase().endsWith('.pdf'));
</script>