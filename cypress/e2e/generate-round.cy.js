describe('Generate Round', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const ninePlayers = [
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

  const threePlayers = ninePlayers.slice(0, 3)

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }
  const round2 = { id: 'round-2', event_id: eventId, round_number: 2, created_at: '2026-01-01T02:00:00Z' }

  /**
   * Set up intercepts and visit the event page as admin.
   * @param {Object} options
   * @param {Array} [options.players] - Player list (default: 9 players)
   * @param {Array} [options.rounds] - Rounds array (default: empty)
   * @param {Object|null} [options.currentRound] - Current round object or null (default: null)
   * @param {Array} [options.pods] - Pods array (default: empty)
   */
  function setupAdminEventPage({
    players = ninePlayers,
    rounds = [],
    currentRound = null,
    pods = [],
  } = {}) {
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

    // Mock rounds GET — handle both useRounds (array) and useCurrentRound (single object)
    cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
      if (req.url.includes('limit=1')) {
        // useCurrentRound uses .limit(1).maybeSingle()
        if (currentRound) {
          req.reply({
            statusCode: 200,
            body: currentRound,
            headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
          })
        } else {
          // maybeSingle on empty result — PostgREST returns null body
          req.reply({
            statusCode: 200,
            body: null,
            headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
          })
        }
      } else {
        // useRounds returns array
        req.reply({ statusCode: 200, body: rounds })
      }
    }).as('getRounds')

    // Mock pods GET
    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: pods,
    }).as('getPods')

    // Visit as admin
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem(adminStorageKey, 'testpass')
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('shows admin controls with Generate Round button for admin', () => {
    setupAdminEventPage()

    cy.getByTestId('admin-controls').should('be.visible')
    cy.getByTestId('generate-round-btn').should('be.visible')
    cy.getByTestId('generate-round-btn').should('contain', 'Generate Next Round')
  })

  it('generates round successfully', () => {
    setupAdminEventPage()

    // Intercept the generate_round RPC call
    cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
      statusCode: 200,
      body: JSON.stringify(1),
      headers: { 'content-type': 'application/json' },
    }).as('generateRound')

    // After the RPC succeeds, React Query invalidates and refetches.
    // Override rounds and pods intercepts to return data for round 1.
    cy.fixture('pods.json').then((podsData) => {
      // After clicking, override the rounds intercept to return round 1
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
      }).as('getRoundsAfter')

      // Override pods to return fixture data
      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: podsData,
      }).as('getPodsAfter')

      // Click generate round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC call
      cy.wait('@generateRound')

      // Assert round display appears
      cy.getByTestId('round-display').should('be.visible')
      cy.getByTestId('round-number').should('contain', 'Round 1')
    })
  })

  it('shows error when fewer than 4 active players', () => {
    setupAdminEventPage({ players: threePlayers })

    // Click generate round — the client-side algorithm will throw
    cy.getByTestId('generate-round-btn').click()

    // Sonner toast with error should appear
    cy.get('[data-sonner-toast]').should('be.visible')
    cy.get('[data-sonner-toast]').should('contain', 'Fewer than 4 active players')
  })

  it('shows round count in admin controls after generation', () => {
    setupAdminEventPage({ rounds: [round1], currentRound: round1 })

    // Admin controls should show "Round 1"
    cy.getByTestId('admin-controls').should('contain', 'Round 1')
  })

  it('generates multiple rounds sequentially', () => {
    // Start with round 1 already existing
    cy.fixture('pods.json').then((podsData) => {
      setupAdminEventPage({
        rounds: [round1],
        currentRound: round1,
        pods: podsData,
      })

      // Verify round 1 is displayed
      cy.getByTestId('round-display').should('be.visible')
      cy.getByTestId('round-number').should('contain', 'Round 1')

      // Intercept the generate_round RPC for round 2
      cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
        statusCode: 200,
        body: JSON.stringify(2),
        headers: { 'content-type': 'application/json' },
      }).as('generateRound2')

      // Override rounds to return both rounds, current = round 2
      cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
        if (req.url.includes('limit=1')) {
          req.reply({
            statusCode: 200,
            body: round2,
            headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
          })
        } else {
          req.reply({ statusCode: 200, body: [round2, round1] })
        }
      }).as('getRoundsAfter2')

      // Override pods to return pods for round 2 (reuse fixture, update round_id)
      const round2Pods = podsData.map((pod) => ({
        ...pod,
        round_id: 'round-2',
      }))
      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: round2Pods,
      }).as('getPodsAfter2')

      // Click generate round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC
      cy.wait('@generateRound2')

      // Assert "Round 2" appears
      cy.getByTestId('round-number').should('contain', 'Round 2')
    })
  })
})
