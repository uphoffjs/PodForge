describe('Timer 80+20 — select / generate / start / three-phase transitions', () => {
  const eventId = 'test-uuid'
  const adminStorageKey = `podforge_admin_${eventId}`
  const playerStorageKey = `podforge_player_${eventId}`

  const event = {
    id: eventId,
    name: 'Test Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  // Generating a round runs generatePods client-side, which throws below 4
  // active players — use a full roster so the 80+20 generate path reaches the RPC.
  const players = [
    { id: 'player-1', event_id: eventId, name: 'Alice', status: 'active', created_at: '2026-01-01T00:01:00Z' },
    { id: 'player-2', event_id: eventId, name: 'Bob', status: 'active', created_at: '2026-01-01T00:02:00Z' },
    { id: 'player-3', event_id: eventId, name: 'Charlie', status: 'active', created_at: '2026-01-01T00:03:00Z' },
    { id: 'player-4', event_id: eventId, name: 'Dave', status: 'active', created_at: '2026-01-01T00:04:00Z' },
    { id: 'player-5', event_id: eventId, name: 'Eve', status: 'active', created_at: '2026-01-01T00:05:00Z' },
    { id: 'player-6', event_id: eventId, name: 'Frank', status: 'active', created_at: '2026-01-01T00:06:00Z' },
    { id: 'player-7', event_id: eventId, name: 'Grace', status: 'active', created_at: '2026-01-01T00:07:00Z' },
    { id: 'player-8', event_id: eventId, name: 'Heidi', status: 'active', created_at: '2026-01-01T00:08:00Z' },
  ]

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }

  // Base 80+20 timer: 80 minute main phase, 20 minute (1200s) overtime.
  // Per-phase specs override `status` and `expires_at` to mount a deterministic
  // phase relative to Date.now() (no cy.wait(ms)).
  const baseTimer = {
    id: 'timer-1',
    round_id: 'round-1',
    event_id: eventId,
    duration_minutes: 80,
    status: 'pending',
    started_at: null,
    remaining_seconds: null,
    paused_at: null,
    expires_at: '2026-02-25T13:20:00.000Z',
    created_at: '2026-02-25T12:00:00.000Z',
    overtime_seconds: 1200,
  }

  /**
   * Reuse of the timer.cy.js intercept harness: block the Realtime socket, mock
   * events/players/rounds/pods, and serve round_timers via the PostgREST
   * single-object header (vnd.pgrst.object+json). No cy.wait(ms) anywhere.
   * @param {Object} options
   * @param {Object|null} options.timer - Timer object served from round_timers, or null
   * @param {boolean} options.asAdmin - Whether to seed admin sessionStorage
   */
  function setupTimerPage({ timer = null, asAdmin = false } = {}) {
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

    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: [],
    }).as('getPods')

    cy.intercept('GET', '**/rest/v1/round_timers*', {
      statusCode: 200,
      body: timer,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getTimer')

    cy.visit(`/event/${eventId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(playerStorageKey, 'player-1')
        if (asAdmin) {
          win.sessionStorage.setItem(adminStorageKey, 'testpass')
        }
      },
    })

    cy.wait('@getEvent')
    cy.wait('@getPlayers')
  }

  describe('Select 80+20 and generate', () => {
    it('threads p_overtime_minutes=20 into the generate_round RPC body', () => {
      setupTimerPage({ timer: null, asAdmin: true })

      cy.intercept('POST', '**/rest/v1/rpc/generate_round', {
        statusCode: 200,
        body: JSON.stringify(1),
        headers: { 'content-type': 'application/json' },
      }).as('generateRound')

      // Select the 80+20 preset chip, then generate.
      cy.getByTestId('timer-duration-80-20').click()
      cy.getByTestId('generate-round-btn').click()

      // Assert the intercepted RPC body carries the 20-minute overtime and an
      // 80-minute main duration — proves the preset threaded through to the call.
      cy.wait('@generateRound').then((interception) => {
        expect(interception.request.body.p_overtime_minutes).to.eq(20)
        expect(interception.request.body.p_timer_duration_minutes).to.eq(80)
      })
    })
  })

  describe('Pending card — READY TO START', () => {
    it('renders the not-started card with 80:00 and a Start button', () => {
      const pendingTimer = { ...baseTimer, status: 'pending', overtime_seconds: 1200 }
      setupTimerPage({ timer: pendingTimer, asAdmin: true })

      cy.getByTestId('timer-display').should('be.visible')
      cy.getByTestId('timer-display').should('have.attr', 'data-phase', 'not-started')
      cy.getByTestId('timer-status').should('contain', 'READY TO START')
      cy.getByTestId('timer-countdown').should('contain', '80:00')
      cy.getByTestId('timer-start-btn').should('be.visible')
    })
  })

  describe('Start the pending timer', () => {
    it('fires the start_timer RPC when the admin clicks Start', () => {
      const pendingTimer = { ...baseTimer, status: 'pending', overtime_seconds: 1200 }
      setupTimerPage({ timer: pendingTimer, asAdmin: true })

      cy.intercept('POST', '**/rest/v1/rpc/start_timer', {
        statusCode: 200,
        body: null,
      }).as('startTimer')

      cy.getByTestId('timer-start-btn').click()

      cy.wait('@startTimer').then((interception) => {
        expect(interception.request.body.p_event_id).to.eq(eventId)
      })
    })
  })

  describe('Phase transitions via computed expires_at', () => {
    it('shows the overtime band/label when the main phase has elapsed', () => {
      const overtimeTimer = {
        ...baseTimer,
        status: 'running',
        overtime_seconds: 1200,
        started_at: '2026-02-25T12:00:00.000Z',
        // Main phase expired 60s ago — 1140s of the 1200s overtime remain.
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
      }
      setupTimerPage({ timer: overtimeTimer })

      cy.getByTestId('timer-display').should('be.visible')
      cy.getByTestId('timer-display').should('have.attr', 'data-phase', 'overtime')
      cy.getByTestId('timer-status').should('contain', 'OVERTIME')
    })

    it('shows the count-up (OVERRUN) band/label with a + prefix once overtime is spent', () => {
      const countupTimer = {
        ...baseTimer,
        status: 'running',
        overtime_seconds: 1200,
        started_at: '2026-02-25T12:00:00.000Z',
        // Main (already 0) + full 1200s overtime both elapsed 60s ago → count-up.
        expires_at: new Date(Date.now() - (1200 + 60) * 1000).toISOString(),
      }
      setupTimerPage({ timer: countupTimer })

      cy.getByTestId('timer-display').should('be.visible')
      cy.getByTestId('timer-display').should('have.attr', 'data-phase', 'countup')
      cy.getByTestId('timer-status').should('contain', 'OVERRUN')
      cy.getByTestId('timer-countdown').invoke('text').should('match', /^\+/)
    })
  })
})
