export default defineNuxtPlugin(async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.error('SW register failed:', e);
  }
});
