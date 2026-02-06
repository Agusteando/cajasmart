<template>
  <div class="min-h-screen bg-slate-50 font-sans">
    <MaintenanceOverlay :visible="isMaintenance" />
    <slot />
  </div>
</template>

<script setup lang="ts">
const { isMaintenance, startPolling } = useSystemStatus();

onMounted(() => {
  startPolling();
});
</script>