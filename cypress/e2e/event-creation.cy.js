describe('Event Creation', () => {
  beforeEach(() => {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/**', { statusCode: 200, body: {} })
  })

  it('opens create event modal when button is clicked', () => {
    cy.mockLandingPage()
    cy.getByTestId('landing-create-event-btn').click()
    cy.getByTestId('create-event-modal').should('be.visible')
  })

  it('creates an event and redirects to event page', () => {
    const eventId = 'new-event-uuid'
    const event = {
      id: eventId,
      name: 'Friday Night Commander',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
    }

    // Set up ALL intercepts before visiting to avoid ordering issues
    // Block Realtime WebSocket (also in beforeEach but repeated for clarity)
    cy.intercept('GET', '**/realtime/**', { statusCode: 200, body: {} })

    // Mock the create_event RPC to return a new event UUID
    // PostgREST returns scalar values as JSON-encoded strings (quoted)
    cy.intercept('POST', '**/rest/v1/rpc/create_event', {
      statusCode: 200,
      body: JSON.stringify(eventId),
      headers: { 'content-type': 'application/json' },
    }).as('createEvent')

    // Mock the event page GET requests (will be used after redirect)
    // useEvent uses .single() which sends Accept: application/vnd.pgrst.object+json
    // Return the object with that content-type to match PostgREST behavior
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: event,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: [],
    }).as('getPlayers')

    // Visit landing page
    cy.visit('/')

    // Open modal and fill the form
    cy.getByTestId('landing-create-event-btn').click()
    cy.getByTestId('create-event-name-input').type('Friday Night Commander')
    cy.getByTestId('create-event-passphrase-input').type('secretpass')
    cy.getByTestId('create-event-submit-btn').click()

    // Wait for the API call and verify redirect
    cy.wait('@createEvent')
    cy.url().should('include', `/event/${eventId}`)
    cy.getByTestId('event-info-name').should('contain', 'Friday Night Commander')
  })

  it('closes modal when close button is clicked', () => {
    cy.mockLandingPage()
    cy.getByTestId('landing-create-event-btn').click()
    cy.getByTestId('create-event-modal').should('be.visible')
    cy.getByTestId('create-event-close-btn').click()
    cy.getByTestId('create-event-modal').should('not.exist')
  })

  it('closes modal when clicking outside', () => {
    cy.mockLandingPage()
    cy.getByTestId('landing-create-event-btn').click()
    cy.getByTestId('create-event-modal').should('be.visible')
    // Click on the overlay (the outermost element of the modal which handles overlay click)
    cy.getByTestId('create-event-modal').click('topLeft')
    cy.getByTestId('create-event-modal').should('not.exist')
  })

  it('prevents submit with empty event name (HTML5 validation)', () => {
    cy.mockLandingPage()
    cy.getByTestId('landing-create-event-btn').click()
    // Leave name empty, fill passphrase
    cy.getByTestId('create-event-passphrase-input').type('secretpass')
    cy.getByTestId('create-event-submit-btn').click()
    // Modal should still be visible since HTML5 required prevents submit
    cy.getByTestId('create-event-modal').should('be.visible')
    // Name input should have the required validation state
    cy.getByTestId('create-event-name-input').then(($input) => {
      expect($input[0].validity.valid).to.be.false
    })
  })

  it('prevents submit with empty passphrase (HTML5 validation)', () => {
    cy.mockLandingPage()
    cy.getByTestId('landing-create-event-btn').click()
    // Fill name but leave passphrase empty
    cy.getByTestId('create-event-name-input').type('My Event')
    cy.getByTestId('create-event-submit-btn').click()
    // Modal should still be visible since HTML5 required prevents submit
    cy.getByTestId('create-event-modal').should('be.visible')
    cy.getByTestId('create-event-passphrase-input').then(($input) => {
      expect($input[0].validity.valid).to.be.false
    })
  })

  it('handles server error on event creation', () => {
    cy.mockLandingPage()

    // Mock create_event RPC to return 500 server error
    cy.intercept('POST', '**/rest/v1/rpc/create_event', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('createEventError')

    // Open modal and submit
    cy.getByTestId('landing-create-event-btn').click()
    cy.getByTestId('create-event-name-input').type('My Event')
    cy.getByTestId('create-event-passphrase-input').type('secretpass')
    cy.getByTestId('create-event-submit-btn').click()

    cy.wait('@createEventError')

    // The app uses toast.error on mutation error -- verify the modal stays open
    // (it doesn't auto-close on error) and the page stays on landing
    cy.getByTestId('create-event-modal').should('be.visible')
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
  })
})
