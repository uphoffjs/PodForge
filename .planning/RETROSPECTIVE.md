# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Complete App

**Shipped:** 2026-02-25
**Phases:** 3 (2, 2.1, 3) | **Plans:** 11 | **Tasks:** 22

### What Was Built
- Greedy pod generation algorithm with opponent history matrix and 90.6% mutation score
- Full admin controls: passphrase-gated round gen, player remove/reactivate, end event
- Server-authoritative round timer with pause/resume/extend/cancel and Realtime sync
- Countdown UI with urgency colors (yellow/red/flashing) and overtime tracking
- Browser notifications at timer expiry with iOS PWA graceful fallback
- 75 Cypress E2E tests + 12 sit-out fairness integration tests

### What Worked
- Pure function design for pod algorithm enabled TDD flow (RED/GREEN/REFACTOR) with 40 tests in 10 minutes
- Server-authoritative timer design (expires_at - now()) eliminated all client drift concerns
- Separating TimerDisplay (presenter) from TimerControls (admin) kept components focused
- Phase 2.1 (dedicated E2E phase) caught integration issues that unit tests missed
- Stryker mutation testing validated that tests were actually catching real bugs (90.6%)

### What Was Inefficient
- AdminControls initially built round history from latest round only (02-03), then needed 02-05 to fix — could have planned complete history from the start
- Phase 2.1 visual regression baselines became stale from Phase 2 UI changes — deferred rather than fixed
- Timer mock absence in Phase 2.1 E2E specs means timer UI is untested at browser level

### Patterns Established
- Passphrase-gated RPC pattern: all admin RPCs validate passphrase inline with crypt() + RAISE EXCEPTION
- Pod color cycling: 4-color array (blue, green, amber, red) indexed by pod number
- Lazy-fetch on expand pattern: PreviousRounds only loads pod data when user expands a section
- Notification dedup: useRef for lastNotifiedTimerId + Notification tag for multi-tab safety
- AdminPlayerActions as ReactNode prop for generic PlayerItem/PlayerList

### Key Lessons
1. Plan for complete data from the start — building with partial data (latest round only) led to a gap closure plan (02-05)
2. Dedicated E2E test phases (Phase 2.1) are valuable for catching integration issues but should include timer mocking to cover all features
3. Server-authoritative timestamps are the correct default for any shared countdown/timer feature
4. Explicit notification permission (user-initiated, never auto-request) is both better UX and more reliable

### Cost Observations
- Model mix: quality profile (Opus for planning/execution)
- Timeline: 2 days total for 11 plans, 22 tasks
- Notable: Average plan execution was ~4 minutes — very high velocity enabled by clear plan structure

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 14 | Established test-first approach, inserted 4 gap closure phases |
| v2.0 | 3 | 11 | TDD for algorithm, dedicated E2E phase, mutation testing |

### Cumulative Quality

| Milestone | Vitest | Cypress E2E | Mutation Score |
|-----------|--------|-------------|----------------|
| v1.0 | 226 | 44 | 96.15% |
| v2.0 | 346 | 75 | 90.6% (pod algo) |

### Top Lessons (Verified Across Milestones)

1. Test infrastructure from day one catches real bugs — both milestones found issues via automated testing
2. Gap closure phases are a natural part of the process — plan for them rather than treating them as failures
3. Pure function design enables fast TDD cycles and high mutation scores
