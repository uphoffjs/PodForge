import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command'
import './commands.js'

addCompareSnapshotCommand()

// Clear state between tests to prevent leakage (pitfall #2 from research)
beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.clear()
    win.sessionStorage.clear()
  })
})

// Suppress Supabase Realtime WebSocket errors in mocked tests (pitfall #1)
Cypress.on('uncaught:exception', (err) => {
  // Suppress WebSocket and Realtime channel errors that occur in mocked environments
  if (
    err.message.includes('WebSocket') ||
    err.message.includes('realtime') ||
    err.message.includes('Realtime') ||
    err.message.includes('phoenix')
  ) {
    return false
  }
  // Let other errors fail the test
  return true
})
