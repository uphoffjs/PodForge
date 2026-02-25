---
phase: 03-timer-system
plan: 02
subsystem: ui
tags: [react, hooks, countdown, timer-display, admin-controls, tailwindcss]

# Dependency graph
requires:
  - phase: 03-timer-system
    plan: 01
    provides: "RoundTimer type, useTimer query hook, 4 timer mutation hooks, Realtime channel"
provides:
  - "useCountdown hook: pure countdown calculation from server timestamps"
  - "TimerDisplay component: sticky countdown with urgency color transitions and overtime"
  - "TimerControls component: admin pause/resume/extend/cancel buttons"
  - "AdminControls duration picker: 60/90/120 min presets in generate round flow"
  - "EventPage timer integration: TimerDisplay + TimerControls above current round"
affects: [03-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["client-side countdown via setInterval computing expires_at - now()", "urgency-based styling with Tailwind conditional classes", "animate-pulse for expired timer flashing"]

key-files:
  created:
    - src/hooks/useCountdown.ts
    - src/hooks/useCountdown.test.ts
    - src/components/TimerDisplay.tsx
    - src/components/TimerControls.tsx
  modified:
    - src/components/AdminControls.tsx
    - src/pages/EventPage.tsx
    - src/pages/EventPage.test.tsx

key-decisions:
  - "useCountdown computes remaining from expires_at - Date.now() each tick, not from an initial value minus elapsed; ensures no client-side drift"
  - "TimerDisplay is a presentational component; TimerControls is a separate admin-only component; EventPage wires both together"
  - "Duration picker toggles on re-click (deselect) since timer is optional per TIMR-01"
  - "TimerControls only renders when admin has passphrase (avoids passphrase prompt on every button click)"

patterns-established:
  - "Urgency thresholds: normal (>10min), warning (5-10min), danger (0-5min), expired (<=0)"
  - "Overtime display format: +m:ss counting up from zero"
  - "Timer section in EventPage layout: between join form and current round display"

requirements-completed: [TIMR-01, TIMR-02, TIMR-04, TIMR-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 03 Plan 02: Timer Display & Controls Summary

**Sticky countdown display with urgency color transitions (yellow/red/flash), overtime counting, admin pause/resume/extend/cancel controls, and 60/90/120-min duration picker in generate round flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T18:14:45Z
- **Completed:** 2026-02-25T18:17:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created useCountdown hook with 15 unit tests covering countdown calculation, urgency levels, overtime formatting, pause/running behavior
- Built TimerDisplay component with sticky positioning, urgency color transitions (normal/warning/danger/expired+flash), and overtime "+" prefix counting
- Built TimerControls component with admin pause/resume/+5min/cancel buttons and ConfirmDialog for cancel confirmation
- Added 60/90/120 min duration picker to AdminControls, integrated into generate round mutation
- Integrated TimerDisplay and TimerControls into EventPage layout above current round display

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useCountdown hook with tests and TimerDisplay component** - `fd3e2a0` (feat)
2. **Task 2: Create TimerControls, modify AdminControls with duration picker, integrate into EventPage** - `31e65a2` (feat)

## Files Created/Modified
- `src/hooks/useCountdown.ts` - Pure countdown calculation hook: computes remainingSeconds, display string, urgency, overtime from RoundTimer
- `src/hooks/useCountdown.test.ts` - 15 unit tests for countdown logic (null, cancelled, running, paused, urgency thresholds, formatting, interval tick)
- `src/components/TimerDisplay.tsx` - Sticky timer display with urgency-based Tailwind classes and animate-pulse at expiry
- `src/components/TimerControls.tsx` - Admin timer controls: Pause/Resume, +5 min, Cancel with ConfirmDialog
- `src/components/AdminControls.tsx` - Added selectedDuration state, 60/90/120 min picker buttons, passes timerDurationMinutes to generateRound
- `src/pages/EventPage.tsx` - Added useTimer hook, TimerDisplay + TimerControls rendering above current round
- `src/pages/EventPage.test.tsx` - Added useTimer, TimerDisplay, TimerControls mocks; 334 total tests pass

## Decisions Made
- useCountdown recomputes from `expires_at - Date.now()` every tick rather than decrementing a local counter, ensuring all clients stay synchronized with server timestamps
- TimerDisplay and TimerControls are separate components (presentation vs. control) wired together by EventPage for separation of concerns
- Duration picker uses toggle behavior (click selected to deselect) since timer duration is optional per TIMR-01
- TimerControls only renders when admin has passphrase already authenticated, avoiding passphrase prompts on every control button

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timer display and controls are fully functional and ready for Plan 03-03 (browser notifications)
- All 334 Vitest tests pass with zero regressions
- Timer UI components follow established patterns and are ready for E2E testing

## Self-Check: PASSED

All 4 created files and 3 modified files verified below.
