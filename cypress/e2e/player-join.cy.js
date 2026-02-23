describe('Player Join', () => {
  const eventId = 'test-uuid'

  it('shows join form on event page for new visitor', () => {
    cy.mockEventPage()
    cy.getByTestId('join-form').should('be.visible')
    cy.getByTestId('join-name-input').should('be.visible')
  })

  it('joins an event by entering name and submitting', () => {
    const newPlayer = {
      id: 'player-new',
      event_id: eventId,
      name: 'Dave',
      status: 'active',
      created_at: '2026-01-01T00:05:00Z',
    }

    cy.mockEventPage()

    // Verify the join form is visible (player not identified yet)
    cy.getByTestId('join-form').should('be.visible')

    // Mock the join POST endpoint
    cy.intercept('POST', '**/rest/v1/players*', {
      statusCode: 201,
      body: newPlayer,
    }).as('joinPlayer')

    // Ensure refetch also returns the player
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: [newPlayer],
    }).as('getPlayersAfterJoin')

    // Type name and submit
    cy.getByTestId('join-name-input').type('Dave')
    cy.getByTestId('join-submit-btn').click()

    cy.wait('@joinPlayer')

    // After join succeeds, the onJoined callback sets currentPlayerId
    // The justJoinedRef guard prevents the validation effect from clearing identity
    cy.getByTestId('join-form').should('not.exist')
    cy.getByTestId('player-list').should('be.visible')
    cy.getByTestId('player-list').should('contain', 'Dave')
  })

  it('shows player list with existing players', () => {
    cy.fixture('players.json').then((players) => {
      cy.mockEventPage(undefined, players)
      cy.getByTestId('player-list').should('be.visible')
      cy.getByTestId('player-list').should('contain', 'Alice')
      cy.getByTestId('player-list').should('contain', 'Bob')
    })
  })

  it('shows skip link for admin access', () => {
    cy.mockEventPage()
    cy.getByTestId('join-skip-btn').should('be.visible')
  })

  it('shows empty state when no players exist', () => {
    cy.mockEventPage(undefined, [])
    cy.getByTestId('player-list-empty').should('be.visible')
    cy.getByTestId('player-list-empty').should('contain', 'No players yet')
  })

  it('trims whitespace from player name', () => {
    const newPlayer = {
      id: 'player-trimmed',
      event_id: eventId,
      name: 'Alice',
      status: 'active',
      created_at: '2026-01-01T00:05:00Z',
    }

    cy.mockEventPage()

    cy.intercept('POST', '**/rest/v1/players*', {
      statusCode: 201,
      body: newPlayer,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('joinPlayer')

    // After joining, the app refetches
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: [newPlayer],
    })

    // Type name with surrounding whitespace
    cy.getByTestId('join-name-input').type('  Alice  ')
    cy.getByTestId('join-submit-btn').click()

    // Verify the trimmed name was sent in the request body
    cy.wait('@joinPlayer').its('request.body').should('deep.include', {
      name: 'Alice',
    })
  })

  it('clicking skip button hides join form and shows player list', () => {
    cy.fixture('players.json').then((players) => {
      cy.mockEventPage(undefined, players)

      // Join form should be visible initially
      cy.getByTestId('join-form').should('be.visible')

      // Click the skip button
      cy.getByTestId('join-skip-btn').click()

      // Join form should disappear (skippedJoin state set to true)
      cy.getByTestId('join-form').should('not.exist')

      // Player list should be visible with content
      cy.getByTestId('player-list').should('be.visible')
      cy.getByTestId('player-list').should('contain', 'Alice')
      cy.getByTestId('player-list').should('contain', 'Bob')
    })
  })
})
