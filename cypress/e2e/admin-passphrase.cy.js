describe('Admin Passphrase Authentication', () => {
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
    { id: 'player-5', event_id: eventId, name: 'Eve', status: 'active', created_at: '2026-01-01T00:05:00Z' },
    { id: 'player-6', event_id: eventId, name: 'Frank', status: 'active', created_at: '2026-01-01T00:06:00Z' },
    { id: 'player-7', event_id: eventId, name: 'Grace', status: 'active', created_at: '2026-01-01T00:07:00Z' },
    { id: 'player-8', event_id: eventId, name: 'Heidi', status: 'active', created_at: '2026-01-01T00:08:00Z' },
    { id: 'player-9', event_id: eventId, name: 'Ivan', status: 'active', created_at: '2026-01-01T00:09:00Z' },
  ]

  /**
   * Set up intercepts and visit the event page.
   * @param {Object} options
   * @param {boolean} options.asAdmin - Whether to set up admin sessionStorage
   */
  function setupEventPage({ asAdmin }) {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock event GET (PostgREST single-object format)
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
      body: players,
    }).as('getPlayers')

    // Mock rounds GET (empty - no rounds yet)
    // Handles both useRounds (array) and useCurrentRound (maybeSingle -> null on empty)
    cy.intercept('GET', '**/rest/v1/rounds*', {
      statusCode: 200,
      body: [],
    }).as('getRounds')

    // Mock pods GET (empty - no pods yet)
    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: [],
    }).as('getPods')

    // Visit with onBeforeLoad to set storage before React mounts
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        // Always set player identity so join form is skipped
        win.localStorage.setItem(playerStorageKey, 'player-1')
        if (asAdmin) {
          win.sessionStorage.setItem(adminStorageKey, 'testpass')
        }
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('admin with passphrase sees AdminControls', () => {
    setupEventPage({ asAdmin: true })

    cy.getByTestId('admin-controls').should('be.visible')
    cy.getByTestId('generate-round-btn').should('be.visible')
    cy.getByTestId('end-event-btn').should('be.visible')
  })

  it('non-admin does not see AdminControls', () => {
    setupEventPage({ asAdmin: false })

    cy.getByTestId('admin-controls').should('not.exist')
    cy.getByTestId('generate-round-btn').should('not.exist')
    cy.getByTestId('end-event-btn').should('not.exist')
  })

  it('admin passphrase persists in sessionStorage', () => {
    setupEventPage({ asAdmin: true })

    // Verify admin controls are visible (proves passphrase was read)
    cy.getByTestId('admin-controls').should('be.visible')

    // Verify sessionStorage contains the passphrase value
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(adminStorageKey)).to.equal('testpass')
    })
  })

  it('admin sees player action buttons in player list', () => {
    setupEventPage({ asAdmin: true })

    // Admin should see remove button for active players
    cy.getByTestId('admin-remove-player-player-1').should('be.visible')
  })

  describe('Admin Passphrase Modal Flow', () => {
    /**
     * Set up event page with empty passphrase in sessionStorage.
     * isAdmin = true (passphrase !== null), but passphrase is falsy ("")
     * so gated actions will trigger onPassphraseNeeded -> open modal.
     */
    function setupWithEmptyPassphrase() {
      // Block Realtime WebSocket
      cy.intercept('GET', '**/realtime/v1/websocket*', {
        statusCode: 200,
        body: {},
      })

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

      cy.intercept('GET', '**/rest/v1/rounds*', {
        statusCode: 200,
        body: [],
      }).as('getRounds')

      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: [],
      }).as('getPods')

      cy.visit(`/event/${eventId}`, {
        onBeforeLoad(win) {
          win.localStorage.setItem(playerStorageKey, 'player-1')
          // Set empty string: isAdmin = true ("" !== null), but !passphrase = true
          win.sessionStorage.setItem(adminStorageKey, '')
        },
      })

      cy.wait('@getEvent')
      cy.wait('@getPlayers')
    }

    it('opens passphrase modal when gated action clicked without passphrase', () => {
      setupWithEmptyPassphrase()

      // Admin controls should be visible (isAdmin = true)
      cy.getByTestId('admin-controls').should('be.visible')

      // Click generate round which is gated on passphrase
      cy.getByTestId('generate-round-btn').click()

      // Modal should appear
      cy.getByTestId('admin-passphrase-modal').should('be.visible')
      cy.getByTestId('admin-passphrase-input').should('be.visible')
    })

    it('submits passphrase and closes modal', () => {
      setupWithEmptyPassphrase()

      cy.getByTestId('generate-round-btn').click()
      cy.getByTestId('admin-passphrase-modal').should('be.visible')

      // Type passphrase and submit
      cy.getByTestId('admin-passphrase-input').type('newsecret')
      cy.getByTestId('admin-passphrase-submit').click()

      // Modal should close
      cy.getByTestId('admin-passphrase-modal').should('not.exist')

      // Passphrase should be stored in sessionStorage
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem(adminStorageKey)).to.equal('newsecret')
      })
    })

    it('submit button is disabled when input is empty', () => {
      setupWithEmptyPassphrase()

      cy.getByTestId('generate-round-btn').click()
      cy.getByTestId('admin-passphrase-modal').should('be.visible')

      // Submit button should be disabled with empty input
      cy.getByTestId('admin-passphrase-submit').should('be.disabled')
    })

    it('cancel dismisses modal without storing passphrase', () => {
      setupWithEmptyPassphrase()

      cy.getByTestId('generate-round-btn').click()
      cy.getByTestId('admin-passphrase-modal').should('be.visible')

      // Type something then cancel
      cy.getByTestId('admin-passphrase-input').type('willcancel')
      cy.getByTestId('admin-passphrase-cancel').click()

      // Modal should close
      cy.getByTestId('admin-passphrase-modal').should('not.exist')

      // Passphrase should still be empty string (not updated)
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem(adminStorageKey)).to.equal('')
      })
    })
  })
})
