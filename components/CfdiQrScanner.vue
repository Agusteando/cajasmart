<template>
  <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
    <!-- Tabs -->
    <div class="flex border-b border-slate-200">
      <button 
        @click="mode = 'webcam'"
        class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        :class="mode === 'webcam' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'"
      >
        <VideoCameraIcon class="w-5 h-5" />
        Usar Webcam
      </button>
      <button 
        @click="activatePhoneMode"
        class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        :class="mode === 'phone' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'"
      >
        <DevicePhoneMobileIcon class="w-5 h-5" />
        Usar Celular
      </button>
    </div>

    <div class="p-6">
      <!-- WEBCAM MODE -->
      <div v-if="mode === 'webcam'" class="space-y-4">
        <div class="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
          <video v-show="scanning" ref="videoEl" class="w-full h-full object-cover"></video>
          
          <div v-if="!scanning" class="text-center p-6">
            <VideoCameraIcon class="w-12 h-12 text-slate-500 mx-auto mb-2" />
            <p class="text-slate-400 text-sm">Cámara desactivada</p>
          </div>

          <div v-if="cameraError" class="absolute inset-0 bg-slate-900 flex items-center justify-center p-6 text-center">
            <p class="text-rose-400 text-sm">{{ cameraError }}</p>
          </div>
        </div>

        <div class="flex justify-center">
          <button 
            v-if="!scanning" 
            @click="startCamera" 
            class="bg-slate-900 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-slate-800 transition"
          >
            Activar Cámara
          </button>
          <button 
            v-else 
            @click="stopCamera" 
            class="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-full font-bold hover:bg-slate-50 transition"
          >
            Detener
          </button>
        </div>
      </div>

      <!-- PHONE MODE -->
      <div v-else class="text-center space-y-6">
        <div v-if="phoneStatus === 'idle' || phoneStatus === 'waiting'">
          <h3 class="font-bold text-slate-800 text-lg">Convierte tu celular en escáner</h3>
          <p class="text-slate-500 text-sm mb-4">Escanea este código para abrir la cámara en tu teléfono.</p>
          
          <div class="flex justify-center my-4">
            <div v-if="phoneQrDataUrl" class="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
               <img :src="phoneQrDataUrl" class="w-48 h-48 mix-blend-multiply" />
            </div>
            <div v-else class="w-48 h-48 flex items-center justify-center">
              <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
          </div>

          <div class="flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium animate-pulse">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
            Esperando conexión del teléfono...
          </div>
        </div>

        <div v-else-if="phoneStatus === 'received'" class="py-10">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon class="w-8 h-8" />
          </div>
          <h3 class="font-bold text-slate-900 text-xl">¡Datos Recibidos!</h3>
          <p class="text-slate-500">La información del CFDI se ha cargado.</p>
        </div>

        <div v-else-if="phoneStatus === 'expired'" class="py-6">
           <p class="text-rose-600 font-bold">El código expiró.</p>
           <button @click="activatePhoneMode" class="mt-2 text-indigo-600 underline">Generar nuevo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VideoCameraIcon, DevicePhoneMobileIcon, CheckIcon } from '@heroicons/vue/24/solid';
import QRCode from 'qrcode';

const emit = defineEmits<{ (e: 'prefill', data: any): void }>();

const mode = ref<'webcam' | 'phone'>('webcam');
const scanning = ref(false);
const videoEl = ref<HTMLVideoElement | null>(null);
const cameraError = ref('');
let controls: any = null;

// Phone Logic
const phoneStatus = ref<'idle' | 'waiting' | 'received' | 'expired'>('idle');
const phoneQrDataUrl = ref('');
let pollTimer: any = null;

// --- WEBCAM LOGIC ---
async function startCamera() {
  cameraError.value = '';
  scanning.value = true;
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    await reader.decodeFromVideoDevice(undefined, videoEl.value!, (res: any) => {
      if (res?.getText) {
        processText(res.getText());
        stopCamera();
      }
    });
    controls = reader;
  } catch (e: any) {
    scanning.value = false;
    cameraError.value = "No se pudo acceder a la cámara.";
  }
}

function stopCamera() {
  scanning.value = false;
  if (controls?.reset) controls.reset();
  controls = null;
}

// --- PHONE LOGIC ---
async function activatePhoneMode() {
  mode.value = 'phone';
  phoneStatus.value = 'idle';
  if (pollTimer) clearInterval(pollTimer);
  stopCamera(); // Ensure webcam is off

  try {
    // Generate session
    const s: any = await $fetch('/api/qr-session/create', { method: 'POST' });
    phoneQrDataUrl.value = await QRCode.toDataURL(s.scanUrl, { width: 300, margin: 2, color: { dark: '#1e293b' } });
    phoneStatus.value = 'waiting';

    // Poll
    pollTimer = setInterval(async () => {
      try {
        const r: any = await $fetch('/api/qr-session/poll', { params: { token: s.token } });
        if (r.status === 'READY') {
          phoneStatus.value = 'received';
          clearInterval(pollTimer);
          // Apply data
          emit('prefill', r.payload?.prefill || {});
          // Auto switch back or just flash success
          setTimeout(() => { mode.value = 'webcam'; }, 2000); 
        } else if (r.status === 'EXPIRED') {
          phoneStatus.value = 'expired';
          clearInterval(pollTimer);
        }
      } catch {}
    }, 1500);
  } catch (e) {
    console.error(e);
  }
}

async function processText(text: string) {
  const res: any = await $fetch('/api/cfdi/parse', { method: 'POST', body: { text } });
  emit('prefill', res.prefill);
}

onBeforeUnmount(() => {
  stopCamera();
  if (pollTimer) clearInterval(pollTimer);
});
</script>