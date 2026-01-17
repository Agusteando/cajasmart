export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  
  // This enables the use of HeroIcons in the sidebar
  build: {
    transpile: ['@heroicons/vue']
  },

  runtimeConfig: {
    // Private keys (Server-side only)
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    baseUrl: process.env.BASE_URL,
    
    uploadDir: process.env.UPLOAD_DIR || './public/uploads',

    // Public keys (Client-side)
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
})