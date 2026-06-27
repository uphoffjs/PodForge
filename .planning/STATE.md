---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Mid-Event Flow & Round Formats
status: executing
stopped_at: "08-01 complete — migration 00005 applied + human-verify checkpoint approved. Next: plan 08-02 (useCountdown three-phase derivation)"
last_updated: "2026-06-27T21:50:54.238Z"
last_activity: 2026-06-27
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 9
  completed_plans: 6
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-27)

**Core value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone -- who they're playing with, what seat they're in, and how much time they have.
**Current focus:** Phase 08 — timer-migration-core-engine

## Current Position

Phase: 08 (timer-migration-core-engine) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-06-27

**v5.0 phase map:**

- Phase 8: Timer Migration & Core Engine — TIMER-03, TIMER-05, TIMER-06 (strictly first; migration 00005)
- Phase 9: Timer UI & Admin Controls — TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05 (depends on 8)
- Phase 10: Mid-Event Join UX — JOIN-01, JOIN-02, JOIN-03, TEST-04 (parallelizable, zero migration)
- Phase 11: Fault-Injection Campaign Completion — FAULT-01..04 (parallelizable, independent)

## Performance Metrics

**v3.0 Velocity (reference):**

- Total plans completed: 6
- Timeline: 3 days (2026-02-25 to 2026-02-27)

**v4.0:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 6 | 2/2 | 32min | 16min |
| 7 | 3/3 | 19min | 6min |
| Phase 08 P01 | 6min | 3 tasks | 1 files |

## Accumulated Context

### Decisions

See: .planning/PROJECT.md Key Decisions table (comprehensive list)

Recent decisions affecting current work:

- [v5.0 Roadmap]: 4 phases — timer split into two (migration+core engine, then UI+controls) per research strict-ordering and risk-isolation; mid-event and fault-injection parallelizable
- [v5.0 Roadmap]: Zero new runtime dependencies; one additive migration 00005 (`overtime_seconds` column, `generate_round` param, `pause_timer` clamp removal, partial unique index on active timers)
- [v5.0 Roadmap]: 80+20 timer is highest-risk track — migration must land before any client work; useCountdown phase engine is the 100% Stryker target
- [v5.0 Roadmap]: Mid-event detection derives from pod participation (player in zero pod_players rows), NOT created_at timestamp comparison — handles late pre-round-1 joiners and reactivated dropouts; clears on pairing
- [v5.0 Roadmap]: User decisions locked — passive mid-join badge only (no approval gate); fixed 80+20 (not configurable); admin explicitly starts timer; count-up runs indefinitely until admin acts; notifications fire at BOTH phase boundaries
- [v5.0 Roadmap]: Branch `feature/v5.0-mid-event-flow` — create before starting Phase 8
- [v4.0 Roadmap]: Test requirements distributed across phases (not a separate test phase) — pattern continued in v5.0
- [Phase ?]: [08-01]: Migration 00005 applied to live DB — overtime_seconds column, overload-safe generate_round (p_overtime_minutes, bounds-checked), signed pause_timer (clamp removed). resume/extend/cancel untouched.

### Pending Todos

None.

### Blockers/Concerns

None. Phase 8 planner should make two explicit design sign-offs before coding (per research): (a) server-time offset mechanism for count-up clock skew; (b) `extend_timer` per-phase semantics.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Update favicon to match app theme | 2026-02-25 | ad0391f | [1-update-favicon-to-match-app-theme](./quick/1-update-favicon-to-match-app-theme/) |
| 2 | Get code coverage to 100% | 2026-02-25 | 0c8e1cf | [2-get-code-coverage-to-100](./quick/2-get-code-coverage-to-100/) |
| 3 | Address technical debt | 2026-02-27 | be42319 | [3-address-the-technical-debt](./quick/3-address-the-technical-debt/) |
| 4 | Set up Cypress Cloud with parallel CI runners | 2026-03-01 | 63107f8 | [4-set-up-cypress-cloud-with-parallel-ci-ru](./quick/4-set-up-cypress-cloud-with-parallel-ci-ru/) |
| 5 | Investigate 5 survived fault injection faults | 2026-03-02 | 87d03eb | [5-investigate-the-5-survived-faults-from-t](./quick/5-investigate-the-5-survived-faults-from-t/) |

## Session Continuity

Last session: 2026-06-27T21:50:54.233Z
Stopped at: 08-01 complete — migration 00005 applied + human-verify checkpoint approved. Next: plan 08-02 (useCountdown three-phase derivation)
Resume file: None
