<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 text-white">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <SparklesIcon class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-2xl font-bold">Bienvenido a CajaSmart</h1>
            <p class="text-indigo-100">Configuración Inicial</p>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-8">
        <div v-if="loading" class="text-center py-12">
          <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-slate-500">Verificando cuenta...</p>
        </div>

        <!-- Step: Welcome -->
        <div v-else-if="step === 'welcome'" class="space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-bold text-slate-800 mb-2">¡Hola, {{ onboardingData?.user?.nombre }}!</h2>
            <p class="text-slate-500">Vamos a configurar tu perfil para que puedas usar el sistema.</p>
          </div>
          <button @click="proceed" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2">
            Comenzar <ArrowRightIcon class="w-5 h-5" />
          </button>
        </div>

        <!-- Step: Select Plantel -->
        <div v-else-if="step === 'select-plantel'" class="space-y-6">
          <div class="text-center mb-6">
            <BuildingOfficeIcon class="w-12 h-12 text-indigo-600 mx-auto mb-3" />
            <h2 class="text-xl font-bold text-slate-800 mb-2">Selecciona tu Plantel</h2>
            <p class="text-slate-500">Elige el plantel al que perteneces.</p>
          </div>

          <div class="max-h-60 overflow-y-auto space-y-2 pr-2">
            <div 
              v-for="plantel in onboardingData?.planteles" 
              :key="plantel.id"
              @click="selectedPlantel = plantel.id"
              :class="['p-4 border-2 rounded-xl cursor-pointer transition flex justify-between items-center', selectedPlantel === plantel.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300']"
            >
              <div>
                <p class="font-medium text-slate-800">{{ plantel.nombre }}</p>
                <p class="text-xs text-slate-500">{{ plantel.codigo }}</p>
              </div>
              <CheckIcon v-if="selectedPlantel === plantel.id" class="w-5 h-5 text-indigo-600" />
            </div>
          </div>

          <button @click="assignPlantel" :disabled="!selectedPlantel || processing" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {{ processing ? 'Guardando...' : 'Confirmar Plantel' }}
          </button>
        </div>

        <!-- Step: Pending Activation -->
        <div v-else-if="step === 'pending'" class="space-y-6 text-center">
          <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <ClockIcon class="w-8 h-8 text-yellow-600" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-slate-800 mb-2">Activación Pendiente</h2>
            <p class="text-slate-500">Tu usuario no tiene un rol asignado o permisos activos.</p>
          </div>
          
          <div v-if="onboardingData?.pendingRequest" class="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
            <p class="text-sm text-yellow-800 font-medium">Solicitud enviada el {{ new Date(onboardingData.pendingRequest.created_at).toLocaleDateString() }}</p>
          </div>
          
          <div v-else class="space-y-4">
            <textarea v-model="accessReason" placeholder="Indica tu puesto y por qué requieres acceso..." class="w-full border p-3 rounded-xl focus:ring-2 ring-indigo-500 outline-none"></textarea>
            <button @click="requestAccess" :disabled="processing" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50">
              {{ processing ? 'Enviando...' : 'Solicitar Acceso' }}
            </button>
          </div>
          
          <button @click="refresh" class="text-indigo-600 text-sm font-medium hover:underline">Verificar estado nuevamente</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SparklesIcon, ArrowRightIcon, BuildingOfficeIcon, CheckIcon, ClockIcon } from '@heroicons/vue/24/outline';

definePageMeta({ layout: 'none' });

const loading = ref(true);
const processing = ref(false);
const step = ref('welcome');
const onboardingData = ref<any>(null);
const selectedPlantel = ref<number | null>(null);
const accessReason = ref('');

const fetchStatus = async () => {
  loading.value = true;
  try {
    const data = await $fetch('/api/onboarding/status');
    onboardingData.value = data;
    
    // If no onboarding needed, go to dashboard/home immediately
    if (!data.requiresOnboarding) {
      return navigateTo('/');
    }
    
    // Determine step
    if (!data.hasValidRole) step.value = 'pending';
    else if (data.needsPlantel) step.value = 'select-plantel';
    else step.value = 'welcome';
    
  } catch (e) {
    navigateTo('/login');
  } finally {
    loading.value = false;
  }
};

const proceed = () => {
  if (onboardingData.value?.needsPlantel) step.value = 'select-plantel';
  else if (!onboardingData.value?.hasValidRole) step.value = 'pending';
  else navigateTo('/');
};

const assignPlantel = async () => {
  if (!selectedPlantel.value) return;
  processing.value = true;
  try {
    await $fetch('/api/onboarding/assign-plantel', { method: 'POST', body: { plantelId: selectedPlantel.value } });
    navigateTo('/'); // Done, go to dispatcher
  } catch (e) {
    alert('Error al asignar plantel');
    processing.value = false;
  }
};

const requestAccess = async () => {
  if (!accessReason.value) return;
  processing.value = true;
  try {
    await $fetch('/api/onboarding/request-access', { method: 'POST', body: { reason: accessReason.value } });
    await fetchStatus();
  } catch (e) {
    alert('Error al enviar solicitud');
  } finally {
    processing.value = false;
  }
};

const refresh = fetchStatus;
onMounted(fetchStatus);
</script>