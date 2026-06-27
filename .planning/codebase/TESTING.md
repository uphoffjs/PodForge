---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
---

# Testing Patterns

**Analysis Date:** 2026-06-27

## Test Framework

**Runner:**
- Vitest 4.x — config in `vite.config.ts` under the `test` key
- jsdom environment for React component tests
- `globals: true` — `describe`, `it`, `expect`, `vi` available without importing

**Assertion Library:**
- Vitest built-in `expect` + `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`, `toHaveClass`, `toHaveStyle`)

**E2E Runner:**
- Cypress 15.x — config in `cypress.config.js`
- Specs: `cypress/e2e/**/*.cy.js`; Support: `cypress/support/e2e.js`; Commands: `cypress/support/commands.js`
- Base URL: `http://localhost:5173` (Vite dev server)
- Retries disabled (`retries: 0`)

**Mutation Testing:**
- Stryker 9.x with `@stryker-mutator/vitest-runner`
- Config: `stryker.config.mjs`
- Thresholds: high=90, low=80, break=80 (CI fails below 80%)
- HTML report: `reports/mutation/index.html`

**Run Commands:**
```bash
npm test                    # Run all unit/integration tests once
npm run test:coverage       # Run with V8 coverage report
npm run test:mutation       # Run Stryker mutation testing
npm run cy:open             # Open Cypress interactive mode
npm run cy:run              # Run Cypress headless
```

## Test File Organization

**Location:**
- Unit and integration tests: co-located with source files in the same directory
  - Components: `src/components/ComponentName.test.tsx` beside `ComponentName.tsx`
  - Hooks: `src/components/useHookName.test.ts` beside `useHookName.ts` (hooks live in `src/components/`)
  - Lib utilities: `src/lib/util.test.ts` beside `util.ts`
  - Pages: `src/pages/PageName.test.tsx` beside `PageName.tsx`

**Naming:**
- Unit: `<module>.test.ts` / `<module>.test.tsx`
- Integration: `<module>.integration.test.ts` (currently: `pod-algorithm.integration.test.ts`)
- Cypress: `<feature>.cy.js` (kebab-case)

**Coverage Exclusions** (from `vite.config.ts`):
- `src/**/*.test.{ts,tsx}` — test files excluded
- `src/test/**` — setup excluded
- `src/types/**` — type-only files excluded
- `src/vite-env.d.ts`, `src/main.tsx` — entry point and ambient types excluded

**Coverage Thresholds:**
- 100% statements, branches, functions, and lines enforced — CI fails if any drop below 100%

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ComponentOrModule', () => {
  describe('feature or scenario', () => {
    it('does specific thing', () => {
      // arrange
      // act
      // assert
    })
  })
})
```

**Patterns:**
- `beforeEach(() => { vi.clearAllMocks() })` — always clears mocks between tests
- `vi.hoisted(() => ({ mockFn: vi.fn() }))` — hoisted mock variable declarations to ensure they exist before `vi.mock(...)` factory runs
- `vi.resetModules()` in `beforeEach` for module-singleton tests (e.g., `supabase.test.ts`)
- `it.each(array)('description for %i', (value) => ...)` — parameterized tests used heavily in `pod-algorithm.test.ts`
- Named `describe` blocks describe behavioral groupings, not file sections

**Parameterized Test Example** (`src/lib/pod-algorithm.test.ts`):
```typescript
const playerCounts = Array.from({ length: 17 }, (_, i) => i + 4) // [4..20]
it.each(playerCounts)('creates correct pod structure for %i players', (count) => {
  const players = makePlayers(count)
  const result = generatePods(players, [])
  // ...assertions
})
```

## Mocking

**Framework:** `vi.mock()` from Vitest

**Supabase Mocking Pattern:**
```typescript
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))
```

**Hook Mocking Pattern** (for component tests):
```typescript
const mockMutate = vi.fn()
vi.mock('@/hooks/useGenerateRound', () => ({
  useGenerateRound: () => ({ mutate: mockMutate, isPending: false }),
}))
```

**Module-level configurable mocks:**
```typescript
// Declare mutable at module scope, reassign in tests
let mockRoundsData: Round[] | undefined
vi.mock('@/hooks/useRounds', () => ({
  useRounds: () => ({ data: mockRoundsData }),
}))
// In test: mockRoundsData = [round1, round2]
```

**Environment Variable Stubbing:**
```typescript
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-12345')
```

**What to Mock:**
- All Supabase calls (`@/lib/supabase`) in unit tests — prevents network requests
- All hooks in component render tests — isolates the component under test
- `sonner` `toast` — prevents side effects and allows assertion on calls
- `react-router` hooks (`useParams`, `useNavigate`) — decouples routing
- `Math.random` with deterministic LCG seeder for algorithm tests requiring reproducibility

**What NOT to Mock:**
- `pod-algorithm.ts` internals in unit tests — tested directly as a pure function
- `@testing-library/react` render utilities — always used real
- React Query in integration tests — test actual query behavior via `QueryClientProvider`

## Fixtures and Factories

**Test Factories** (in unit test files, not extracted to fixtures):
```typescript
function makePlayers(count: number): PlayerInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
  }))
}

