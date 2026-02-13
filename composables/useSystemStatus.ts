// composables/useSystemStatus.ts
export function useSystemStatus() {
  const config = useRuntimeConfig();
  const currentBuildId = config.public.buildId;

  // Global state for maintenance overlay
  const isMaintenance = useState('sys_maintenance', () => false);
  const maintenanceMessage = useState('sys_maintenance_msg', () => 'Conectando con el servidor...');

  // State to track consecutive failures
  const consecutiveFailures = useState('sys_failures', () => 0);
  const FAILURE_THRESHOLD = 3; // Only trigger after 3 failed attempts

  let pollInterval: any = null;

  async function checkStatus() {
    // 1. Don't check if the browser knows it's offline
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return; 
    }

    try {
      const res = await $fetch<{ buildId: string }>('/api/system/status', {
        timeout: 5000, // INCREASED: Give it 5s instead of 3s to handle lag
        retry: 0 
      });

      // --- SUCCESS SCENARIO ---
      
      // Reset failures on success
      consecutiveFailures.value = 0;

      // If we were in maintenance mode, or if IDs mismatch, reload.
      if (res.buildId !== String(currentBuildId)) {
        console.log('Version mismatch detected. Reloading...');
        window.location.reload();
        return;
      }

      // If we were showing maintenance but server is back
      if (isMaintenance.value) {
        // Optional: reload to ensure state consistency, or just hide overlay
        window.location.reload(); 
      }

    } catch (e: any) {
      // --- FAILURE SCENARIO ---

      const status = e?.response?.status;
      
      // Check for specific server errors (deployment) or network errors (offline/timeout)
      if (!status || status === 502 || status === 503 || status === 504) {
        
        // Increment failure counter
        consecutiveFailures.value++;
        console.warn(`System heartbeat failed (${consecutiveFailures.value}/${FAILURE_THRESHOLD})`);

        // Only trigger maintenance if we hit the threshold
        if (consecutiveFailures.value >= FAILURE_THRESHOLD) {
          if (!isMaintenance.value) {
            console.log('System unreachable confirmed. Triggering maintenance mode.');
            isMaintenance.value = true;
            maintenanceMessage.value = 'Se está actualizando el sistema...';
          }
        }
      }
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    // Poll every 10s instead of 5s to reduce network noise
    pollInterval = setInterval(checkStatus, 10000); 
    
    // Check immediately on start
    checkStatus();
  }

  return {
    isMaintenance,
    startPolling
  };
}