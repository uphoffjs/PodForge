describe('Pod Display', () => {
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

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }

  /**
   * Set up event page with an existing round and pod data.
   * @param {Object} options
   * @param {boolean} [options.asAdmin] - Whether to set admin sessionStorage (default: false)
   * @param {string|null} [options.currentPlayerId] - Player identity in localStorage (default: null)
   */
  function setupPageWithPods({ asAdmin = false, currentPlayerId = null } = {}) {
    // Block Realtime WebSocket
    cy.intercept('GET', '**/realtime/v1/websocket*', {
      statusCode: 200,
      body: {},
    })

    // Mock event GET
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

    // Mock rounds GET — handle both useRounds and useCurrentRound
    cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
      if (req.url.includes('limit=1')) {
        req.reply({
          statusCode: 200,
          body: round1,
          headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
        })
      } else {
        req.reply({ statusCode: 200, body: [round1] })
      }
    }).as('getRounds')

    // Mock pods GET with fixture data
    cy.fixture('pods.json').then((podsData) => {
      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: podsData,
      }).as('getPods')

      // Visit with appropriate storage setup
      cy.visit(`/event/${eventId}`, {
        onBeforeLoad(win) {
          if (currentPlayerId) {
            win.localStorage.setItem(playerStorageKey, currentPlayerId)
          }
          if (asAdmin) {
            win.sessionStorage.setItem(adminStorageKey, 'testpass')
            // Admin needs player identity too
            if (!currentPlayerId) {
              win.localStorage.setItem(playerStorageKey, 'player-1')
            }
          }
        },
      })

      cy.wait('@getEvent')
      cy.wait('@getPlayers')
    })
  }

  it('displays non-bye pod cards with pod numbers', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('pod-card-1').should('be.visible')
    cy.getByTestId('pod-card-1').should('contain', 'Pod 1')
    cy.getByTestId('pod-card-2').should('be.visible')
    cy.getByTestId('pod-card-2').should('contain', 'Pod 2')
  })

  it('displays seat ordinals in pod cards', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('pod-card-1').within(() => {
      cy.getByTestId('pod-seat-1').should('contain', '1st')
      cy.getByTestId('pod-seat-2').should('contain', '2nd')
      cy.getByTestId('pod-seat-3').should('contain', '3rd')
      cy.getByTestId('pod-seat-4').should('contain', '4th')
    })
  })

  it('displays player names in pods', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('pod-card-1').within(() => {
      cy.getByTestId('pod-player-player-1').should('contain', 'Alice')
      cy.getByTestId('pod-player-player-2').should('contain', 'Bob')
      cy.getByTestId('pod-player-player-3').should('contain', 'Charlie')
      cy.getByTestId('pod-player-player-4').should('contain', 'Dave')
    })
  })

  it('displays bye pod with distinct styling and no seat numbers', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('pod-card-bye').should('be.visible')
    cy.getByTestId('pod-card-bye').should('contain', 'Ivan')
    cy.getByTestId('pod-card-bye').should('contain', 'Sitting Out')

    // Bye pod should NOT contain any seat number badges
    cy.getByTestId('pod-card-bye').within(() => {
      cy.get('[data-testid^="pod-seat-"]').should('not.exist')
    })
  })

  it('displays round heading with correct number', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('round-display').should('be.visible')
    cy.getByTestId('round-number').should('contain', 'Round 1')
  })

  it('highlights current player in pod', () => {
    // Set current player to player-1 (Alice, in Pod 1)
    setupPageWithPods({ currentPlayerId: 'player-1' })

    cy.getByTestId('pod-player-player-1').should('contain', '(You)')
  })

  it('displays pod border colors', () => {
    setupPageWithPods({ currentPlayerId: 'player-1' })

    // Pod 1 should have blue left border (#3b82f6 = rgb(59, 130, 246))
    cy.getByTestId('pod-card-1').should('have.css', 'border-left-color', 'rgb(59, 130, 246)')

    // Pod 2 should have green left border (#10b981 = rgb(16, 185, 129))
    cy.getByTestId('pod-card-2').should('have.css', 'border-left-color', 'rgb(16, 185, 129)')
  })
})
