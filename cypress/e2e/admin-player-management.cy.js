describe('Admin Player Management', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const players = [
    { id: 'player-1', event_id: eventId, name: 'Alice', status: 'active', created_at: '2026-01-01T00:01:00Z' },
    { id: 'player-2', event_id: eventId, name: 'Bob', status: 'active', created_at: '2026-01-01T00:02:00Z' },
    { id: 'player-3', event_id: eventId, name: 'Charlie', status: 'active', created_at: '2026-01-01T00:03:00Z' },
    { id: 'player-4', event_id: eventId, name: 'Dave', status: 'active', created_at: '2026-01-01T00:04:00Z' },
    { id: 'player-5', event_id: eventId, name: 'Eve', status: 'dropped', created_at: '2026-01-01T00:05:00Z' },
  ]

  function setupAdminPage(playerOverrides) {
    const currentPlayers = playerOverrides || players

    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock event GET (single-object format)
    cy.intercept('GET', '**/rest/v1/events*', {
      statusCode: 200,
      body: event,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getEvent')

    // Mock players GET
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: currentPlayers,
    }).as('getPlayers')

    // Mock rounds GET (empty — no rounds needed for player management tests)
    cy.intercept('GET', '**/rest/v1/rounds*', {
      statusCode: 200,
      body: [],
    }).as('getRounds')

    // Mock pods GET (empty)
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

  it('shows remove button for active players', () => {
    setupAdminPage()

    // Active player should have a trash icon remove button
    cy.getByTestId('admin-remove-player-player-1').should('be.visible')
    cy.getByTestId('admin-remove-player-player-2').should('be.visible')
    cy.getByTestId('admin-remove-player-player-3').should('be.visible')
    cy.getByTestId('admin-remove-player-player-4').should('be.visible')
  })

  it('shows reactivate button for dropped players', () => {
    setupAdminPage()

    // Expand dropped section
    cy.getByTestId('player-list-dropped-toggle').click()

    // Dropped player should have a reactivate button
    cy.getByTestId('admin-reactivate-player-player-5').should('be.visible')
  })

  it('removes active player with confirmation', () => {
    setupAdminPage()

    // Click remove button for Bob
    cy.getByTestId('admin-remove-player-player-2').click()

    // Confirm dialog should appear
    cy.getByTestId('confirm-dialog').should('be.visible')
    cy.getByTestId('confirm-dialog').should('contain', 'Remove Bob?')

    // Intercept the remove_player RPC
    cy.intercept('POST', '**/rest/v1/rpc/remove_player', {
      statusCode: 200,
      body: JSON.stringify(null),
      headers: { 'content-type': 'application/json' },
    }).as('removePlayer')

    // Override players GET to return updated list with Bob now dropped
    const updatedPlayers = players.map((p) =>
      p.id === 'player-2' ? { ...p, status: 'dropped' } : p
    )
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: updatedPlayers,
    }).as('getPlayersAfterRemove')

    // Click confirm
    cy.getByTestId('confirm-dialog-confirm-btn').click()

    // Wait for the RPC call
    cy.wait('@removePlayer')

    // Confirm dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Bob should no longer appear in active player list
    // The heading should reflect 3 active players now
    cy.getByTestId('player-list-heading').should('contain', '3 active')

    // Expand dropped section to verify Bob is now dropped
    cy.getByTestId('player-list-dropped-toggle').click()
    cy.getByTestId('player-item-player-2').should('be.visible')
  })

  it('cancels remove player', () => {
    setupAdminPage()

    // Click remove button for Charlie
    cy.getByTestId('admin-remove-player-player-3').click()

    // Confirm dialog should appear
    cy.getByTestId('confirm-dialog').should('be.visible')

    // Click cancel
    cy.getByTestId('confirm-dialog-cancel-btn').click()

    // Dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Player should still be in active list
    cy.getByTestId('player-item-player-3').should('be.visible')
    cy.getByTestId('player-list-heading').should('contain', '4 active')
  })

  it('reactivates dropped player with confirmation', () => {
    setupAdminPage()

    // Expand dropped section
    cy.getByTestId('player-list-dropped-toggle').click()

    // Click reactivate button for Eve
    cy.getByTestId('admin-reactivate-player-player-5').click()

    // Confirm dialog should appear
    cy.getByTestId('confirm-dialog').should('be.visible')
    cy.getByTestId('confirm-dialog').should('contain', 'Reactivate Eve?')

    // Intercept the reactivate_player RPC
    cy.intercept('POST', '**/rest/v1/rpc/reactivate_player', {
      statusCode: 200,
      body: JSON.stringify(null),
      headers: { 'content-type': 'application/json' },
    }).as('reactivatePlayer')

    // Override players GET to return updated list with Eve now active
    const updatedPlayers = players.map((p) =>
      p.id === 'player-5' ? { ...p, status: 'active' } : p
    )
    cy.intercept('GET', '**/rest/v1/players*', {
      statusCode: 200,
      body: updatedPlayers,
    }).as('getPlayersAfterReactivate')

    // Click confirm
    cy.getByTestId('confirm-dialog-confirm-btn').click()

    // Wait for the RPC call
    cy.wait('@reactivatePlayer')

    // Confirm dialog should close
    cy.getByTestId('confirm-dialog').should('not.exist')

    // Eve should now appear in active list
    cy.getByTestId('player-list-heading').should('contain', '5 active')
    cy.getByTestId('player-item-player-5').should('be.visible')
  })
})
