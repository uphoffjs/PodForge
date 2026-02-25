---
phase: 02-pod-generation-and-admin-controls
plan: 01
subsystem: database
tags: [supabase, postgres, rpc, rls, react-query, realtime, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: events and players tables, initial schema, Supabase client, React Query setup
provides:
  - rounds, pods, pod_players database tables with RLS and Realtime
  - generate_round, remove_player, reactivate_player, end_event RPC functions
  - Round, Pod, PodPlayer TypeScript types
  - useRounds, useCurrentRound, usePods query hooks
  - useGenerateRound, useRemovePlayer, useReactivatePlayer, useEndEvent mutation hooks
  - Realtime channel listeners for rounds, pods, pod_players tables
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [passphrase-gated SECURITY DEFINER RPCs, JSONB pod assignment parameter, broad query invalidation for nested entities]

key-files:
  created:
    - supabase/migrations/00002_rounds_pods_admin.sql
    - src/hooks/useRounds.ts
    - src/hooks/useCurrentRound.ts
    - src/hooks/usePods.ts
    - src/hooks/useGenerateRound.ts
    - src/hooks/useRemovePlayer.ts
    - src/hooks/useReactivatePlayer.ts
    - src/hooks/useEndEvent.ts
  modified:
    - src/types/database.ts
    - src/hooks/useEventChannel.ts
    - src/hooks/useEventChannel.test.ts

key-decisions:
  - "All admin RPCs validate passphrase inline (crypt comparison with RAISE EXCEPTION) rather than calling validate_passphrase function"
  - "generate_round accepts pre-computed JSONB pod assignments from the client, keeping algorithm logic client-side"
  - "Updated players RLS policy to allow status changes to both 'active' and 'dropped' (was 'dropped' only)"

patterns-established:
  - "Admin mutation hooks accept { passphrase, ...params } and pass passphrase to RPC"
  - "Error handling: check error.message for 'passphrase'/'invalid' to show passphrase-specific toast"
  - "Realtime: pods/pod_players use broad invalidation (queryKey: ['pods']) since data is round-scoped"

requirements-completed: [PODG-01, PODG-06, PLYR-03, PLYR-04, EVNT-04]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 02 Plan 01: Data Foundation Summary

**Rounds/pods/pod_players schema with passphrase-gated admin RPCs, 7 React Query hooks, and Realtime channel listeners**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T18:35:28Z
- **Completed:** 2026-02-24T18:38:15Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Database migration with rounds, pods, pod_players tables including FK relationships, RLS policies, and Realtime publication
- Four SECURITY DEFINER RPC functions (generate_round, remove_player, reactivate_player, end_event) all validating passphrase server-side
- Seven new React Query hooks following established project patterns (3 queries + 4 mutations)
- Updated Realtime channel with listeners for rounds, pods, and pod_players tables
- All 277 tests pass (including 4 new useEventChannel tests), TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration for rounds, pods, pod_players tables and admin RPC functions** - `3de73a4` (feat)
2. **Task 2: Add TypeScript types, React Query hooks, and update Realtime channel** - `0ad8c46` (feat)

## Files Created/Modified
- `supabase/migrations/00002_rounds_pods_admin.sql` - Database schema for rounds, pods, pod_players; RLS; Realtime; 4 admin RPC functions
- `src/types/database.ts` - Added Round, Pod, PodPlayer type definitions
- `src/hooks/useRounds.ts` - Query hook for fetching all rounds (descending order)
- `src/hooks/useCurrentRound.ts` - Query hook for latest round (maybeSingle)
- `src/hooks/usePods.ts` - Query hook for pods with nested pod_players and players
- `src/hooks/useGenerateRound.ts` - Mutation hook calling generate_round RPC with JSONB pod assignments
- `src/hooks/useRemovePlayer.ts` - Mutation hook calling remove_player RPC
- `src/hooks/useReactivatePlayer.ts` - Mutation hook calling reactivate_player RPC
- `src/hooks/useEndEvent.ts` - Mutation hook calling end_event RPC
- `src/hooks/useEventChannel.ts` - Added rounds/pods/pod_players Realtime listeners
- `src/hooks/useEventChannel.test.ts` - Updated for 5 listeners + 4 new tests for rounds/pods/pod_players callbacks

## Decisions Made
- All admin RPCs validate passphrase inline using crypt() comparison with RAISE EXCEPTION on mismatch, matching the existing pattern but not calling the validate_passphrase helper (to avoid an extra query per call)
- generate_round accepts pre-computed JSONB pod assignments, keeping the pod algorithm on the client side for Plans 02-03 to implement
- Updated the players RLS policy to allow status changes to both 'active' and 'dropped' (was 'dropped' only), enabling admin reactivation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated useEventChannel test for new listener count**
- **Found during:** Task 2 (updating useEventChannel.ts)
- **Issue:** Existing test expected 2 `.on()` calls but now there are 5 (3 new listeners added)
- **Fix:** Updated `toHaveBeenCalledTimes(2)` to `toHaveBeenCalledTimes(5)`, added assertions for rounds/pods/pod_players listeners, added 4 new tests for callback invalidation behavior
- **Files modified:** src/hooks/useEventChannel.test.ts
- **Verification:** All 277 tests pass
- **Committed in:** 0ad8c46 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test update was necessary consequence of adding new Realtime listeners. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The migration will be applied when `supabase db push` or `supabase db reset` is run.

## Next Phase Readiness
- All database tables, types, and hooks are in place for Plans 02-04
- Plan 02 (pod assignment algorithm) can use the PodAssignment type and useGenerateRound hook
- Plan 03 (admin controls UI) can use useRemovePlayer, useReactivatePlayer, useEndEvent hooks
- Plan 04 (round display UI) can use useRounds, useCurrentRound, usePods hooks
- Realtime delivery is configured for all new tables

## Self-Check: PASSED

All 11 files verified present. Both task commits (3de73a4, 0ad8c46) verified in git history.

---
*Phase: 02-pod-generation-and-admin-controls*
*Completed: 2026-02-24*