function makePlayer(overrides: Partial<PodCardPlayer> = {}): PodCardPlayer {
  return {
    playerId: 'player-1',
    playerName: 'Alice',
    seatNumber: 1,
    ...overrides,
  }
}
```

**Cypress JSON Fixtures** (`cypress/fixtures/`):
- `event.json` — default active event object
- `players.json` — player array
- `pods.json` — pods with pod_players (standard 4-player pods)
- `pods-of-3.json` — pods fixture with 3-player pod (used by `pods-of-3.cy.js`)
- `rounds.json` — round array
- `timer.json` — timer states: `running`, `paused`, `cancelled`
- `error-duplicate.json` — Supabase error body for duplicate player name

**Deterministic Seeding** (for stochastic algorithm tests):
```typescript
function seedRandom(seed: number) {
  let state = seed
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  })
}
// Usage:
const spy = seedRandom(42 + count)
try { /* run test */ } finally { spy.mockRestore() }
```

## React Component Testing

**Wrapper Pattern** (for React Query):
```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const { result } = renderHook(() => useMyHook('id'), { wrapper: createWrapper() })
```

**User Interaction:**
- `@testing-library/user-event` v14 for keyboard/click interactions — `userEvent.type()`, `userEvent.click()`
- `fireEvent` used only when `userEvent` is overkill (simple click testing)

**Async Assertions:**
```typescript
await waitFor(() => {
  expect(mockToastError).toHaveBeenCalledWith('...')
})
```

**Async Hook Mutation Pattern:**
```typescript
result.current.mutate({ passphrase: 'secret', podAssignments })
await waitFor(() => expect(mockRpc).toHaveBeenCalled())
```

## Cypress E2E Patterns

**Custom Commands** (`cypress/support/commands.js`):
- `cy.getByTestId(testId)` — wraps `cy.get('[data-testid="..."]')`, used exclusively for element selection
- `cy.mockEventPage(eventData?, playersData?)` — intercepts event/players REST calls and visits `/event/:id`
- `cy.createRealEvent(name, passphrase)` — makes real Supabase RPC call (integration tests only)
- `cy.mockLandingPage()` — intercepts background calls and visits `/`

**Network Mocking:**
```javascript
cy.intercept('GET', '**/rest/v1/events*', {
  statusCode: 200,
  body: event,
  headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
}).as('getEvent')

