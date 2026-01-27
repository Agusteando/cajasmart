function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePush() {
  const isSupported = computed(() => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);

  const permission = ref<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const subscribed = ref(false);

  async function getRegistration() {
    return await navigator.serviceWorker.ready;
  }

  async function refreshStatus() {
    if (!isSupported.value) return;
    permission.value = Notification.permission;

    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    subscribed.value = !!sub;
  }

  async function enablePush(deviceName?: string) {
    if (!isSupported.value) throw new Error('Push not supported');

    const perm = await Notification.requestPermission();
    permission.value = perm;
    if (perm !== 'granted') throw new Error('Permission not granted');

    const reg = await getRegistration();

    const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/public-key');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    await $fetch('/api/push/subscribe', {
      method: 'POST',
      body: {
        subscription: sub.toJSON(),
        deviceName: deviceName || null,
        userAgent: navigator.userAgent
      }
    });

    await refreshStatus();
  }

  async function disablePush() {
    if (!isSupported.value) return;

    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint } });
    } else {
      await $fetch('/api/push/unsubscribe', { method: 'POST', body: {} });
    }

    await refreshStatus();
  }

  return { isSupported, permission, subscribed, refreshStatus, enablePush, disablePush };
}
