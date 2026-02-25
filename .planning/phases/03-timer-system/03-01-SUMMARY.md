---
phase: 03-timer-system
plan: 01
subsystem: database
tags: [supabase, postgres, react-query, realtime, timer, rpc]

# Dependency graph
requires:
  - phase: 02-pod-generation-and-admin-controls
    provides: "rounds/pods/pod_players tables, generate_round RPC, passphrase-gated RPC pattern, useEventChannel Realtime"
provides:
  - "round_timers table with server-authoritative timestamps"
  - "4 passphrase-gated timer RPCs (pause, resume, extend, cancel)"
  - "generate_round RPC extended with optional timer duration"
  - "RoundTimer TypeScript type"
  - "useTimer query hook for active timer state"
  - "4 timer mutation hooks (usePauseTimer, useResumeTimer, useExtendTimer, useCancelTimer)"
  - "round_timers Realtime listener in useEventChannel"
affects: [03-02-PLAN, 03-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["server-authoritative timer via expires_at + remaining_seconds on pause", "denormalized event_id for Realtime filtering"]

key-files:
  created:
    - supabase/migrations/00004_timer_system.sql
    - src/hooks/useTimer.ts
    - src/hooks/usePauseTimer.ts
    - src/hooks/useResumeTimer.ts
    - src/hooks/useExtendTimer.ts
    - src/hooks/useCancelTimer.ts
  modified:
    - src/types/database.ts
    - src/hooks/useGenerateRound.ts
    - src/hooks/useEventChannel.ts
    - src/hooks/useEventChannel.test.ts

key-decisions:
  - "Server-authoritative timer: clients compute remaining = expires_at - now(), no drift between clients"
  - "Denormalized event_id on round_timers for efficient Realtime filtering (avoids join through rounds)"
  - "GREATEST(0, ...) on pause to prevent negative remaining_seconds"
  - "extend_timer works on both running (updates expires_at) and paused (updates remaining_seconds) timers"

patterns-established:
  - "Timer mutation hooks follow same passphrase-gated pattern as useEndEvent/useRemovePlayer"
  - "Timer query uses maybeSingle() with status filter for active timer"

requirements-completed: [TIMR-01, TIMR-03, TIMR-04]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 03 Plan 01: Timer Data Layer Summary

**Server-authoritative round_timers table with pause/resume/extend/cancel RPCs, RoundTimer type, 5 React Query hooks, and Realtime channel integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T18:09:33Z
- **Completed:** 2026-02-25T18:11:59Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created round_timers table with server-authoritative timer design (expires_at as source of truth, remaining_seconds for pause state)
- Added 4 passphrase-gated timer RPCs (pause, resume, extend, cancel) following established security patterns
- Extended generate_round to optionally create a timer when generating a new round
- Created 5 new React Query hooks (1 query + 4 mutations) ready for UI consumption
- Integrated round_timers into Realtime channel for live timer updates across all clients

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration for round_timers table and timer RPC functions** - `49d6272` (feat)
2. **Task 2: Add TypeScript types, timer hooks, update generate round hook and Realtime channel** - `398ab25` (feat)

## Files Created/Modified
- `supabase/migrations/00004_timer_system.sql` - Timer table, RLS, Realtime publication, modified generate_round, 4 timer RPCs
- `src/types/database.ts` - Added RoundTimer type export
- `src/hooks/useTimer.ts` - Query hook fetching active timer by event_id
- `src/hooks/usePauseTimer.ts` - Mutation hook calling pause_timer RPC
- `src/hooks/useResumeTimer.ts` - Mutation hook calling resume_timer RPC
- `src/hooks/useExtendTimer.ts` - Mutation hook calling extend_timer RPC (+5 minutes)
- `src/hooks/useCancelTimer.ts` - Mutation hook calling cancel_timer RPC
- `src/hooks/useGenerateRound.ts` - Added timerDurationMinutes parameter and timer query invalidation
- `src/hooks/useEventChannel.ts` - Added round_timers Realtime listener with event_id filter
- `src/hooks/useEventChannel.test.ts` - Added 2 tests for timer Realtime callback (319 total pass)

## Decisions Made
- Server-authoritative timer design: clients compute `remaining = expires_at - now()` for zero drift
- Denormalized event_id on round_timers for efficient Realtime filtering without joining through rounds
- Used GREATEST(0, ...) when computing remaining_seconds on pause to prevent negative values
- extend_timer handles both running (update expires_at) and paused (update remaining_seconds) states

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timer data layer is complete and ready for UI consumption in Plans 03-02 (TimerDisplay, TimerControls) and 03-03 (browser notifications)
- All 319 Vitest tests pass with zero regressions
- Hooks follow established patterns and are ready for component integration

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (49d6272, 398ab25) verified in git log.

---
*Phase: 03-timer-system*
*Completed: 2026-02-25*
