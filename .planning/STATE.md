# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone -- who they're playing with, what seat they're in, and how much time they have.
**Current focus:** v2.0 Complete App — Phase 2.1 E2E and integration tests in progress

## Current Position

Phase: 02.1-phase-2-e2e-and-integration-tests (Plan 2 of 3 complete)
Plan: 02.1-02 complete
Status: In Progress
Last activity: 2026-02-25 — Completed 02.1-02: E2E tests for admin player management, end event, and previous rounds (18 tests across 3 specs)

Progress: Phase 2.1 E2E Tests ██████----  67% (2/3 plans)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 12
- Average duration: 5 min
- Total execution time: 0.87 hours

**Phase 2.1:**
- 02.1-01: 4min, 2 tasks, 5 files
- 02.1-02: 6min, 2 tasks, 3 files

## Accumulated Context

### Decisions

- 02-01: Admin RPCs validate passphrase inline via crypt() with RAISE EXCEPTION (not calling validate_passphrase helper)
- 02-01: generate_round accepts pre-computed JSONB pod assignments, keeping algorithm client-side
- 02-01: Updated players RLS policy to allow both 'active' and 'dropped' status changes for admin reactivation
- 02-02: Greedy algorithm with opponent history matrix (O(n*k)) for pod assignment, not optimal (NP-hard) or random
- 02-02: Pure function design with zero external dependencies for maximum testability
- 02-02: Fisher-Yates shuffle for all randomization (seats, tie-breaking, pool ordering)
- 02-03: AdminControls builds round history from latest round's pods only (superseded by 02-05)
- 02-03: PodCard uses 4-color cycling (blue, green, amber, red) for pod border colors
- 02-03: Event ended state hides interactive elements but preserves pods and player list for historical viewing
- 02-04: AdminPlayerActions injected as ReactNode prop to keep PlayerItem/PlayerList generic and decoupled from admin logic
- 02-04: PreviousRounds lazy-fetches pod data only when a section is expanded (usePods called with roundId on expand)
- 02-05: useAllRoundsPods fetches all rounds in a single Supabase query using .in('round_id', roundIds) for efficiency
- 02-05: PodWithPlayers type import retained from usePods module; only the hook call was removed from AdminControls
- 02.1-01: Differentiate useRounds vs useCurrentRound intercepts by checking URL for limit=1 query parameter
- 02.1-01: Use .cy.js extension matching established Phase 1 pattern, overriding global .cy.ts preference
- 02.1-01: Mock pods with full nested pod_players(*, players(*)) shape matching PostgREST select syntax
- 02.1-02: Scoped pod-card assertions to within() previous-round sections to avoid collision with RoundDisplay elements
- 02.1-02: Used URL pattern matching in route handlers to differentiate useCurrentRound (limit=1) from useRounds (full list)
- 02.1-02: Verified lazy loading via intercept alias .all length assertion before expand and cy.wait after expand

### Roadmap Evolution

- v1.0: Phase 1.1 inserted (Cypress E2E), Phases 1.2-1.4 inserted (gap closures)

### Pending Todos

None.

### Blockers/Concerns

- 6-7 player pod assignment resolved: warn admin, proceed anyway

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 02.1-02-PLAN.md — E2E tests for admin player management, end event, and previous rounds (18 tests across 3 specs)
Resume file: none
