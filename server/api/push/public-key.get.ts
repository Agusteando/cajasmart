export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  if (!config.vapidPublicKey) {
    throw createError({ statusCode: 500, statusMessage: 'VAPID_PUBLIC_KEY not configured' });
  }
  return { publicKey: config.vapidPublicKey };
});
