describe('Pods of 3', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const endedEvent = {
    ...event,
    status: 'ended',
  }

  const sevenPlayers = [
    { id: 'player-1', event_id: eventId, name: 'Alice', status: 'active', created_at: '2026-01-01T00:01:00Z' },
    { id: 'player-2', event_id: eventId, name: 'Bob', status: 'active', created_at: '2026-01-01T00:02:00Z' },
    { id: 'player-3', event_id: eventId, name: 'Charlie', status: 'active', created_at: '2026-01-01T00:03:00Z' },
    { id: 'player-4', event_id: eventId, name: 'Dave', status: 'active', created_at: '2026-01-01T00:04:00Z' },
    { id: 'player-5', event_id: eventId, name: 'Eve', status: 'active', created_at: '2026-01-01T00:05:00Z' },
    { id: 'player-6', event_id: eventId, name: 'Frank', status: 'active', created_at: '2026-01-01T00:06:00Z' },
    { id: 'player-7', event_id: eventId, name: 'Grace', status: 'active', created_at: '2026-01-01T00:07:00Z' },
  ]

  const fivePlayers = sevenPlayers.slice(0, 5)

  const ninePlayers = [
    ...sevenPlayers,
    { id: 'player-8', event_id: eventId, name: 'Heidi', status: 'active', created_at: '2026-01-01T00:08:00Z' },
    { id: 'player-9', event_id: eventId, name: 'Ivan', status: 'active', created_at: '2026-01-01T00:09:00Z' },
  ]

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }

  /**
   * Set up intercepts and visit the event page as admin.
   * @param {Object} options
   * @param {Object} [options.eventData] - Event object (default: active event)
   * @param {Array} [options.players] - Player list (default: 7 players)
   * @param {Array} [options.rounds] - Rounds array (default: empty)
   * @param {Object|null} [options.currentRound] - Current round or null (default: null)
   * @param {Array} [options.pods] - Pods array (default: empty)
   */
  function setupAdminEventPage({
    eventData = event,
    players = sevenPlayers,
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
      body: eventData,
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
        if (currentRound) {
          req.reply({
            statusCode: 200,
            body: currentRound,
            headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
          })
        } else {
          req.reply({
            statusCode: 200,
            body: null,
            headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
          })
        }
      } else {
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

  it('shows Allow pods of 3 checkbox in admin controls', () => {
    setupAdminEventPage()

    cy.getByTestId('pods-of-3-checkbox').should('be.visible')
    cy.getByTestId('pods-of-3-checkbox').should('not.be.checked')
  })

  it('generates round with pods of 3 when toggle is enabled', () => {
    setupAdminEventPage()

    // Check the "Allow pods of 3" checkbox
    cy.getByTestId('pods-of-3-checkbox').check()
    cy.getByTestId('pods-of-3-checkbox').should('be.checked')

    // Intercept the generate_round RPC call
    cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
      statusCode: 200,
      body: JSON.stringify(1),
      headers: { 'content-type': 'application/json' },
    }).as('generateRound')

    // After the RPC succeeds, override rounds and pods intercepts
    cy.fixture('pods-of-3.json').then((podsOf3Data) => {
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

      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: podsOf3Data,
      }).as('getPodsAfter')

      // Click Generate Round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC call
      cy.wait('@generateRound')

      // Assert round display appears
      cy.getByTestId('round-display').should('be.visible')
      cy.getByTestId('round-number').should('contain', 'Round 1')

      // Assert pod 1 has 4 players
      cy.getByTestId('pod-card-1').should('be.visible')
      cy.getByTestId('pod-card-1').within(() => {
        cy.getByTestId('pod-player-player-1').should('contain', 'Alice')
        cy.getByTestId('pod-player-player-2').should('contain', 'Bob')
        cy.getByTestId('pod-player-player-3').should('contain', 'Charlie')
        cy.getByTestId('pod-player-player-4').should('contain', 'Dave')
        cy.getByTestId('pod-seat-1').should('contain', '1st')
        cy.getByTestId('pod-seat-2').should('contain', '2nd')
        cy.getByTestId('pod-seat-3').should('contain', '3rd')
        cy.getByTestId('pod-seat-4').should('contain', '4th')
      })

      // Assert pod 2 has exactly 3 players (the pods-of-3 feature)
      cy.getByTestId('pod-card-2').should('be.visible')
      cy.getByTestId('pod-card-2').within(() => {
        cy.getByTestId('pod-player-player-5').should('contain', 'Eve')
        cy.getByTestId('pod-player-player-6').should('contain', 'Frank')
        cy.getByTestId('pod-player-player-7').should('contain', 'Grace')
        // Verify exactly 3 seat labels
        cy.getByTestId('pod-seat-1').should('contain', '1st')
        cy.getByTestId('pod-seat-2').should('contain', '2nd')
        cy.getByTestId('pod-seat-3').should('contain', '3rd')
        // Verify no 4th seat exists
        cy.get('[data-testid="pod-seat-4"]').should('not.exist')
      })

      // No bye pod should exist (7 players = 4 + 3, no byes)
      cy.getByTestId('pod-card-bye').should('not.exist')
    })
  })

  it('generates round WITHOUT pods of 3 when toggle is off (default)', () => {
    setupAdminEventPage({ players: ninePlayers })

    // Do NOT check the checkbox (leave as default unchecked)
    cy.getByTestId('pods-of-3-checkbox').should('not.be.checked')

    // Intercept the generate_round RPC call
    cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
      statusCode: 200,
      body: JSON.stringify(1),
      headers: { 'content-type': 'application/json' },
    }).as('generateRound')

    // Override rounds/pods to return standard pods.json fixture (2 pods of 4 + 1 bye)
    cy.fixture('pods.json').then((standardPodsData) => {
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

      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: standardPodsData,
      }).as('getPodsAfter')

      // Click Generate Round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC call
      cy.wait('@generateRound')

      // Assert round display appears
      cy.getByTestId('round-display').should('be.visible')

      // Assert bye pod appears (standard 9-player behavior: 2 pods of 4 + 1 bye)
      cy.getByTestId('pod-card-bye').should('be.visible')
      cy.getByTestId('pod-card-bye').should('contain', 'Sitting Out')
    })
  })

  it('shows warning toast for 5 players with toggle enabled', () => {
    setupAdminEventPage({ players: fivePlayers })

    // Check the "Allow pods of 3" checkbox
    cy.getByTestId('pods-of-3-checkbox').check()

    // Intercept the generate_round RPC call
    cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
      statusCode: 200,
      body: JSON.stringify(1),
      headers: { 'content-type': 'application/json' },
    }).as('generateRound')

    // 5 players with allowPodsOf3 = 1 pod of 4 + 1 bye (same as standard)
    cy.fixture('pods.json').then((standardPodsData) => {
      // Use a subset: 1 pod of 4 + 1 bye for 5 players
      const fivePlayerPods = [
        {
          ...standardPodsData[0],
          pod_players: standardPodsData[0].pod_players.slice(0, 4),
        },
        {
          id: 'pod-bye',
          round_id: 'round-1',
          pod_number: 2,
          is_bye: true,
          pod_players: [
            {
              id: 'pp-5',
              pod_id: 'pod-bye',
              player_id: 'player-5',
              seat_number: null,
              players: fivePlayers[4],
            },
          ],
        },
      ]

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

      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: fivePlayerPods,
      }).as('getPodsAfter')

      // Click Generate Round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC call
      cy.wait('@generateRound')

      // Assert Sonner warning toast appears containing '5 players'
      // Use 'exist' instead of 'be.visible' because the success toast may stack on top
      cy.get('[data-sonner-toast][data-type="warning"]').should('exist')
      cy.get('[data-sonner-toast][data-type="warning"]').should('contain', '5 players')

      // Assert round still generates (1 pod of 4 + 1 bye)
      cy.getByTestId('round-display').should('be.visible')
      cy.getByTestId('pod-card-1').should('be.visible')
      cy.getByTestId('pod-card-bye').should('be.visible')
    })
  })

  it('checkbox resets after successful generation', () => {
    setupAdminEventPage()

    // Check the "Allow pods of 3" checkbox
    cy.getByTestId('pods-of-3-checkbox').check()
    cy.getByTestId('pods-of-3-checkbox').should('be.checked')

    // Intercept the generate_round RPC call
    cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
      statusCode: 200,
      body: JSON.stringify(1),
      headers: { 'content-type': 'application/json' },
    }).as('generateRound')

    // Override rounds/pods after generation
    cy.fixture('pods-of-3.json').then((podsOf3Data) => {
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

      cy.intercept('GET', '**/rest/v1/pods*', {
        statusCode: 200,
        body: podsOf3Data,
      }).as('getPodsAfter')

      // Click Generate Round
      cy.getByTestId('generate-round-btn').click()

      // Wait for the RPC call
      cy.wait('@generateRound')

      // Assert checkbox is now unchecked (reset after success)
      cy.getByTestId('pods-of-3-checkbox').should('not.be.checked')
    })
  })

  it('checkbox is hidden when event is ended', () => {
    setupAdminEventPage({ eventData: endedEvent })

    // When event is ended, the EventPage does not render AdminControls at all
    // Verify the ended banner appears instead
    cy.getByTestId('event-ended-banner').should('be.visible')

    // AdminControls (and therefore the checkbox) should not exist
    cy.getByTestId('admin-controls').should('not.exist')
    cy.getByTestId('pods-of-3-checkbox').should('not.exist')
  })
})
