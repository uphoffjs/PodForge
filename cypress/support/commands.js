// Custom Cypress commands for PodForge E2E tests

/**
 * Get an element by its data-testid attribute.
 * @example cy.getByTestId('landing-create-event-btn')
 */
Cypress.Commands.add('getByTestId', (testId) => {
  return cy.get(`[data-testid="${testId}"]`)
})

/**
 * Set up intercepts and visit an event page with mocked data.
 * Blocks Realtime WebSocket, intercepts event and player fetches.
 *
 * @param {Object} [eventData] - Event object to return from the API
 * @param {Array}  [playersData] - Array of player objects to return from the API
 */
Cypress.Commands.add('mockEventPage', (eventData, playersData) => {
  const defaultEvent = {
    id: 'test-uuid',
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const event = eventData || defaultEvent
  const players = playersData || []

  // Intercept Supabase REST API calls for the event
  cy.intercept('GET', '**/rest/v1/events*', {
    statusCode: 200,
    body: [event],
  }).as('getEvent')

  // Intercept Supabase REST API calls for players
  cy.intercept('GET', '**/rest/v1/players*', {
    statusCode: 200,
    body: players,
  }).as('getPlayers')

  // Block Realtime WebSocket connections to prevent errors in mocked tests
  cy.intercept('GET', '**/realtime/v1/websocket*', {
    statusCode: 200,
    body: {},
  }).as('blockRealtime')

  // Visit the event page
  cy.visit(`/event/${event.id}`)

  // Wait for data to load
  cy.wait('@getEvent')
  cy.wait('@getPlayers')
})

/**
 * Create a real event via Supabase RPC (for integration tests).
 *
 * @param {string} name - Event name
 * @param {string} passphrase - Admin passphrase
 */
Cypress.Commands.add('createRealEvent', (name, passphrase) => {
  const supabaseUrl = Cypress.env('SUPABASE_URL')
  const supabaseKey = Cypress.env('SUPABASE_ANON_KEY')

  return cy.request({
    method: 'POST',
    url: `${supabaseUrl}/rest/v1/rpc/create_event`,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: { event_name: name, admin_passphrase: passphrase },
  })
})

/**
 * Set up intercepts and visit the landing page.
 * Intercepts any background requests the landing page might make.
 */
Cypress.Commands.add('mockLandingPage', () => {
  // Intercept any potential background API calls
  cy.intercept('GET', '**/rest/v1/**', {
    statusCode: 200,
    body: [],
  }).as('backgroundRequests')

  cy.visit('/')
})
