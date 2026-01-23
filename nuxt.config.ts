export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  build: {
    transpile: ['@heroicons/vue']
  },

  runtimeConfig: {
    baseUrl: process.env.BASE_URL,

    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    uploadDir: process.env.UPLOAD_DIR || './public/uploads',

    // server-only
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

    public: {
      appName: 'CajaSmart IECS-IEDIS'
    }
  }
});
