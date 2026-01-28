<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-slate-900 text-white">
        <div class="font-bold text-lg">Escanear QR (CFDI)</div>
        <div class="text-xs text-slate-200 mt-1">Al escanear, se enviará a tu sesión en la computadora.</div>
      </div>

      <div class="p-6 space-y-4">
        <div v-if="status === 'sent'" class="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
          ✅ Enviado. Ya puedes regresar a la computadora.
        </div>

        <div v-else-if="error" class="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
          {{ error }}
        </div>

        <div v-show="status !== 'sent'" class="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <video ref="videoEl" class="w-full h-64 object-cover" muted playsinline></video>
        </div>

        <div class="flex gap-2">
          <button
            v-if="status !== 'sent'"
            @click="start"
            class="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Iniciar cámara
          </button>
          <button
            v-if="status !== 'sent'"
            @click="stop"
            class="flex-1 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            Detener
          </button>
        </div>

        <div class="text-xs text-slate-500">
          Token: <span class="font-mono">{{ token }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'none' });

const route = useRoute();
const token = computed(() => String(route.params.token || '').trim());

const videoEl = ref<HTMLVideoElement | null>(null);
const status = ref<'idle' | 'scanning' | 'sent'>('idle');
const error = ref('');

let reader: any = null;

async function start() {
  error.value = '';
  status.value = 'scanning';

  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    reader = new BrowserMultiFormatReader();

    await reader.decodeFromVideoDevice(
      undefined,
      videoEl.value!,
      async (result: any) => {
        if (!result?.getText) return;
        const text = result.getText();

        await $fetch('/api/qr-session/submit', {
          method: 'POST',
          body: { token: token.value, text }
        });

        stop();
        status.value = 'sent';
      }
    );
  } catch (e: any) {
    status.value = 'idle';
    error.value = e?.message || 'No se pudo abrir la cámara.';
  }
}

function stop() {
  try {
    if (reader?.reset) reader.reset();
  } catch {}
  reader = null;
  if (status.value !== 'sent') status.value = 'idle';
}

onMounted(start);
onBeforeUnmount(stop);
</script>
