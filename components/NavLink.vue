<template>
  <NuxtLink 
    :to="to" 
    active-class="bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" 
    class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200 group"
  >
    <component :is="iconComponent" class="w-5 h-5" />
    <span class="text-sm font-medium"><slot /></span>
  </NuxtLink>
</template>

<script setup>
import * as HeroIcons from '@heroicons/vue/24/outline';

const props = defineProps({
  to: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  }
});

// Dynamically resolve the icon component from the imported set
const iconComponent = HeroIcons[props.icon] || HeroIcons['QuestionMarkCircleIcon'];
</script>