cy.wait('@getEvent')
```

**PostgREST Single Object Headers:**
- `useQuery` with `.single()` or `.maybeSingle()` requires `content-type: application/vnd.pgrst.object+json; charset=utf-8` in intercepted responses
- Without this header, PostgREST parses response as an array and the query fails

**Session/Storage Setup in `onBeforeLoad`:**
```javascript
cy.visit(`/event/${eventId}`, {
  onBeforeLoad(win) {
    win.sessionStorage.setItem(`podforge_admin_${eventId}`, 'testpass')
    win.localStorage.setItem(`podforge_player_${eventId}`, 'player-1')
  },
})
```

**Global Error Suppression** (`cypress/support/e2e.js`):
- WebSocket/Realtime errors suppressed globally: `Cypress.on('uncaught:exception', ...)`
- localStorage/sessionStorage cleared `beforeEach` to prevent state leakage

**Fixture-Driven E2E:**
```javascript
cy.fixture('pods-of-3.json').then((podsOf3Data) => {
  cy.intercept('GET', '**/rest/v1/pods*', {
    statusCode: 200,
    body: podsOf3Data,
  }).as('getPodsAfter')

  cy.getByTestId('generate-round-btn').click()
  cy.wait('@generateRound')
  cy.getByTestId('pod-card-2').should('be.visible')
})
```

## Coverage

**Requirements:** 100% statements, branches, functions, lines — enforced in `vite.config.ts` coverage thresholds

**View Coverage:**
```bash
npm run test:coverage       # Generates coverage/index.html
```

**Coverage Provider:** V8 (via `@vitest/coverage-v8`)

## Test Types

**Unit Tests:**
- Scope: single component, hook, or pure function in isolation
- All dependencies mocked via `vi.mock()`
- Location: co-located with source (`*.test.ts` / `*.test.tsx`)
- Count: 1 test file per source file — every `*.ts`/`*.tsx` in `src/` has a corresponding test

**Integration Tests:**
- Scope: multi-round simulation of pod algorithm with real algorithm code (no mocks)
- Location: `src/lib/pod-algorithm.integration.test.ts` (762 lines)
- Tests multi-round fairness, repeat-opponent avoidance, max-pair guarantees across player counts 4–20

**E2E Tests:**
- Scope: full user flows through the browser (Vite dev server + Supabase REST intercepted)
- Location: `cypress/e2e/` (14 spec files)
- Coverage: event-creation, player-join, generate-round, admin-passphrase, admin-player-management, admin-add-player, duplicate-name, self-drop, pod-display, previous-rounds, qr-code, end-event, timer, pods-of-3

## Mutation Testing

**Thresholds:** high=90, low=80, break=80 — CI PR gate fails below 80%

**Mutated Files:**
- `src/**/*.ts`, `src/**/*.tsx`
- Excludes: test files, `src/test/**`, `src/vite-env.d.ts`, `src/main.tsx`

**Targeted Mutation Tests** (tests written specifically to kill known mutants):
- `pod-algorithm.test.ts` contains extensive inline comments naming exact mutations targeted (e.g., `score < bestScore -> score <= bestScore`, `aByes - bByes => aByes + bByes`)
- Tests run 10–50 trials to statistically detect probabilistic mutations in randomized code

## CI/CD Testing Gates

**CI (GitHub Actions):**
- `ci.yml` — runs on push/PR to `main`: lint → type-check → `npm run test:coverage` (100% thresholds enforced)
- `e2e.yml` — runs on push/PR to `main`: build → start dev server → `cypress run` (all 14 specs)
- `mutation.yml` — runs on PR to `main` only: `stryker run` with break=80 threshold

## Features and Coverage Status

### Fully Tested Features

| Feature | Unit | Integration | E2E |
|---------|------|-------------|-----|
| Pod algorithm (generatePods) | `pod-algorithm.test.ts` (1752 lines) | `pod-algorithm.integration.test.ts` (762 lines) | `generate-round.cy.js`, `pod-display.cy.js` |
| Pods of 3 (allowPodsOf3) | `AdminControls.test.tsx`, `PodCard.test.tsx` | `pod-algorithm.integration.test.ts` | `pods-of-3.cy.js` |
| Event creation | `CreateEventModal.test.tsx`, `useCreateEvent.test.ts` | — | `event-creation.cy.js` |
| Player join | `JoinEventForm.test.tsx`, `useJoinEvent.test.ts` | — | `player-join.cy.js` |
| Admin passphrase | `AdminPassphraseModal.test.tsx`, `useAdminAuth.test.ts` | — | `admin-passphrase.cy.js` |
| Player management (drop/reactivate) | `AdminPlayerActions.test.tsx`, `useDropPlayer.test.ts`, `useReactivatePlayer.test.ts` | — | `admin-player-management.cy.js` |
| Admin add player | `AddPlayerForm.test.tsx`, `useAddPlayer.test.ts` | — | `admin-add-player.cy.js` |
| Duplicate name rejection | `useJoinEvent.test.ts`, `useAddPlayer.test.ts` | — | `duplicate-name.cy.js` |
| Self-drop (leave event) | `useDropPlayer.test.ts`, `useRemovePlayer.test.ts` | — | `self-drop.cy.js` |
| QR code display | `QRCodeDisplay.test.tsx` | — | `qr-code.cy.js` |
| Previous rounds display | `PreviousRounds.test.tsx` | — | `previous-rounds.cy.js` |
| End event | `useEndEvent.test.ts` | — | `end-event.cy.js` |
| Timer display | `TimerDisplay.test.tsx`, `useCountdown.test.ts`, `useTimer.test.ts` | — | `timer.cy.js` |
| Timer controls (pause/resume/extend/cancel) | `TimerControls.test.tsx`, `usePauseTimer.test.ts`, `useResumeTimer.test.ts`, `useExtendTimer.test.ts`, `useCancelTimer.test.ts` | — | `timer.cy.js` |
| Timer notification | `useTimerNotification.test.ts` | — | — |
| Realtime channel | `useEventChannel.test.ts` | — | — |
| Supabase client init | `supabase.test.ts` | — | — |
| Query client config | `query-client.test.ts` | — | — |
| Player identity (localStorage) | `player-identity.test.ts` | — | — |
| EventPage orchestration | `EventPage.test.tsx` (1489 lines) | — | (covered by multiple E2E specs) |
| LandingPage | `LandingPage.test.tsx` | — | (covered partially by `event-creation.cy.js`) |

### Removed/Missing Test Coverage

**Visual regression tests — REMOVED:**
- 12 Cypress visual regression tests were previously in the test suite (baseline-snapshot approach)
- Removed in commit `50bcfe4` (`fix: remove visual regression tests that never passed in CI`)
- Debug doc `.planning/debug/failing-e2e-tests.md` confirms these never passed in CI due to baseline mismatches
- No visual regression coverage currently exists — there is no visual regression framework configured

**Timer notification E2E — NOT covered:**
- `useTimerNotification` is unit-tested (`useTimerNotification.test.ts`) but has no E2E coverage
- The in-browser `Notification` API permission flow (`timer-notification-prompt`, `timer-notification-enable-btn`) has no Cypress spec
- Notification delivery at timer expiry is untested end-to-end

**Integration tests scope — LIMITED:**
- Integration tests exist only for `pod-algorithm` — no integration-level tests for Supabase hooks, React Query interactions, or multi-component flows

**Opponent diversity (Phase 06) E2E — NOT covered:**
- The opponent avoidance algorithm improvements (quadratic penalty, multi-start greedy, swap pass) added in Phase 06 have no dedicated E2E spec
- Covered only at unit (`pod-algorithm.test.ts`) and integration (`pod-algorithm.integration.test.ts`) levels

### Known Skipped/Disabled Tests

**No `it.skip` or `describe.skip` exist** in the current codebase — all tests are active.

### Previously Failing Tests (Now Resolved)

- `.planning/debug/failing-e2e-tests.md` documents 5 functional E2E failures from `end-event.cy.js`, `event-creation.cy.js`, `qr-code.cy.js` caused by stale `data-testid` values after `EventInfoBar` refactor — **resolved** (stale testids `event-name`, `event-status`, `share-link-input`, `share-copy-btn` updated to `event-info-name`, `event-info-status`, `event-info-share-link`, `event-info-copy-btn`)

### Unfinished Work Signals

**Phase 06 opponent-diversity verification** (`.planning/phases/06-opponent-diversity-and-seat-verification/`):
- 06-VERIFICATION.md and 06-RESEARCH.md present but no open verification items — phase appears complete

**Phase 07 pods-of-3** (`.planning/phases/07-pods-of-3/`):
- 07-03-SUMMARY.md present indicating Stryker mutation validation is planned but current git status shows `.planning/config.json` modified and new debug files uncommitted — phase may have in-flight work

**`.planning/phases/06-opponent-diversity-and-seat-verification/06-01-PLAN.md` (uncommitted)**:
- Listed in `git status` as `??` (untracked) — indicates active planning not yet committed

---

*Testing analysis: 2026-06-27*
