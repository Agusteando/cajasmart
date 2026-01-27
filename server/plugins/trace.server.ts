import { log } from '~/server/utils/log';

export default defineNitroPlugin((nitroApp) => {
  const hooks = nitroApp?.hooks;

  if (!hooks || typeof hooks.hook !== 'function') {
    return;
  }

  // Hook signature is (error, context) where context = { event }
  hooks.hook('error', (error: any, ctx: any) => {
    // Extract the actual H3Event
    const event = ctx?.event;
    
    // If no event (e.g. server startup error), skip logging request details
    if (!event) return;

    log(event, 'ERROR', 'nitro:error', {
      message: error?.message || String(error),
      stack: error?.stack
    });
  });
});