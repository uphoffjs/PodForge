describe('Timer Display and Admin Controls', () => {
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
  ]

  const round1 = { id: 'round-1', event_id: eventId, round_number: 1, created_at: '2026-01-01T01:00:00Z' }

  /**
   * Set up intercepts and visit the event page with timer data.
   * @param {Object} options
   * @param {Object|null} options.timer - Timer object to return from round_timers, or null
   * @param {boolean} options.asAdmin - Whether to set up admin sessionStorage
   */
  function setupTimerPage({ timer = null, asAdmin = false } = {}) {
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

    // Mock rounds GET — useCurrentRound (maybeSingle) and useRounds (array)
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

    // Mock pods GET (empty)
    cy.intercept('GET', '**/rest/v1/pods*', {
      statusCode: 200,
      body: [],
    }).as('getPods')

    // Mock round_timers GET — useTimer uses .maybeSingle()
    // Returns the timer object or null (PostgREST single-object format)
    cy.intercept('GET', '**/rest/v1/round_timers*', {
      statusCode: 200,
      body: timer,
      headers: {
        'content-type': 'application/vnd.pgrst.object+json; charset=utf-8',
      },
    }).as('getTimer')

    // Visit with onBeforeLoad to set storage before React mounts
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

  describe('Timer display - running state', () => {
    it('shows timer display with countdown when timer is running', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        // Use a dynamically computed expires_at so the countdown shows a positive value
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer })

        cy.getByTestId('timer-display').should('be.visible')
        cy.getByTestId('timer-countdown').should('be.visible')
        // Running timer shows "Round Timer" status label
        cy.getByTestId('timer-status').should('contain', 'Round Timer')
      })
    })
  })

  describe('Timer display - paused state', () => {
    it('shows timer display with paused indicator and remaining time', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        setupTimerPage({ timer: timerFixtures.paused })

        cy.getByTestId('timer-display').should('be.visible')
        cy.getByTestId('timer-countdown').should('contain', '30:00')
        cy.getByTestId('timer-status').should('contain', 'PAUSED')
      })
    })
  })

  describe('Timer display - cancelled timer not shown', () => {
    it('does not display timer when status is cancelled', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        setupTimerPage({ timer: timerFixtures.cancelled })

        // Cancelled timers are filtered out by EventPage guard: timer.status !== 'cancelled'
        cy.getByTestId('timer-display').should('not.exist')
      })
    })
  })

  describe('Timer admin controls - visible for admin', () => {
    it('shows pause, extend, and cancel buttons for admin with running timer', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: true })

        // Admin should see timer control buttons
        cy.getByTestId('timer-pause-btn').should('be.visible')
        cy.getByTestId('timer-extend-btn').should('be.visible')
        cy.getByTestId('timer-cancel-btn').should('be.visible')
      })
    })
  })

  describe('Timer admin controls - hidden for non-admin', () => {
    it('does not show timer control buttons for non-admin users', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: false })

        // Timer display should be visible (everyone sees the timer)
        cy.getByTestId('timer-display').should('be.visible')

        // But control buttons should not exist for non-admin
        cy.getByTestId('timer-pause-btn').should('not.exist')
        cy.getByTestId('timer-extend-btn').should('not.exist')
        cy.getByTestId('timer-cancel-btn').should('not.exist')
      })
    })
  })

  describe('Timer admin controls - pause action', () => {
    it('calls pause_timer RPC when admin clicks pause button', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: true })

        // Intercept the pause_timer RPC call
        cy.intercept('POST', '**/rest/v1/rpc/pause_timer', {
          statusCode: 200,
          body: null,
        }).as('pauseTimer')

        cy.getByTestId('timer-pause-btn').click()

        cy.wait('@pauseTimer')
      })
    })
  })

  describe('Timer admin controls - extend action', () => {
    it('calls extend_timer RPC when admin clicks extend button', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: true })

        // Intercept the extend_timer RPC call
        cy.intercept('POST', '**/rest/v1/rpc/extend_timer', {
          statusCode: 200,
          body: null,
        }).as('extendTimer')

        cy.getByTestId('timer-extend-btn').click()

        cy.wait('@extendTimer')
      })
    })
  })

  describe('Timer admin controls - cancel action', () => {
    it('shows ConfirmDialog and calls cancel_timer RPC on confirm', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: true })

        // Intercept the cancel_timer RPC call
        cy.intercept('POST', '**/rest/v1/rpc/cancel_timer', {
          statusCode: 200,
          body: null,
        }).as('cancelTimer')

        // Click cancel button — should open ConfirmDialog
        cy.getByTestId('timer-cancel-btn').click()

        // ConfirmDialog should appear
        cy.getByTestId('confirm-dialog').should('be.visible')

        // Confirm the cancellation
        cy.getByTestId('confirm-dialog-confirm-btn').click()

        // Should call the RPC
        cy.wait('@cancelTimer')
      })
    })

    it('dismisses ConfirmDialog without calling RPC on cancel', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        const runningTimer = {
          ...timerFixtures.running,
          expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        }
        setupTimerPage({ timer: runningTimer, asAdmin: true })

        // Click cancel button — should open ConfirmDialog
        cy.getByTestId('timer-cancel-btn').click()

        cy.getByTestId('confirm-dialog').should('be.visible')

        // Click the dialog's cancel button to dismiss
        cy.getByTestId('confirm-dialog-cancel-btn').click()

        // Dialog should close
        cy.getByTestId('confirm-dialog').should('not.exist')
      })
    })
  })

  describe('Timer admin controls - resume action', () => {
    it('shows resume button for paused timer and calls resume_timer RPC', () => {
      cy.fixture('timer.json').then((timerFixtures) => {
        setupTimerPage({ timer: timerFixtures.paused, asAdmin: true })

        // Intercept the resume_timer RPC call
        cy.intercept('POST', '**/rest/v1/rpc/resume_timer', {
          statusCode: 200,
          body: null,
        }).as('resumeTimer')

        // Paused timer should show resume button instead of pause
        cy.getByTestId('timer-resume-btn').should('be.visible')
        cy.getByTestId('timer-pause-btn').should('not.exist')

        // Click resume
        cy.getByTestId('timer-resume-btn').click()

        cy.wait('@resumeTimer')
      })
    })
  })
})
