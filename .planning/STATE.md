---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Mid-Event Flow & Round Formats
status: executing
stopped_at: Completed 09-03-PLAN.md — timer UI (TimerDisplay phase bands, TimerControls pending Start/Cancel, AdminControls 80+20 preset)
last_updated: "2026-06-29T00:00:00.000Z"
last_activity: 2026-06-29 -- 09-03 complete (timer UI components; TimerDisplay + TimerControls at 100% Stryker, suite green)
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 13
  completed_plans: 12
  percent: 62
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-27)

**Core value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone -- who they're playing with, what seat they're in, and how much time they have.
**Current focus:** Phase 09 — timer-ui-admin-controls

## Current Position

Phase: 09 (timer-ui-admin-controls) — EXECUTING
Plan: 4 of 4 (09-01, 09-02, 09-03 complete; next: 09-04 E2E + Stryker gate)
Status: Executing Phase 09
Last activity: 2026-06-29 -- 09-03 complete (timer UI components; TimerDisplay + TimerControls at 100% Stryker, suite green)

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
| Phase 08 P02 | 18min | 3 tasks | 9 files |
| Phase 08 P03 | 32min | 2 tasks | 3 files |
| Phase 08 P04 | 27min | 2 tasks | 2 files |
| Phase 09 P01 | ~10min | 3 tasks | 1 files |
| Phase 09 P02 | ~25min | 2 tasks | 7 files |
| Phase 09 P03 | ~30min | 3 tasks | 6 files |

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
- [08-02]: RoundTimer.overtime_seconds is a REQUIRED field (forces compile-time consumer audit); remaining_seconds documented SIGNED. useGenerateRound threads p_overtime_minutes: overtimeMinutes ?? 0. Suite green (849 tests), useGenerateRound.ts at 100% Stryker. Did NOT add CountdownState.phase (deferred to 08-03).
- [08-03]: useCountdown derives 3 phases (main/overtime/countup) from expires_at + overtime_seconds + Date.now() via single-signed-value model (overtimeRemaining = mainRemaining + overtime_seconds). Added CountdownState.phase as source of truth; kept 4-value urgency union (overtime→danger, countup→expired) per locked Q1. Dropped dead `?? 0` (overtime_seconds is NOT NULL) and narrowed computeUrgency to positive-only for 100% coverage; one equivalent mutant inline-disabled. 100% Stryker (60 killed), 865 tests green. useTimerNotification factories got a phase field (ripple); the notification hook itself is plan 08-04.
- [09-01]: Migration 00006 applied to live DB — additive `'pending'` status (CHECK widened), `generate_round` inserts `pending` for 80+20 / `running` for plain (cancel sweep widened to pending), new passphrase-gated `start_timer` RPC (pending→running, sets started_at + real expires_at), `cancel_timer` widened to cancel pending. pause/resume/extend untouched. SQL behaviors human-verified (Task 3 APPROVED). TIMER-02/TIMER-07 server foundation only — full requirements delivered by 09-02/03/04.
- [09-02]: Client data layer surfaces the 00006 `pending` contract. RoundTimer.status widened to include `'pending'`; useTimer filter `.in('status', ['running','paused','pending'])`. useCountdown gets a static `not-started` early-return (display from duration_minutes, NO setInterval) placed AFTER the cancelled guard and BEFORE derivePhase, keeping the three-phase engine untouched and 100%-Stryker. New `useStartTimer` hook is a verbatim-shape mirror of useResumeTimer (rpc `start_timer`). Both useCountdown.ts (66 killed) and useStartTimer.ts (18 killed) at 100% Stryker; suite green (880 tests). UI wiring is 09-03.
- [Phase 08]: [08-04]: useTimerNotification fires one notification per phase boundary (main->overtime 'Overtime started', overtime->countup 'Round over'), deduped via Set keyed ${timer.id}:boundary; prevPhaseRef null-baseline + per-timer reset makes refresh/switch-into-phase fire nothing. Consolidated timer-reset into the trigger effect (prevTimerIdRef) to avoid an effect-ordering bug. 100% Stryker (46 killed), 870 tests green. TIMER-05 done; phase 08 fully delivered.
- [09-03]: Timer UI shipped to the verified 09-UI-SPEC. TimerDisplay selects band by phase first (phaseBands const for not-started/overtime/countup) and falls back to urgencyStyles only for main (no regression to plain 60/90/120); labels ROUND TIMER/OVERTIME/OVERRUN/READY TO START/PAUSED; added data-phase + opacity-70 pause dim. TimerControls pending branch renders accent timer-start-btn (useStartTimer) + timer-cancel-btn (locked Cancel-on-pending); running/paused branch untouched. AdminControls replaced selectedDuration:number with a PRESETS object model ({id,label,duration,overtime}), added timer-duration-80-20 chip, and finally threaded overtimeMinutes into generateRound.mutate (80+20 → p_overtime_minutes=20; plain → 0). TimerDisplay + TimerControls at 100% Stryker; AdminControls 91% (8 pre-existing End Event survivors, untouched). Suite green (900 tests). UI half of TIMER-01/04/07 done; E2E + 100% gate is 09-04.

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

Last session: 2026-06-29T00:00:00.000Z
Stopped at: Completed 09-03-PLAN.md — timer UI (TimerDisplay phase bands, TimerControls pending Start/Cancel, AdminControls 80+20 preset)
Resume file: None (next: 09-04-PLAN.md E2E + Stryker 100% gate)
