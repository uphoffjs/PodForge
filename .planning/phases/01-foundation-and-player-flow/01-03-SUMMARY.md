---
phase: 01-foundation-and-player-flow
plan: 03
subsystem: ui
tags: [react, tanstack-query, supabase, qrcode, localStorage, event-page, player-list]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Vite scaffold, Supabase client, React Query, player-identity utility, Event/Player types"
provides:
  - "Event page with conditional join form and player list display"
  - "Data-fetching hooks: useEvent, useEventPlayers, useJoinEvent"
  - "QR code display for event sharing"
  - "localStorage-based player auto-recognition"
  - "Duplicate name prevention with friendly error (Postgres 23505)"
affects: [01-04, 01-05, 02-01, 02-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-rendering-by-join-status, localStorage-player-recognition, explicit-column-select-for-rls, collapsed-section-toggle]

key-files:
  created:
    - src/hooks/useEvent.ts
    - src/hooks/useEventPlayers.ts
    - src/hooks/useJoinEvent.ts
    - src/components/JoinEventForm.tsx
    - src/components/PlayerList.tsx
    - src/components/PlayerItem.tsx
    - src/components/QRCodeDisplay.tsx
  modified:
    - src/pages/EventPage.tsx

key-decisions:
  - "Join form overlays player list (visible behind/below) rather than replacing it, per CONTEXT.md"
  - "Skip link below join form serves as admin skip-prompt per user decision (no separate skip modal)"
  - "Inline error display for both client-side validation and server-side mutation errors"

patterns-established:
  - "Conditional rendering by join status: check localStorage, verify against fetched players, show form or full view"
  - "Query hooks return full useQuery/useMutation results for consumer-side loading/error handling"
  - "Explicit column list in useEvent (column-level security prevents select *)"
  - "Collapsed section pattern for dropped players with useState toggle"

requirements-completed: [EVNT-02, EVNT-03, PLYR-01, PLYR-05]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 1 Plan 03: Event Page with Player Join Flow Summary

**Event page with conditional join form, player list with active/dropped counts, QR code sharing, and localStorage player auto-recognition**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T13:34:11Z
- **Completed:** 2026-02-23T13:36:16Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Three React Query hooks (useEvent, useEventPlayers, useJoinEvent) with proper Supabase queries and error handling
- Full event page with conditional rendering: join form for new visitors, full player view for recognized players
- Player list with active count header, collapsed dropped section with expand toggle, and self-highlight styling
- QR code display and copy-to-clipboard sharing for event URL
- Duplicate name handling via Postgres unique constraint (23505 -> friendly toast)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data-fetching hooks for events and players** - `b3526e9` (feat)
2. **Task 2: Build event page with join form, player list, and QR code** - `dcaeccb` (feat)

## Files Created/Modified
- `src/hooks/useEvent.ts` - React Query hook fetching event details with explicit column list
- `src/hooks/useEventPlayers.ts` - React Query hook fetching player list ordered by join time
- `src/hooks/useJoinEvent.ts` - React Query mutation for joining event with duplicate name error handling
- `src/components/JoinEventForm.tsx` - Name input form with 2-20 char validation and loading state
- `src/components/PlayerList.tsx` - Active players list with collapsed dropped section and count header
- `src/components/PlayerItem.tsx` - Single player row with self-highlight (purple border/background)
- `src/components/QRCodeDisplay.tsx` - QR code SVG rendering event URL with white background
- `src/pages/EventPage.tsx` - Full event page with conditional join/view, share section, localStorage persistence

## Decisions Made
- Join form presented above player list (visible behind) rather than replacing it, matching CONTEXT.md user decision
- Skip link below join form serves as the admin "skip prompt" -- simple, no modal needed
- Inline error display for both client-side name validation and server-side mutation errors (no separate error page)
- Player self-highlight uses purple border-left + background tint (no "(you)" tag per user decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required at this stage.

## Next Phase Readiness
- Event page complete with join flow and player list display, ready for real-time updates in Plan 04
- useEventPlayers hook has staleTime: 30s, ready for Realtime subscription invalidation
- Player identity persistence working via localStorage, ready for drop/leave functionality in Plan 05

## Self-Check: PASSED

All 8 key files verified present. All 2 task commits verified (b3526e9, dcaeccb).

---
*Phase: 01-foundation-and-player-flow*
*Completed: 2026-02-23*
