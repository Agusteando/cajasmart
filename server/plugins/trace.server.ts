import { log } from '~/server/utils/log';

export default defineNitroPlugin((nitroApp) => {
  const hooks = nitroApp?.hooks;

  if (!hooks || typeof hooks.hook !== 'function') {
    console.warn('[trace] nitroApp.hooks not available; error logging disabled');
    return;
  }

  hooks.hook('error', (error: any, event: any) => {
    if (!event) return;

    log(event, 'ERROR', 'nitro:error', {
      message: error?.message,
      stack: error?.stack
    });
  });
});
