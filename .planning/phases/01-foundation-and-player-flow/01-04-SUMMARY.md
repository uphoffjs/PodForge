---
phase: 01-foundation-and-player-flow
plan: 04
subsystem: ui
tags: [supabase-realtime, react-query, postgres-changes, page-visibility-api, self-drop, confirmation-dialog]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Supabase client with worker mode, React Query client, player-identity utility, app.css flash animation"
  - phase: 01-03
    provides: "EventPage with player list, useEvent/useEventPlayers hooks, PlayerList/PlayerItem components"
provides:
  - "Supabase Realtime subscription for live player/event updates (useEventChannel)"
  - "Page Visibility API refetch on tab restore (useVisibilityRefetch)"
  - "Self-drop mutation via RPC with localStorage cleanup (useDropPlayer)"
  - "Reusable confirmation dialog component (ConfirmDialog)"
  - "New player join highlight animation"
affects: [01-05, 02-01, 02-02, 03-01]

# Tech tracking
tech-stack:
  added: []
  patterns: [realtime-invalidation-not-state-mutation, single-channel-per-event, removeChannel-cleanup, visibility-refetch, rpc-self-drop]

key-files:
  created:
    - src/hooks/useEventChannel.ts
    - src/hooks/useVisibilityRefetch.ts
    - src/hooks/useDropPlayer.ts
    - src/components/ConfirmDialog.tsx
  modified:
    - src/pages/EventPage.tsx
    - src/components/PlayerList.tsx
    - src/components/PlayerItem.tsx

key-decisions:
  - "Leave Event button placed below player list as separate deliberate action (not inline), per CONTEXT.md user decision"
  - "New player highlight uses prevPlayerIdsRef tracking with 400ms animate-flash class, kept simple"
  - "ConfirmDialog styled consistently with CreateEventModal (same overlay, rounded-2xl card pattern)"

patterns-established:
  - "Realtime invalidation pattern: supabase.channel() with .on() handlers trigger queryClient.invalidateQueries, never direct state mutation"
  - "Single channel per event with removeChannel cleanup in useEffect return (prevents Strict Mode double-sub)"
  - "Visibility refetch pattern: document.visibilitychange listener invalidates both players and event queries"
  - "Self-drop flow: RPC call -> clearPlayerId -> invalidateQueries -> UI re-renders to join form"

requirements-completed: [INFR-01, PLYR-02]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 1 Plan 04: Realtime Updates and Self-Drop Summary

**Supabase Realtime subscription with React Query invalidation, self-drop via RPC with confirmation dialog, Page Visibility API refetch, and new-player highlight animation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T13:39:22Z
- **Completed:** 2026-02-23T13:41:14Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Supabase Realtime channel subscribes to postgres_changes on both players and events tables, invalidating React Query caches for instant cross-client updates
- Self-drop via RPC with confirmation dialog clears localStorage and re-renders the join form
- Page Visibility API refetch catches stale state when mobile users background and restore the app
- New player joins trigger a brief 400ms highlight animation on the player item
- Proper useEffect cleanup with supabase.removeChannel() prevents React Strict Mode double-subscription

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Realtime subscription and visibility refetch hooks** - `0bb9440` (feat)
2. **Task 2: Add self-drop with confirmation and wire Realtime into EventPage** - `06eb1eb` (feat)

## Files Created/Modified
- `src/hooks/useEventChannel.ts` - Supabase Realtime subscription for players and events tables with query invalidation
- `src/hooks/useVisibilityRefetch.ts` - Page Visibility API listener invalidating queries on tab restore
- `src/hooks/useDropPlayer.ts` - React Query mutation calling drop_player RPC with localStorage cleanup
- `src/components/ConfirmDialog.tsx` - Reusable confirmation dialog with destructive action styling
- `src/pages/EventPage.tsx` - Wired Realtime, visibility refetch, self-drop, Leave Event button, and new-player animation
- `src/components/PlayerList.tsx` - Added newPlayerIds prop for highlight animation passthrough
- `src/components/PlayerItem.tsx` - Added isNew prop applying animate-flash class

## Decisions Made
- Leave Event button placed below the player list as a separate section (outline danger styling: text-error border-error/40), not inline with player names -- per user decision in CONTEXT.md for deliberate action
- New player highlight kept simple: ref-based tracking of previous player IDs, 400ms animate-flash CSS class already defined in app.css from Plan 01
- ConfirmDialog follows same dark overlay + centered card pattern as CreateEventModal for visual consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required at this stage. Realtime subscriptions require a running Supabase project (configured in Plan 01).

## Next Phase Readiness
- All Realtime infrastructure is in place: live player list updates across connected clients
- Self-drop flow complete, ready for admin re-add functionality in future phases
- ConfirmDialog component ready for reuse in pod generation confirmations (Phase 2) and round reset (Phase 3)
- EventPage has all hooks wired, ready for pod display integration in Plan 05 and Phase 2

## Self-Check: PASSED

All 7 key files verified present. All 2 task commits verified (0bb9440, 06eb1eb).

---
*Phase: 01-foundation-and-player-flow*
*Completed: 2026-02-23*
