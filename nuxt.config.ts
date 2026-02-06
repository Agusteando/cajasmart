export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  build: {
    transpile: ['@heroicons/vue']
  },

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  runtimeConfig: {
    baseUrl: process.env.NODE_ENV === 'production'
        ? (process.env.BASE_URL || '')
        : (process.env.BASE_URL_DEV || ''),
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    uploadDir: process.env.UPLOAD_DIR || './public/uploads',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    vapidSubject: process.env.VAPID_SUBJECT || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    public: {
      appName: 'CajaSmart IECS-IEDIS',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      // Define a build ID at build time. Used for version mismatch detection.
      buildId: process.env.BUILD_ID || Date.now().toString()
    }
  }
});