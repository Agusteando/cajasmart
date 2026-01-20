export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  build: {
    transpile: ['@heroicons/vue']
  },

  runtimeConfig: {
    // DB (server only) – ok
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    uploadDir: process.env.UPLOAD_DIR || './public/uploads',

    public: {
      appName: 'CajaSmart IECS-IEDIS'
    }
  },

  app: {
    head: {
      title: 'CajaSmart - IEDIS',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
});
