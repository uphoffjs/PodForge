describe('Self-Drop', () => {
  const eventId = 'test-uuid'
  const playerId = 'player-1'
  const playerName = 'Alice'
  const storageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const players = [
    {
      id: playerId,
      event_id: eventId,
      name: playerName,
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
   * Helper: Set up the event page with a joined player identity.
   * Sets localStorage BEFORE visiting so the EventPage recognizes the player.
   */
  function setupJoinedPlayer() {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', { statusCode: 200, body: {} })

    // Mock API responses
    // useEvent uses .single() which sends Accept: application/vnd.pgrst.object+json
    // PostgREST returns a plain object (not array) with that content-type
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: event,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: players,
    }).as('getPlayers')

    // Set localStorage with player identity BEFORE visiting the page
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(storageKey, playerId)
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('shows leave event button when player is joined', () => {
    setupJoinedPlayer()
    cy.getByTestId('leave-event-btn').should('be.visible')
  })

  it('shows confirmation dialog when leave button is clicked', () => {
    setupJoinedPlayer()
    cy.getByTestId('leave-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')
    cy.getByTestId('confirm-dialog-confirm-btn').should('be.visible')
    cy.getByTestId('confirm-dialog-cancel-btn').should('be.visible')
  })

  it('drops player when confirmed', () => {
    setupJoinedPlayer()

    // Mock the drop_player RPC
    cy.intercept('POST', '**/rest/v1/rpc/drop_player', {
      statusCode: 200,
      body: null,
    }).as('dropPlayer')

    // After drop, the refetched players list should show Alice as dropped
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: [
        { ...players[0], status: 'dropped' },
        players[1],
      ],
    }).as('getPlayersAfterDrop')

    // Click leave button, then confirm
    cy.getByTestId('leave-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')
    cy.getByTestId('confirm-dialog-confirm-btn').click()

    cy.wait('@dropPlayer')

    // Confirm dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Player identity should be cleared from localStorage
    cy.window().its('localStorage').invoke('getItem', storageKey)
      .should('be.null')

    // Join form should reappear since player is no longer identified
    cy.getByTestId('join-form').should('be.visible')
  })

  it('cancels drop when cancel is clicked', () => {
    setupJoinedPlayer()

    // Click leave button to open dialog
    cy.getByTestId('leave-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')

    // Click cancel
    cy.getByTestId('confirm-dialog-cancel-btn').click()

    // Dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Leave button should still be visible (player is still joined)
    cy.getByTestId('leave-event-btn').should('be.visible')

    // Join form should NOT be shown
    cy.getByTestId('join-form').should('not.exist')
  })

  it('cancels drop when clicking outside dialog', () => {
    setupJoinedPlayer()

    // Click leave button to open dialog
    cy.getByTestId('leave-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')

    // Click on the overlay (outside the dialog card) to dismiss
    cy.getByTestId('confirm-dialog').click('topLeft')

    // Dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Player should still be joined
    cy.getByTestId('leave-event-btn').should('be.visible')
    cy.getByTestId('join-form').should('not.exist')
  })
})
