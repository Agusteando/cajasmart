export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  build: {
    transpile: ['@heroicons/vue']
  },

  runtimeConfig: {
    // Only pin origin in production (behind IIS/proxy).
    // In dev, let it auto-detect from the request, or set BASE_URL_DEV=http://localhost:3000
    baseUrl:
      process.env.NODE_ENV === 'production'
        ? (process.env.BASE_URL || '')
        : (process.env.BASE_URL_DEV || ''),

    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    uploadDir: process.env.UPLOAD_DIR || './public/uploads',

    // server-only
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

    // server-only (Web Push)
    vapidSubject: process.env.VAPID_SUBJECT || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',

    public: {
      appName: 'CajaSmart IECS-IEDIS',
      // client-safe (used for Push subscribe)
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ''
    }
  }
});
