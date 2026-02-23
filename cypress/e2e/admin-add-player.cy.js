describe('Admin Add Player', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const existingPlayers = [
    {
      id: 'player-1',
      event_id: eventId,
      name: 'Alice',
      status: 'active',
      created_at: '2026-01-01T00:01:00Z',
    },
    {
      id: 'player-2',
      event_id: eventId,
      name: 'Bob',
      status: 'active',
      created_at: '2026-01-01T00:02:00Z',
    },
  ]

  /**
   * Set up intercepts and visit the event page as an admin.
   * Cannot use cy.mockEventPage() because we need onBeforeLoad to set
   * sessionStorage before React mounts (useAdminAuth reads it at init).
   */
  function setupAdminPage(players = existingPlayers) {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock event API (PostgREST single-object format)
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: event,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    // Mock players API
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: players,
    }).as('getPlayers')

    // Visit with onBeforeLoad to set storage before React mounts
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem(adminStorageKey, 'testpass')
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('shows add player form for admin users', () => {
    setupAdminPage()

    // Admin should see the add player form
    cy.getByTestId('add-player-form').should('be.visible')
    cy.getByTestId('add-player-name-input').should('be.visible')
    cy.getByTestId('add-player-submit-btn').should('be.visible')

    // Join form should NOT be shown (player identity is set)
    cy.getByTestId('join-form').should('not.exist')
  })

  it('admin can add a player successfully', () => {
    const newPlayer = {
      id: 'player-new',
      event_id: eventId,
      name: 'Dave',
      status: 'active',
      created_at: '2026-01-01T00:05:00Z',
    }

    setupAdminPage()

    // Intercept the POST to add a player
    cy.intercept('POST', '**/rest/v1/players*', {
      statusCode: 201,
      body: newPlayer,
    }).as('addPlayer')

    // Intercept the refetch to return the updated player list
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: [...existingPlayers, newPlayer],
    }).as('getPlayersAfterAdd')

    // Type a name and submit
    cy.getByTestId('add-player-name-input').type('Dave')
    cy.getByTestId('add-player-submit-btn').click()

    cy.wait('@addPlayer')

    // Verify the new player appears in the list
    cy.getByTestId('player-list').should('contain', 'Dave')

    // Verify the input is cleared after success
    cy.getByTestId('add-player-name-input').should('have.value', '')
  })

  it('shows validation error for short name', () => {
    setupAdminPage()

    // Type a single character (below 2-char minimum)
    cy.getByTestId('add-player-name-input').type('A')
    cy.getByTestId('add-player-submit-btn').click()

    // Validation error should appear
    cy.getByTestId('add-player-error').should('be.visible')
    cy.getByTestId('add-player-error').should(
      'contain',
      'Name must be at least 2 characters.'
    )
  })

  it('shows error for duplicate player name', () => {
    setupAdminPage()

    // Intercept POST to return a 409 duplicate error
    cy.intercept('POST', '**/rest/v1/players*', {
      statusCode: 409,
      body: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    }).as('addDuplicate')

    // Type an existing name and submit
    cy.getByTestId('add-player-name-input').type('Alice')
    cy.getByTestId('add-player-submit-btn').click()

    cy.wait('@addDuplicate')

    // Duplicate error should appear
    cy.getByTestId('add-player-error').should('be.visible')
    cy.getByTestId('add-player-error').should('contain', 'already taken')
  })
})
