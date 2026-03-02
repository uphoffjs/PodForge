describe('Previous Rounds', () => {
  const eventId = 'test-uuid'
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
  ]

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }
  const round2 = { id: 'round-2', event_id: eventId, round_number: 2, created_at: '2026-01-01T02:00:00Z' }
  const round3 = { id: 'round-3', event_id: eventId, round_number: 3, created_at: '2026-01-01T03:00:00Z' }

  const podsForRound1 = [
    {
      id: 'pod-r1-1',
      round_id: 'round-1',
      pod_number: 1,
      is_bye: false,
      pod_players: [
        { id: 'pp-r1-1', pod_id: 'pod-r1-1', player_id: 'player-1', seat_number: 1, players: { id: 'player-1', name: 'Alice', event_id: eventId, status: 'active', created_at: '2026-01-01T00:01:00Z' } },
        { id: 'pp-r1-2', pod_id: 'pod-r1-1', player_id: 'player-2', seat_number: 2, players: { id: 'player-2', name: 'Bob', event_id: eventId, status: 'active', created_at: '2026-01-01T00:02:00Z' } },
        { id: 'pp-r1-3', pod_id: 'pod-r1-1', player_id: 'player-3', seat_number: 3, players: { id: 'player-3', name: 'Charlie', event_id: eventId, status: 'active', created_at: '2026-01-01T00:03:00Z' } },
        { id: 'pp-r1-4', pod_id: 'pod-r1-1', player_id: 'player-4', seat_number: 4, players: { id: 'player-4', name: 'Dave', event_id: eventId, status: 'active', created_at: '2026-01-01T00:04:00Z' } },
      ],
    },
  ]

  const podsForRound2 = [
    {
      id: 'pod-r2-1',
      round_id: 'round-2',
      pod_number: 1,
      is_bye: false,
      pod_players: [
        { id: 'pp-r2-1', pod_id: 'pod-r2-1', player_id: 'player-3', seat_number: 1, players: { id: 'player-3', name: 'Charlie', event_id: eventId, status: 'active', created_at: '2026-01-01T00:03:00Z' } },
        { id: 'pp-r2-2', pod_id: 'pod-r2-1', player_id: 'player-4', seat_number: 2, players: { id: 'player-4', name: 'Dave', event_id: eventId, status: 'active', created_at: '2026-01-01T00:04:00Z' } },
        { id: 'pp-r2-3', pod_id: 'pod-r2-1', player_id: 'player-1', seat_number: 3, players: { id: 'player-1', name: 'Alice', event_id: eventId, status: 'active', created_at: '2026-01-01T00:01:00Z' } },
        { id: 'pp-r2-4', pod_id: 'pod-r2-1', player_id: 'player-2', seat_number: 4, players: { id: 'player-2', name: 'Bob', event_id: eventId, status: 'active', created_at: '2026-01-01T00:02:00Z' } },
      ],
    },
  ]

  const podsForRound3 = [
    {
      id: 'pod-r3-1',
      round_id: 'round-3',
      pod_number: 1,
      is_bye: false,
      pod_players: [
        { id: 'pp-r3-1', pod_id: 'pod-r3-1', player_id: 'player-2', seat_number: 1, players: { id: 'player-2', name: 'Bob', event_id: eventId, status: 'active', created_at: '2026-01-01T00:02:00Z' } },
        { id: 'pp-r3-2', pod_id: 'pod-r3-1', player_id: 'player-1', seat_number: 2, players: { id: 'player-1', name: 'Alice', event_id: eventId, status: 'active', created_at: '2026-01-01T00:01:00Z' } },
        { id: 'pp-r3-3', pod_id: 'pod-r3-1', player_id: 'player-4', seat_number: 3, players: { id: 'player-4', name: 'Dave', event_id: eventId, status: 'active', created_at: '2026-01-01T00:04:00Z' } },
        { id: 'pp-r3-4', pod_id: 'pod-r3-1', player_id: 'player-3', seat_number: 4, players: { id: 'player-3', name: 'Charlie', event_id: eventId, status: 'active', created_at: '2026-01-01T00:03:00Z' } },
      ],
    },
  ]

  /**
   * Set up page with configurable rounds.
   * @param {Object} options
   * @param {Array} options.rounds - Array of round objects (ordered desc by round_number)
   * @param {Object} options.currentRound - The current (highest) round
   * @param {Object} options.podsByRound - Map of roundId -> pods array
   */
  function setupPageWithRounds({ rounds, currentRound, podsByRound }) {
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

    // Mock rounds GET - handle both useCurrentRound (limit=1, maybeSingle) and useRounds (full list)
    cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
      if (req.url.includes('limit=1')) {
        // useCurrentRound - returns single object with pgrst.object header
        req.reply({
          statusCode: 200,
          body: currentRound,
          headers: {
            'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
          },
        })
      } else {
        // useRounds - returns array of all rounds, ordered desc by round_number
        req.reply({
          statusCode: 200,
          body: rounds,
        })
      }
    }).as('getRounds')

    // Mock pods GET - differentiate by round_id in URL
    cy.intercept('GET', '**/rest/v1/pods*', (req) => {
      // Check for specific round_id matches
      for (const [roundId, podData] of Object.entries(podsByRound)) {
        if (req.url.includes(`round_id=eq.${roundId}`)) {
          req.reply({ statusCode: 200, body: podData })
          return
        }
      }
      // Handle useAllRoundsPods (round_id=in.(...))
      if (req.url.includes('round_id=in.')) {
        const allPods = Object.values(podsByRound).flat()
        req.reply({ statusCode: 200, body: allPods })
        return
      }
      // Default: empty array
      req.reply({ statusCode: 200, body: [] })
    }).as('getPods')

    // Visit with player identity (no admin needed for viewing rounds)
    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  it('shows Previous Rounds section when multiple rounds exist', () => {
    setupPageWithRounds({
      rounds: [round2, round1], // desc order
      currentRound: round2,
      podsByRound: {
        'round-1': podsForRound1,
        'round-2': podsForRound2,
      },
    })

    cy.getByTestId('previous-rounds').should('be.visible')
  })

  it('does not show Previous Rounds when only one round exists', () => {
    setupPageWithRounds({
      rounds: [round1],
      currentRound: round1,
      podsByRound: {
        'round-1': podsForRound1,
      },
    })

    // With only one round, there are no previous rounds to show
    cy.getByTestId('previous-rounds').should('not.exist')
  })

  it('displays previous rounds in order (most recent first among previous)', () => {
    // 3 rounds: current=3, previous=2 then 1
    setupPageWithRounds({
      rounds: [round3, round2, round1], // desc order
      currentRound: round3,
      podsByRound: {
        'round-1': podsForRound1,
        'round-2': podsForRound2,
        'round-3': podsForRound3,
      },
    })

    cy.getByTestId('previous-rounds').should('be.visible')

    // Round 2 should appear before Round 1 in the DOM
    // useRounds returns desc order: [3, 2, 1]. PreviousRounds filters out current (3),
    // leaving [2, 1] which it maps in order. So round 2 appears first.
    cy.getByTestId('previous-round-2').should('be.visible')
    cy.getByTestId('previous-round-1').should('be.visible')

    // Current round (round 3) must NOT appear in previous rounds section
    cy.getByTestId('previous-round-3').should('not.exist')

    // Verify DOM ordering: previous-round-2 should come before previous-round-1
    cy.get('[data-testid^="previous-round-"]').then(($sections) => {
      const testIds = [...$sections].map((el) => el.getAttribute('data-testid'))
      expect(testIds.indexOf('previous-round-2')).to.be.lessThan(
        testIds.indexOf('previous-round-1')
      )
    })
  })

  it('previous round section is collapsed by default', () => {
    setupPageWithRounds({
      rounds: [round2, round1],
      currentRound: round2,
      podsByRound: {
        'round-1': podsForRound1,
        'round-2': podsForRound2,
      },
    })

    // The previous-round-1 section should be visible (the header is always visible)
    cy.getByTestId('previous-round-1').should('be.visible')

    // But pod cards should NOT be visible within the previous round section (content is collapsed)
    // We scope to previous-round-1 because RoundDisplay for the current round may also have pod-card-1
    cy.getByTestId('previous-round-1').within(() => {
      cy.get('[data-testid="pod-card-1"]').should('not.exist')
    })
  })

  it('expands previous round on toggle click', () => {
    setupPageWithRounds({
      rounds: [round2, round1],
      currentRound: round2,
      podsByRound: {
        'round-1': podsForRound1,
        'round-2': podsForRound2,
      },
    })

    // Click toggle to expand round 1
    cy.getByTestId('previous-round-toggle-1').click()

    // Pod cards should now be visible within the expanded section
    cy.getByTestId('previous-round-1').within(() => {
      cy.getByTestId('pod-card-1').should('be.visible')
    })

    // Player names should be displayed within pods
    cy.getByTestId('previous-round-1').within(() => {
      cy.getByTestId('pod-player-player-1').should('be.visible')
      cy.getByTestId('pod-player-player-2').should('be.visible')
      cy.getByTestId('pod-player-player-3').should('be.visible')
      cy.getByTestId('pod-player-player-4').should('be.visible')
    })
  })

  it('collapses previous round on second toggle click', () => {
    setupPageWithRounds({
      rounds: [round2, round1],
      currentRound: round2,
      podsByRound: {
        'round-1': podsForRound1,
        'round-2': podsForRound2,
      },
    })

    // Click toggle to expand
    cy.getByTestId('previous-round-toggle-1').click()
    cy.getByTestId('previous-round-1').within(() => {
      cy.getByTestId('pod-card-1').should('be.visible')
    })

    // Click toggle again to collapse
    cy.getByTestId('previous-round-toggle-1').click()

    // Pod cards should no longer be visible
    cy.getByTestId('previous-round-1').within(() => {
      cy.get('[data-testid="pod-card-1"]').should('not.exist')
    })
  })

  it('lazy-loads pod data only when expanded', () => {
    // Set up specific named intercepts for lazy loading verification
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

    // Mock rounds GET
    cy.intercept('GET', '**/rest/v1/rounds*', (req) => {
      if (req.url.includes('limit=1')) {
        req.reply({
          statusCode: 200,
          body: round2,
          headers: {
            'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
          },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: [round2, round1],
        })
      }
    }).as('getRounds')

    // Set up separate intercepts to track calls per round
    // The current round (round-2) pods will be fetched by RoundDisplay immediately
    cy.intercept('GET', '**/rest/v1/pods*round_id=eq.round-2*', {
      statusCode: 200,
      body: podsForRound2,
    }).as('getPodsRound2')

    // Previous round (round-1) pods should only be fetched when expanded
    cy.intercept('GET', '**/rest/v1/pods*round_id=eq.round-1*', {
      statusCode: 200,
      body: podsForRound1,
    }).as('getPodsRound1')

    // Handle useAllRoundsPods query from AdminControls
    cy.intercept('GET', '**/rest/v1/pods*round_id=in.*', {
      statusCode: 200,
      body: [...podsForRound1, ...podsForRound2],
    }).as('getAllPods')

    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(playerStorageKey, 'player-1')
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')

    // Previous rounds section should be visible
    cy.getByTestId('previous-rounds').should('be.visible')

    // Assert NO pods request has been made for round-1 yet
    cy.get('@getPodsRound1.all').should('have.length', 0)

    // Click toggle to expand round 1
    cy.getByTestId('previous-round-toggle-1').click()

    // Now the pods request for round-1 should fire
    cy.wait('@getPodsRound1')

    // Pod data should be visible
    cy.getByTestId('previous-round-1').within(() => {
      cy.getByTestId('pod-card-1').should('be.visible')
    })
  })
})
