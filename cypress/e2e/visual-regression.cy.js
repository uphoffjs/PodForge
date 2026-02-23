// Visual regression tests for PodForge dark theme across 3 breakpoints
// Covers: landing page, event page (with players, empty state, join form)
// Uses cypress-visual-regression compareSnapshot with 5% threshold

const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]

/**
 * Wait for Google Fonts to finish loading before capturing screenshots.
 * The app uses Google Fonts CDN with font-display: swap, so without
 * waiting, screenshots capture fallback fonts and produce false diffs.
 */
function waitForFonts() {
  cy.document().its('fonts.status').should('equal', 'loaded')
}

/**
 * Wait for page content to finish rendering after mocks resolve.
 * cy.wait('@getEvent') only waits for the XHR — React may not have
 * re-rendered yet. Assert on a visible element to ensure render is done.
 */
function waitForContent(selector) {
  cy.get(selector, { timeout: 10000 }).should('be.visible')
}

describe('Visual Regression - Landing Page', () => {
  breakpoints.forEach(({ name, width, height }) => {
    it(`matches baseline at ${name} (${width}x${height})`, () => {
      cy.viewport(width, height)
      cy.mockLandingPage()
      waitForContent('[data-testid="landing-create-event-btn"]')
      waitForFonts()
      cy.compareSnapshot(`landing-${name}`, 0.05)
    })
  })
})

describe('Visual Regression - Event Page (with players)', () => {
  const event = {
    id: 'visual-test-uuid',
    name: 'Friday Night Commander',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const players = [
    {
      id: 'player-1',
      event_id: 'visual-test-uuid',
      name: 'Alice',
      status: 'active',
      created_at: '2026-01-01T00:01:00Z',
    },
    {
      id: 'player-2',
      event_id: 'visual-test-uuid',
      name: 'Bob',
      status: 'active',
      created_at: '2026-01-01T00:02:00Z',
    },
    {
      id: 'player-3',
      event_id: 'visual-test-uuid',
      name: 'Charlie',
      status: 'dropped',
      created_at: '2026-01-01T00:03:00Z',
    },
  ]

  breakpoints.forEach(({ name, width, height }) => {
    it(`matches baseline at ${name} (${width}x${height})`, () => {
      cy.viewport(width, height)
      // Set localStorage identity so join form is NOT shown (player is already joined)
      // player-identity.ts stores plain UUID string, not JSON object
      cy.window().then((win) => {
        win.localStorage.setItem(
          `podforge_player_${event.id}`,
          'player-1'
        )
      })
      cy.mockEventPage(event, players)
      waitForContent('[data-testid="player-list"]')
      waitForFonts()
      cy.compareSnapshot(`event-page-${name}`, 0.05)
    })
  })
})

describe('Visual Regression - Event Page (empty state)', () => {
  const event = {
    id: 'visual-empty-uuid',
    name: 'Empty Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  breakpoints.forEach(({ name, width, height }) => {
    it(`matches baseline at ${name} (${width}x${height})`, () => {
      cy.viewport(width, height)
      // No localStorage identity set -- join form will appear
      // Click skip button to dismiss it and show empty player list
      cy.mockEventPage(event, [])
      cy.getByTestId('join-skip-btn').click()
      waitForContent('[data-testid="player-list-empty"]')
      waitForFonts()
      cy.compareSnapshot(`event-empty-${name}`, 0.05)
    })
  })
})

describe('Visual Regression - Event Page (join form)', () => {
  const event = {
    id: 'visual-join-uuid',
    name: 'Join Form Event',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  }

  const players = [
    {
      id: 'player-1',
      event_id: 'visual-join-uuid',
      name: 'Alice',
      status: 'active',
      created_at: '2026-01-01T00:01:00Z',
    },
    {
      id: 'player-2',
      event_id: 'visual-join-uuid',
      name: 'Bob',
      status: 'active',
      created_at: '2026-01-01T00:02:00Z',
    },
  ]

  breakpoints.forEach(({ name, width, height }) => {
    it(`matches baseline at ${name} (${width}x${height})`, () => {
      cy.viewport(width, height)
      // Do NOT set localStorage identity so join form IS shown
      cy.mockEventPage(event, players)
      waitForContent('[data-testid="join-form"]')
      waitForFonts()
      cy.compareSnapshot(`event-join-form-${name}`, 0.05)
    })
  })
})
