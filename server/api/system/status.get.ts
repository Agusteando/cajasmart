// server/api/system/status.get.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  return {
    status: 'online',
    buildId: config.public.buildId,
    timestamp: Date.now()
  };
});