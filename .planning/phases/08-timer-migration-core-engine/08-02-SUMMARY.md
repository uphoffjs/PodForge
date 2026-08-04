---
phase: 08-timer-migration-core-engine
plan: 02
subsystem: database
tags: [typescript, supabase, rpc, vitest, stryker, timer]

# Dependency graph
requires:
  - phase: 08-timer-migration-core-engine (plan 01)
    provides: migration 00005 — overtime_seconds column, generate_round p_overtime_minutes param, signed pause_timer
provides:
  - RoundTimer type carries required overtime_seconds field (SIGNED remaining_seconds)
  - Repo-wide RoundTimer factory/literal compatibility (suite stays green)
  - useGenerateRound forwards overtimeMinutes as p_overtime_minutes (0 default)
affects: [08-03 useCountdown three-phase derivation, 08-04 useTimerNotification dual-boundary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first data contract: extend the shared type, fix all consumers in one task to keep the cross-wave suite green"
    - "Mirror existing optional-param RPC threading (p_timer_duration_minutes) for new RPC args"

key-files:
  created: []
  modified:
    - src/types/database.ts
    - src/hooks/useGenerateRound.ts
    - src/hooks/useGenerateRound.test.ts
    - src/hooks/useCountdown.test.ts
    - src/hooks/useTimerNotification.test.ts
    - src/components/TimerDisplay.test.tsx
    - src/components/TimerControls.test.tsx
    - src/hooks/useTimer.test.ts
    - src/pages/EventPage.test.tsx

key-decisions:
  - "overtime_seconds is REQUIRED (non-nullable) on RoundTimer — forces every factory/literal to declare it, catching missed consumers at compile time"
  - "No phase field added to CountdownState factories (deferred to plan 08-03)"

patterns-established:
  - "Required-field type extension as a compile-time consumer audit"
  - "p_overtime_minutes: overtimeMinutes ?? 0 mirrors p_timer_duration_minutes ?? null threading"

requirements-completed: [TIMER-03]

# Metrics
duration: 18min
completed: 2026-06-27
---

# Phase 8 Plan 02: RoundTimer overtime_seconds Contract Summary

**Added required `overtime_seconds` to the `RoundTimer` type and threaded `overtimeMinutes` (as `p_overtime_minutes`, 0 default) through `useGenerateRound`, keeping the full 849-test suite green and `useGenerateRound.ts` at 100% Stryker.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-27
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `RoundTimer.overtime_seconds: number` is now a required field; `remaining_seconds` documented as SIGNED (negative = overtime/count-up). Downstream plans 03/04 consume this.
- Every RoundTimer factory/literal across 6 test files updated with `overtime_seconds: 0`; `npx tsc --noEmit` clean (proves no consumer was missed).
- `useGenerateRound` forwards `p_overtime_minutes: overtimeMinutes ?? 0` to the `generate_round` RPC, mirroring the existing `p_timer_duration_minutes` threading.
- `useGenerateRound.ts` holds a 100% Stryker mutation score (46 killed, 0 survived) after the new param threading.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add overtime_seconds to RoundTimer + fix all factories** - `d7d3552` (feat)
2. **Task 2: Thread overtimeMinutes through useGenerateRound (TDD)** - `097b26b` (test, RED) → `585d2bc` (feat, GREEN)
3. **Task 3: Stryker hardening to 100% on useGenerateRound.ts** - no code commit (verification-only; the TDD assertions added in Task 2 already kill every mutant on the new threading)

_Task 3 produced no diff: the new `toHaveBeenCalledWith` assertions from Task 2 (asserting literal `p_overtime_minutes: 20` and `p_overtime_minutes: 0`) already kill the arg-drop and `?? 0` default-removed mutants._

## Files Created/Modified
- `src/types/database.ts` - Added required `overtime_seconds: number`; marked `remaining_seconds` SIGNED
- `src/hooks/useGenerateRound.ts` - Added `overtimeMinutes?: number` param; forwards `p_overtime_minutes: overtimeMinutes ?? 0`
- `src/hooks/useGenerateRound.test.ts` - Two new assertion tests + updated existing rpc-arg assertions to include `p_overtime_minutes`
- `src/hooks/useCountdown.test.ts` - `makeTimer` factory default `overtime_seconds: 0`
- `src/hooks/useTimerNotification.test.ts` - `makeTimer` factory default `overtime_seconds: 0`
- `src/components/TimerDisplay.test.tsx` - factory default `overtime_seconds: 0`
- `src/components/TimerControls.test.tsx` - factory default `overtime_seconds: 0`
- `src/hooks/useTimer.test.ts` - timer literal `overtime_seconds: 0`
- `src/pages/EventPage.test.tsx` - 4 timer mock literals `overtime_seconds: 0`

## Decisions Made
- Made `overtime_seconds` required rather than optional so TypeScript flags every consumer — the compile error surface is the audit that no factory was missed across waves.
- Did NOT add a `phase` field to any CountdownState factory; `phase` does not exist until plan 08-03.

## Deviations from Plan

None - plan executed exactly as written.

The only nuance worth recording: the Task 3 `<verify>` command (`grep -Eq "100.00%|100%"`) does not match the installed Stryker's output format, which prints `100.00` without a trailing `%` (e.g. `Final mutation score of 100.00 is greater than or equal to break threshold 80` and the `useGenerateRound.ts | 100.00 | 100.00` table row). The mutation score is genuinely 100% (46 killed / 0 survived / 0 no-coverage); the grep pattern in the plan is simply over-specific for this Stryker version. Acceptance criterion ("Stryker reports 100%") is met. This is a test-of-the-test format quirk, not a code or coverage gap, so no source change was required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `RoundTimer.overtime_seconds` and signed `remaining_seconds` are in place for plan 08-03 (`useCountdown` three-phase derivation) and 08-04 (`useTimerNotification` dual-boundary dedup).
- Full suite green (50 files / 849 tests), `tsc --noEmit` clean, `useGenerateRound.ts` at 100% Stryker.

---
*Phase: 08-timer-migration-core-engine*
*Completed: 2026-06-27*

## Self-Check: PASSED
- Files verified present: src/types/database.ts, src/hooks/useGenerateRound.ts, 08-02-SUMMARY.md
- Commits verified: d7d3552 (Task 1), 097b26b (Task 2 RED), 585d2bc (Task 2 GREEN)
- Contract verified: overtime_seconds in database.ts; `p_overtime_minutes: overtimeMinutes ?? 0` in useGenerateRound.ts
