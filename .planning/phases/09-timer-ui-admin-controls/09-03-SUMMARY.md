---
phase: 09-timer-ui-admin-controls
plan: 03
subsystem: ui
tags: [react, tailwind, vitest, stryker, timer, lucide-react]

# Dependency graph
requires:
  - phase: 09-02
    provides: "RoundTimer 'pending' status, useCountdown phase incl. 'not-started', useStartTimer hook"
  - phase: 09-01
    provides: "Migration 00006 — pending status, start_timer RPC, cancel_timer accepts pending"
provides:
  - "TimerDisplay: phase-first band/label selection + not-started READY TO START card + data-phase attr"
  - "TimerControls: pending branch rendering accent Start Timer + Cancel via useStartTimer"
  - "AdminControls: PRESETS object model with 80+20 chip + threaded overtimeMinutes into generate_round"
affects: [09-04, timer-e2e, timer-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-first presentation: select band by countdown.phase, fall back to urgencyStyles only for main"
    - "Preset-object model (id/label/duration/overtime) replaces a bare numeric duration state"
    - "Pending control branch reuses the established passphrase guard + handlePassphraseRejection"

key-files:
  created: []
  modified:
    - src/components/TimerDisplay.tsx
    - src/components/TimerDisplay.test.tsx
    - src/components/TimerControls.tsx
    - src/components/TimerControls.test.tsx
    - src/components/AdminControls.tsx
    - src/components/AdminControls.test.tsx

key-decisions:
  - "TimerDisplay keys the band off phase first; main keeps the existing urgencyStyles progression (no regression for plain 60/90/120 timers)"
  - "Pending TimerControls branch renders BOTH Start Timer and Cancel (locked Cancel-on-not-started decision); pause/resume/+5 hidden"
  - "AdminControls PRESETS carry per-preset overtime so 80+20 threads overtimeMinutes=20 and plain presets send 0"

patterns-established:
  - "Pattern: phaseBands const for non-main phases + dimmed opacity-70 on pause, appended to className"
  - "Pattern: preset-object picker mapping with data-testid=timer-duration-${id} preserving 60/90/120 testids"

requirements-completed: [TIMER-01, TIMER-04, TIMER-07]

# Metrics
duration: ~30min
completed: 2026-06-29
---

# Phase 9 Plan 3: Timer UI & Admin Controls Summary

**Phase-distinct TimerDisplay (ROUND TIMER / OVERTIME / OVERRUN / READY TO START bands with data-phase), a pending-timer Start+Cancel branch in TimerControls, and an 80+20 AdminControls preset that finally threads overtimeMinutes into generate_round.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-28T15:02:28Z
- **Completed:** 2026-06-29
- **Tasks:** 3 (all TDD)
- **Files modified:** 6

## Accomplishments
- TimerDisplay selects its band by `countdown.phase` first — `main` retains the `urgencyStyles` normal/warning/danger progression (no regression), while `overtime` (flat amber), `countup` (red-pulse), and `not-started` (neutral) get distinct flat bands; added `data-phase` and `opacity-70` dim on pause.
- TimerControls gained a `pending` branch rendering the accent **Start Timer** button (via `useStartTimer`) plus **Cancel** + ConfirmDialog; running/paused/+5/cancel branch left untouched.
- AdminControls replaced the bare `selectedDuration` with a `PRESETS` object model, added the `timer-duration-80-20` chip, and threaded `overtimeMinutes` into `generateRound.mutate` (closing the dropped-overtime gap so 80+20 sends `p_overtime_minutes=20`).
- All three components reached **100% Stryker mutation score** on the touched files; full Vitest suite green (898 → 900 tests after test additions).

## Task Commits

Each task was committed atomically (TDD: tests + implementation per task):

1. **Task 1: TimerDisplay phase bands + not-started card + data-phase** - `86f6cdf` (feat)
2. **Task 2: TimerControls pending Start + Cancel branch** - `4de6df0` (feat)
3. **Task 3: AdminControls 80+20 preset model + threaded overtimeMinutes** - `90aba69` (feat)
4. **Mutation-kill test strengthening (TimerDisplay/TimerControls 100%)** - `672128c` (test)

## Files Created/Modified
- `src/components/TimerDisplay.tsx` - phaseBands map, phase-first band/label selection, data-phase attr, opacity-70 dim
- `src/components/TimerDisplay.test.tsx` - 8 phase-band cases + dimmed-fallback mutation kill
- `src/components/TimerControls.tsx` - useStartTimer wiring, handleStart, pending Start+Cancel branch
- `src/components/TimerControls.test.tsx` - useStartTimer mock + 6 pending-branch cases
- `src/components/AdminControls.tsx` - PRESETS object model, 80+20 chip, threaded overtimeMinutes
- `src/components/AdminControls.test.tsx` - 80+20 render/select/threading cases

## Decisions Made
- None beyond the plan — labels, tokens, and testids implemented verbatim from 09-UI-SPEC; the locked Cancel-on-pending and main-urgency-preservation decisions were followed as written.

## Deviations from Plan

None — plan executed exactly as written. The only beyond-the-checklist work was two test-quality additions to drive TimerDisplay and TimerControls from ~96% to 100% Stryker, in line with the project CLAUDE.md mutation-testing rule.

## Issues Encountered
- Initial Stryker runs surfaced two surviving mutants in the new code: TimerDisplay's `dimmed` empty-string fallback and TimerControls' pending-dialog `onCancel` dismiss path. Both were killed by adding a className-equality assertion and a pending dialog-dismiss test respectively; re-run confirmed 100% on both files. AdminControls' 8 survivors are pre-existing End Event button logic (out of scope, untouched by this plan) and the file still scores 91% (above the 80% break threshold).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI half of TIMER-01/04/07 shipped with the exact `data-phase`, `timer-status` labels, `timer-start-btn`, and `timer-duration-80-20` hooks that Plan 09-04's Cypress E2E (timer-80-20.cy.js) and the `timer.cy.js` `ROUND TIMER` label update depend on.
- No blockers. 09-04 can proceed with E2E + the 100% Stryker gate.

## Self-Check: PASSED

---
*Phase: 09-timer-ui-admin-controls*
*Completed: 2026-06-29*
