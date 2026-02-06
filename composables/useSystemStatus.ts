// composables/useSystemStatus.ts
export function useSystemStatus() {
  const config = useRuntimeConfig();
  const currentBuildId = config.public.buildId;

  // Global state for maintenance overlay
  const isMaintenance = useState('sys_maintenance', () => false);
  const maintenanceMessage = useState('sys_maintenance_msg', () => 'Conectando con el servidor...');

  let pollInterval: any = null;

  async function checkStatus() {
    try {
      const res = await $fetch<{ buildId: string }>('/api/system/status', {
        timeout: 3000, // Fast timeout
        retry: 0 // Don't auto retry, we want to catch the error
      });

      // Server is UP.
      
      // If we were in maintenance mode, or if IDs mismatch, reload.
      if (res.buildId !== String(currentBuildId)) {
        console.log('Version mismatch detected. Reloading...');
        // Force reload to get new assets
        window.location.reload();
        return;
      }

      // If we were showing maintenance but server is back and version matches (rare but possible)
      if (isMaintenance.value) {
        window.location.reload(); // Safer to reload to ensure state consistency
      }

    } catch (e: any) {
      // If network error, 502, 503, or 504 => System is likely restarting/deploying
      const status = e?.response?.status;
      if (!status || status === 502 || status === 503 || status === 504) {
        if (!isMaintenance.value) {
          console.log('System unreachable. Triggering maintenance mode.');
          isMaintenance.value = true;
          maintenanceMessage.value = 'Se está actualizando el sistema...';
        }
      }
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    // Poll frequently (every 5s) to catch deployments quickly
    pollInterval = setInterval(checkStatus, 5000);
  }

  return {
    isMaintenance,
    startPolling
  };
}