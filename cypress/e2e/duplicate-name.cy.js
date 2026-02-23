describe('Duplicate Name Rejection', () => {
  const eventId = 'test-uuid'

  it('shows error when joining with a name that already exists', () => {
    cy.fixture('players.json').then((players) => {
      // Mock event page with existing players (Alice, Bob, Charlie)
      cy.mockEventPage(undefined, players)

      // Mock the join POST to return 409 with duplicate error
      cy.fixture('error-duplicate.json').then((errorBody) => {
        cy.intercept('POST', '**/rest/v1/players*', {
          statusCode: 409,
          body: errorBody,
        }).as('joinDuplicate')
      })

      // Try to join with an existing name
      cy.getByTestId('join-name-input').type('Alice')
      cy.getByTestId('join-submit-btn').click()

      cy.wait('@joinDuplicate')

      // Error message should appear
      cy.getByTestId('join-mutation-error').should('be.visible')
      cy.getByTestId('join-mutation-error').should('contain', 'already taken')
    })
  })

  it('allows joining after changing to a unique name', () => {
    const newPlayer = {
      id: 'player-new',
      event_id: eventId,
      name: 'NewPlayer',
      status: 'active',
      created_at: '2026-01-01T00:05:00Z',
    }

    cy.fixture('players.json').then((players) => {
      cy.mockEventPage(undefined, [...players, newPlayer])

      // First attempt: duplicate name returns 409
      cy.fixture('error-duplicate.json').then((errorBody) => {
        cy.intercept('POST', '**/rest/v1/players*', {
          statusCode: 409,
          body: errorBody,
        }).as('joinDuplicate')
      })

      cy.getByTestId('join-name-input').type('Alice')
      cy.getByTestId('join-submit-btn').click()
      cy.wait('@joinDuplicate')

      // Error should appear
      cy.getByTestId('join-mutation-error').should('be.visible')

      // Now override the POST intercept to return success for the new name
      cy.intercept('POST', '**/rest/v1/players*', {
        statusCode: 201,
        body: newPlayer,
      }).as('joinSuccess')

      // Ensure refetch returns updated player list
      cy.intercept('GET', '**/rest/v1/players*', {
        statusCode: 200,
        body: [...players, newPlayer],
      })

      // Clear the input and type a unique name
      cy.getByTestId('join-name-input').clear().type('NewPlayer')
      cy.getByTestId('join-submit-btn').click()

      cy.wait('@joinSuccess')

      // Join form should disappear, player should be in list
      cy.getByTestId('join-form').should('not.exist')
      cy.getByTestId('player-list').should('contain', 'NewPlayer')
    })
  })

  it('handles case-sensitive name matching', () => {
    const newPlayer = {
      id: 'player-alice-lower',
      event_id: eventId,
      name: 'alice',
      status: 'active',
      created_at: '2026-01-01T00:05:00Z',
    }

    cy.fixture('players.json').then((players) => {
      // Include the new player in mock data so validation effect works
      cy.mockEventPage(undefined, [...players, newPlayer])

      // Mock the POST to succeed (different case = different name at DB level)
      cy.intercept('POST', '**/rest/v1/players*', {
        statusCode: 201,
        body: newPlayer,
      }).as('joinCaseDiff')

      // Ensure refetch works
      cy.intercept('GET', '**/rest/v1/players*', {
        statusCode: 200,
        body: [...players, newPlayer],
      })

      // "alice" (lowercase) while "Alice" (capitalized) already exists
      cy.getByTestId('join-name-input').type('alice')
      cy.getByTestId('join-submit-btn').click()

      cy.wait('@joinCaseDiff')

      // Should succeed (no error)
      cy.getByTestId('join-form').should('not.exist')
    })
  })
})
