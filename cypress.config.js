import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    video: true,
    screenshotOnRunFailure: true,
    retries: 0,
    env: {
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
    },
  },
})
