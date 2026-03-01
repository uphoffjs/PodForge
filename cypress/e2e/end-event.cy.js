describe('End Event', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const activeEvent = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const endedEvent = {
    ...activeEvent,
    status: 'ended',
  }

  const players = [
    { id: 'player-1', event_id: eventId, name: 'Alice', status: 'active', created_at: '2026-01-01T00:01:00Z' },
    { id: 'player-2', event_id: eventId, name: 'Bob', status: 'active', created_at: '2026-01-01T00:02:00Z' },
    { id: 'player-3', event_id: eventId, name: 'Charlie', status: 'active', created_at: '2026-01-01T00:03:00Z' },
    { id: 'player-4', event_id: eventId, name: 'Dave', status: 'active', created_at: '2026-01-01T00:04:00Z' },
  ]

  const round = {
    id: 'round-1',
    event_id: eventId,
    round_number: 1,
    created_at: '2026-01-01T01:00:00Z',
  }

  const pods = [
    {
      id: 'pod-1',
      round_id: 'round-1',
      pod_number: 1,
      is_bye: false,
      pod_players: [
        { id: 'pp-1', pod_id: 'pod-1', player_id: 'player-1', seat_number: 1, players: { id: 'player-1', name: 'Alice', event_id: eventId, status: 'active', created_at: '2026-01-01T00:01:00Z' } },
        { id: 'pp-2', pod_id: 'pod-1', player_id: 'player-2', seat_number: 2, players: { id: 'player-2', name: 'Bob', event_id: eventId, status: 'active', created_at: '2026-01-01T00:02:00Z' } },
        { id: 'pp-3', pod_id: 'pod-1', player_id: 'player-3', seat_number: 3, players: { id: 'player-3', name: 'Charlie', event_id: eventId, status: 'active', created_at: '2026-01-01T00:03:00Z' } },
        { id: 'pp-4', pod_id: 'pod-1', player_id: 'player-4', seat_number: 4, players: { id: 'player-4', name: 'Dave', event_id: eventId, status: 'active', created_at: '2026-01-01T00:04:00Z' } },
      ],
    },
  ]

  /**
   * Set up the event page as an admin with optional event/player overrides.
   */
  function setupAdminPage(eventOverride, playersOverride) {
    const eventData = eventOverride || activeEvent
    const playersData = playersOverride || players

    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock event GET (single-object format)
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: eventData,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    // Mock players GET
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: playersData,
    }).as('getPlayers')

    // Mock rounds GET (empty by default)
    cy.intercept('GET', '**/rest/v1/rounds*', {
      statusCode: 200,
      body: [],
    }).as('getRounds')

    // Mock pods GET (empty by default)
    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: [],
    }).as('getPods')

    // Visit with onBeforeLoad to set admin + player identity before React mounts
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem(adminStorageKey, 'testpass')
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('shows End Event button for admin of active event', () => {
    setupAdminPage()

    cy.getByTestId('end-event-btn').should('be.visible')
    cy.getByTestId('end-event-btn').should('not.be.disabled')
  })

  it('opens confirmation dialog on End Event click', () => {
    setupAdminPage()

    cy.getByTestId('end-event-btn').click()

    cy.getByTestId('confirm-dialog').should('be.visible')
    cy.getByTestId('confirm-dialog').should('contain', 'End this event?')
  })

  it('ends event successfully', () => {
    setupAdminPage()

    // Click End Event button
    cy.getByTestId('end-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')

    // Intercept the end_event RPC
    cy.intercept('POST', '**/rest/v1/rpc/end_event', {
      statusCode: 200,
      body: JSON.stringify(null),
      headers: { 'content-type': 'application/json' },
    }).as('endEvent')

    // Override event GET to return ended event
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: endedEvent,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEventAfterEnd')

    // Click confirm
    cy.getByTestId('confirm-dialog-confirm-btn').click()

    // Wait for the RPC call
    cy.wait('@endEvent')

    // Assert event ended banner is visible
    cy.getByTestId('event-ended-banner').should('be.visible')
    cy.getByTestId('event-ended-banner').should('contain', 'This event has ended')

    // Assert event status shows "ended"
    cy.getByTestId('event-info-status').should('contain', 'ended')
  })

  it('cancels end event', () => {
    setupAdminPage()

    // Click End Event button to open dialog
    cy.getByTestId('end-event-btn').click()
    cy.getByTestId('confirm-dialog').should('be.visible')

    // Click cancel
    cy.getByTestId('confirm-dialog-cancel-btn').click()

    // Dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // End Event button should still be visible
    cy.getByTestId('end-event-btn').should('be.visible')
  })

  it('ended event hides admin controls and interactive elements', () => {
    // Setup page with event already ended
    setupAdminPage(endedEvent)

    // Event ended banner should be visible
    cy.getByTestId('event-ended-banner').should('be.visible')

    // Admin controls should NOT exist (isAdmin && !isEventEnded is false)
    cy.getByTestId('admin-controls').should('not.exist')

    // Add player form should NOT exist
    cy.getByTestId('add-player-form').should('not.exist')

    // Leave event button should NOT exist (isActivePlayer && !isEventEnded is false)
    cy.getByTestId('leave-event-btn').should('not.exist')

    // Join form should NOT be shown (event ended hides it)
    cy.getByTestId('join-form').should('not.exist')
  })

  it('ended event still shows player list and pods', () => {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock ended event
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: endedEvent,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    // Mock players
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: players,
    }).as('getPlayers')

    // Mock rounds - return one round. useCurrentRound uses limit=1&order=desc
    // and useRounds also queries. We need the intercept to handle both.
    cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
      // useCurrentRound adds limit=1; useRounds does not
      // Both get the same round data
      if (req.url.includes('limit=1')) {
        req.reply({
          statusCode: 200,
          body: round,
          headers: {
            'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
          },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: [round],
        })
      }
    }).as('getRounds')

    // Mock pods for the round
    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: pods,
    }).as('getPods')

    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem(adminStorageKey, 'testpass')
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')

    // Player list should be visible
    cy.getByTestId('player-list').should('be.visible')

    // Round display should be visible with pod cards
    cy.getByTestId('round-display').should('be.visible')
    cy.getByTestId('pod-card-1').should('be.visible')
  })
})
