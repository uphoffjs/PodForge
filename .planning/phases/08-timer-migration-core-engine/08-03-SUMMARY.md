---
phase: 08-timer-migration-core-engine
plan: 03
subsystem: timer
tags: [react, hooks, useCountdown, vitest, stryker, 80+20-timer, phase-derivation]

# Dependency graph
requires:
  - phase: 08-02
    provides: "RoundTimer.overtime_seconds (required, NOT NULL) + signed remaining_seconds contract"
provides:
  - "useCountdown three-phase derivation (main/overtime/countup) from expires_at + overtime_seconds + Date.now()"
  - "CountdownState.phase field as the new source of truth for Phase 9 styling"
  - "100% Stryker mutation score on src/hooks/useCountdown.ts"
affects: [09-timer-ui-and-admin-controls, useTimerNotification, TimerDisplay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-signed-value three-phase model: overtimeRemaining = mainRemaining + overtime_seconds"
    - "Phase-to-urgency mapping keeps the existing 4-value union (phase is the new source of truth)"

key-files:
  created: []
  modified:
    - src/hooks/useCountdown.ts
    - src/hooks/useCountdown.test.ts
    - src/hooks/useTimerNotification.test.ts

key-decisions:
  - "Dropped the `?? 0` default on overtime_seconds: the field is NOT NULL per the RoundTimer type, so the nullish branch was unreachable dead code blocking 100% coverage/mutation"
  - "Narrowed computeUrgency to its real contract (positive inputs only) since it is now called only for the main phase; overtime→'danger' / countup→'expired' are mapped in phaseUrgency"
  - "Marked the effect-level cancelled guard as an equivalent mutant via inline Stryker disable (render guard + no-tick-for-non-running make it observationally inert) — no file exclusion"

patterns-established:
  - "derivePhase(mainRemaining, overtimeSeconds): pure phase + displaySeconds derivation"
  - "phaseUrgency(phase, mainRemaining): phase→4-value urgency mapping without widening the union"

requirements-completed: [TIMER-03, TIMER-06]

# Metrics
duration: 32min
completed: 2026-06-27
---

# Phase 8 Plan 03: useCountdown Three-Phase Derivation Summary

**Client-side three-phase (80+20) timer engine: `useCountdown` derives main → overtime → count-up purely from `expires_at` + `overtime_seconds` + `Date.now()`, adds a `phase` field, and hits 100% Stryker.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-06-27T18:17:00Z
- **Completed:** 2026-06-27T18:49:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `useCountdown` now derives all three phases from two server quantities plus the local clock, collapsing the model to `overtimeRemaining = mainRemaining + overtime_seconds`.
- Added `phase: 'main' | 'overtime' | 'countup'` to `CountdownState` as the new source of truth (Plan 08-04/Phase 9 consumes it) while keeping `remainingSeconds`, `isOvertime`, and the 4-value `urgency` union backward compatible.
- Paused timers with signed `remaining_seconds` derive the correct phase (TIMER-06 client half); `overtime_seconds = 0` reproduces today's single-phase down→count-up behavior identically.
- 100% line/branch/function coverage AND 100% Stryker mutation score (60 killed, 0 survived) on `useCountdown.ts`; full suite green at 865 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive three phases + add phase field (TDD)** - `4e081d4` (feat)
2. **Task 2: Stryker mutation hardening to 100%** - `850910f` (test)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `src/hooks/useCountdown.ts` - Added `phase` to `CountdownState`; new `derivePhase` and `phaseUrgency` helpers; narrowed `computeUrgency`; feeds phase-appropriate `displaySeconds` into the unchanged `formatDisplay`.
- `src/hooks/useCountdown.test.ts` - Boundary (`> 0` at 0/1), arithmetic (+ vs −, the 15:00 case), paused-signed, per-tick crossing, backward-compat, and mutation-killing (interval guard, isPaused/isCancelled) tests.
- `src/hooks/useTimerNotification.test.ts` - Added `phase` to the `makeCountdown`/`makeExpiredCountdown` factories (required-field ripple from the new `CountdownState` shape).

## Decisions Made
- **Dropped `?? 0` on `overtime_seconds`.** Plan 08-02 made `overtime_seconds: number` a required NOT-NULL field, so the nullish default was unreachable dead code that prevented 100% coverage and left an unkillable Stryker mutant. The documented `overtime_seconds=0` backward-compat path uses a real `0` and is unaffected.
- **Narrowed `computeUrgency`** to handle only positive inputs. It is now called solely for the main phase (`mainRemaining > 0`), making the old `<= 0 → 'expired'` branch dead; overtime→`'danger'` and countup→`'expired'` are mapped explicitly in `phaseUrgency` per the locked Q1 decision (keep the 4-value union; Phase 9 owns distinct styling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `phase` to useTimerNotification test factories**
- **Found during:** Task 2 (Stryker dry-run compilation)
- **Issue:** Adding the required `phase` field to `CountdownState` broke Stryker's stricter TypeScript checker — `makeCountdown`/`makeExpiredCountdown` produced an optional `phase` not assignable to the required field, failing the dry run (and thus all mutation testing). `tsc --noEmit` tolerated it via the `Partial` spread, but Stryker did not.
- **Fix:** Added `phase: 'main'` to `makeCountdown` and `phase: 'countup'` to `makeExpiredCountdown` (anticipated by 08-PATTERNS.md).
- **Files modified:** src/hooks/useTimerNotification.test.ts
- **Verification:** `npx vitest run src/hooks/useTimerNotification.test.ts` (22 passed); Stryker dry run then succeeded.
- **Committed in:** 850910f (Task 2 commit)

**2. [Rule 1 - Cleanup] Removed unreachable urgency/default branches to enable 100% coverage**
- **Found during:** Task 1 (coverage gate) and Task 2 (Stryker)
- **Issue:** `computeUrgency`'s `<= 0` path and the `overtime_seconds ?? 0` default became unreachable dead code under the new phase model, blocking the 100% coverage/mutation requirement.
- **Fix:** Narrowed `computeUrgency` to positive-only; dropped `?? 0` (field is non-nullable).
- **Files modified:** src/hooks/useCountdown.ts
- **Verification:** useCountdown.ts at 100% statements/branches/functions/lines and 100% Stryker.
- **Committed in:** 4e081d4 (Task 1) and 850910f (Task 2)

**3. [Rule 1 - Equivalent mutant] Inline Stryker disable on the effect-level cancelled guard**
- **Found during:** Task 2 (Stryker survivors)
- **Issue:** The `=== 'cancelled'` check inside the effect produced an equivalent mutant — the render guard returns null for cancelled timers regardless, and cancelled timers never tick, so the branch has no observable effect and cannot be killed by any test.
- **Fix:** Added a justified `// Stryker disable next-line ConditionalExpression` comment (NOT a file exclusion; no `mutate` glob change).
- **Files modified:** src/hooks/useCountdown.ts
- **Verification:** Stryker reports 100% with 0 survived.
- **Committed in:** 850910f (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 cleanup/equivalent-mutant)
**Impact on plan:** All necessary to satisfy the plan's explicit 100% coverage + 100% Stryker success criteria, which the literal plan code (`?? 0`, full `computeUrgency`) made unreachable. No behavior change to shipped timer logic; no scope creep.

## Issues Encountered
- Stryker's TypeScript checker is stricter than `tsc --noEmit` (the `Partial` spread suppression does not apply), surfacing a compile error the standard typecheck missed. Resolved by populating the test factories explicitly (Deviation 1).

## User Setup Required
None - no external service configuration required (zero package installs; pure first-party source edits).

## Next Phase Readiness
- `CountdownState.phase` is live and exercised — ready for Plan 08-04 (useTimerNotification dual-boundary dedup) and Phase 9 phase-distinct `TimerDisplay` styling.
- Note for 08-04: the `useTimerNotification` factories now carry a `phase` field; the notification hook itself still uses the pre-phase trigger and is the subject of its own plan.

## Self-Check: PASSED

- FOUND: src/hooks/useCountdown.ts
- FOUND: .planning/phases/08-timer-migration-core-engine/08-03-SUMMARY.md
- FOUND: commit 4e081d4 (Task 1)
- FOUND: commit 850910f (Task 2)

---
*Phase: 08-timer-migration-core-engine*
*Completed: 2026-06-27*
