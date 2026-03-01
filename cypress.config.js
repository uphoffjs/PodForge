import { defineConfig } from 'cypress'
import { configureVisualRegression } from 'cypress-visual-regression'

export default defineConfig({
  projectId: 'humtsq',
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/snapshots/actual',
    retries: 0,
    env: {
      visualRegressionType: 'regression',
      visualRegressionBaseDirectory: 'cypress/snapshots/base',
      visualRegressionDiffDirectory: 'cypress/snapshots/diff',
      visualRegressionGenerateDiff: 'fail',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
    },
    setupNodeEvents(on) {
      configureVisualRegression(on)
    },
  },
})
