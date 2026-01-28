<template>
  <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
    <div class="flex items-center justify-between">
      <div class="font-bold text-slate-800">Escanear QR (CFDI)</div>
      <div class="flex gap-2">
        <button
          v-if="!scanning"
          @click="startCamera"
          class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
        >
          Usar cámara
        </button>
        <button
          v-else
          @click="stopCamera"
          class="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
        >
          Detener
        </button>
      </div>
    </div>

    <div v-if="cameraError" class="text-xs text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded-lg">
      {{ cameraError }}
    </div>

    <div v-show="scanning" class="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <video ref="videoEl" class="w-full h-52 object-cover" muted playsinline></video>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Pegar texto/URL del QR (opcional)
        </label>
        <div class="flex gap-2">
          <input
            v-model="manualText"
            class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=..."
          />
          <button
            @click="submitText(manualText)"
            class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
          >
            Prefill
          </button>
        </div>
      </div>

      <div class="border border-slate-200 rounded-lg p-3 bg-slate-50">
        <div class="flex items-center justify-between">
          <div class="font-bold text-slate-800 text-sm">Usar celular</div>
          <button
            @click="createPhoneLink"
            class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100"
            :disabled="phoneBusy"
          >
            {{ phoneBusy ? 'Generando…' : 'Generar link' }}
          </button>
        </div>

        <div v-if="phoneScanUrl" class="mt-2 space-y-2">
          <div class="text-xs text-slate-600 break-all">
            <span class="font-semibold">Link:</span>
            <a :href="phoneScanUrl" target="_blank" class="text-indigo-700 underline font-semibold ml-1">
              abrir
            </a>
          </div>

          <div v-if="phoneQrDataUrl" class="flex items-center gap-3">
            <img :src="phoneQrDataUrl" class="w-24 h-24 bg-white p-1 rounded border border-slate-200" alt="QR phone link" />
            <div class="text-xs text-slate-600">
              Escanéalo con el celular para abrir la cámara y enviar los datos aquí automáticamente.
              <div class="mt-2">
                <span class="font-semibold">Estado:</span>
                <span class="ml-1">{{ phoneStatus }}</span>
              </div>
            </div>
          </div>

          <div v-if="phoneError" class="text-xs text-rose-700">
            {{ phoneError }}
          </div>
        </div>

        <div v-else class="text-xs text-slate-500 mt-2">
          Útil si la PC no tiene cámara.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode';

const emit = defineEmits<{
  (e: 'prefill', data: any): void;
  (e: 'debug', data: any): void;
}>();

const scanning = ref(false);
const cameraError = ref('');
const videoEl = ref<HTMLVideoElement | null>(null);
const manualText = ref('');

let controls: any = null;

async function startCamera() {
  cameraError.value = '';
  scanning.value = true;

  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();

    // decodeFromVideoDevice returns controls via promise in newer versions; callback gets result continuously
    await reader.decodeFromVideoDevice(
      undefined,
      videoEl.value!,
      async (result: any, err: any) => {
        if (result?.getText) {
          const text = result.getText();
          stopCamera(reader);
          await submitText(text);
        }
      }
    );

    // If version returns controls, keep it (some versions provide stop via reader.reset()).
    controls = reader;
  } catch (e: any) {
    scanning.value = false;
    cameraError.value =
      e?.message ||
      'No se pudo iniciar la cámara (permiso denegado o sin dispositivo).';
  }
}

function stopCamera(readerArg?: any) {
  scanning.value = false;
  try {
    const r = readerArg || controls;
    if (r?.reset) r.reset();
  } catch {}
  controls = null;
}

async function submitText(text: string) {
  const t = String(text || '').trim();
  if (!t) return;

  const res: any = await $fetch('/api/cfdi/parse', {
    method: 'POST',
    body: { text: t }
  });

  emit('debug', res);
  emit('prefill', res?.prefill || {});
}

// --- Phone handoff ---
const phoneBusy = ref(false);
const phoneToken = ref('');
const phoneScanUrl = ref('');
const phoneQrDataUrl = ref('');
const phoneStatus = ref<'idle' | 'waiting' | 'received' | 'expired'>('idle');
const phoneError = ref('');
let pollTimer: any = null;

async function createPhoneLink() {
  phoneBusy.value = true;
  phoneError.value = '';
  phoneStatus.value = 'idle';
  phoneToken.value = '';
  phoneScanUrl.value = '';
  phoneQrDataUrl.value = '';
  if (pollTimer) clearInterval(pollTimer);

  try {
    const s: any = await $fetch('/api/qr-session/create', { method: 'POST' });
    phoneToken.value = s.token;
    phoneScanUrl.value = s.scanUrl;

    phoneQrDataUrl.value = await QRCode.toDataURL(phoneScanUrl.value, {
      margin: 1,
      width: 256
    });

    phoneStatus.value = 'waiting';

    pollTimer = setInterval(async () => {
      try {
        const r: any = await $fetch('/api/qr-session/poll', {
          params: { token: phoneToken.value }
        });

        if (r.status === 'READY') {
          phoneStatus.value = 'received';
          clearInterval(pollTimer);
          pollTimer = null;

          emit('debug', r.payload);
          emit('prefill', r.payload?.prefill || {});
        } else if (r.status === 'EXPIRED') {
          phoneStatus.value = 'expired';
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } catch {}
    }, 1200);
  } catch (e: any) {
    phoneError.value = e?.data?.statusMessage || 'No se pudo generar el link.';
  } finally {
    phoneBusy.value = false;
  }
}

onBeforeUnmount(() => {
  stopCamera();
  if (pollTimer) clearInterval(pollTimer);
});
</script>
