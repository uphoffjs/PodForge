---
phase: 02-pod-generation-and-admin-controls
plan: 04
subsystem: ui
tags: [react, admin, player-management, event-lifecycle, collapsible-ui]

# Dependency graph
requires:
  - phase: 02-01
    provides: RPC hooks (useRemovePlayer, useReactivatePlayer, useEndEvent, useRounds, usePods)
  - phase: 02-03
    provides: AdminControls, RoundDisplay, PodCard, AdminPassphraseModal, EventPage admin integration
provides:
  - AdminPlayerActions component for remove/reactivate player actions
  - PreviousRounds component for collapsible round history display
  - End Event button with confirmation dialog in AdminControls
  - Complete EventPage layout with all admin features wired
affects: [e2e-testing, stryker-mutation-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [inject-admin-actions-as-reactnode-prop, lazy-fetch-on-expand]

key-files:
  created:
    - src/components/AdminPlayerActions.tsx
    - src/components/PreviousRounds.tsx
  modified:
    - src/components/PlayerItem.tsx
    - src/components/PlayerList.tsx
    - src/components/AdminControls.tsx
    - src/pages/EventPage.tsx
    - src/components/PlayerList.test.tsx
    - src/pages/EventPage.test.tsx

key-decisions:
  - "AdminPlayerActions injected as ReactNode prop to keep PlayerItem/PlayerList generic and decoupled from admin logic"
  - "PreviousRounds lazy-fetches pod data only when a section is expanded (usePods called with roundId on expand)"

patterns-established:
  - "Admin action injection: pass admin UI as ReactNode to generic components instead of coupling them to admin logic"
  - "Lazy data fetch on expand: PreviousRoundSection only fetches pods when expanded, avoiding N+1 queries upfront"

requirements-completed: [PLYR-03, PLYR-04, EVNT-04, PODG-07]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 02 Plan 04: Admin Player Management, End Event, and Previous Rounds Summary

**AdminPlayerActions with remove/reactivate per player, End Event button with passphrase-gated confirmation, and collapsible PreviousRounds history display**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T18:55:32Z
- **Completed:** 2026-02-24T18:59:40Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AdminPlayerActions renders remove button for active players and reactivate button for dropped players, with passphrase gating and confirmation dialogs
- End Event button in AdminControls with passphrase validation and confirmation dialog, sets event to read-only
- PreviousRounds shows collapsible historical rounds in descending order, lazy-loading pod data only on expand
- Complete EventPage layout matches documented order with all admin features integrated

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AdminPlayerActions and integrate into PlayerList** - `bf1f197` (feat)
2. **Task 2: Add End Event, PreviousRounds, and wire into EventPage** - `3f9adab` (feat)

## Files Created/Modified
- `src/components/AdminPlayerActions.tsx` - Remove/reactivate buttons with passphrase gating and ConfirmDialog
- `src/components/PreviousRounds.tsx` - Collapsible previous round sections with lazy pod loading
- `src/components/PlayerItem.tsx` - Added optional adminActions ReactNode prop
- `src/components/PlayerList.tsx` - Passes AdminPlayerActions to PlayerItems when isAdmin is true
- `src/components/AdminControls.tsx` - Added End Event button with ConfirmDialog and useEndEvent hook
- `src/pages/EventPage.tsx` - Wired admin props to PlayerList, added PreviousRounds to layout
- `src/components/PlayerList.test.tsx` - Added mock for AdminPlayerActions, updated PlayerItem mock for adminActions prop
- `src/pages/EventPage.test.tsx` - Added mock for PreviousRounds component

## Decisions Made
- AdminPlayerActions injected as ReactNode prop to keep PlayerItem/PlayerList generic and decoupled from admin logic
- PreviousRounds lazy-fetches pod data only when a section is expanded, avoiding N+1 queries upfront

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed PlayerList.test.tsx failing due to AdminPlayerActions import chain**
- **Found during:** Task 1 (AdminPlayerActions integration into PlayerList)
- **Issue:** Adding AdminPlayerActions import to PlayerList caused its test to fail with "Web Worker is not supported" because the import chain reaches supabase's Realtime WebWorker
- **Fix:** Added vi.mock for AdminPlayerActions in PlayerList.test.tsx, updated PlayerItem mock to accept adminActions prop
- **Files modified:** src/components/PlayerList.test.tsx
- **Verification:** All 22 PlayerList tests pass
- **Committed in:** bf1f197 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed EventPage.test.tsx failing due to PreviousRounds import chain**
- **Found during:** Task 2 (PreviousRounds integration into EventPage)
- **Issue:** Adding PreviousRounds import to EventPage caused its test to fail with same WebWorker error via useRounds -> supabase import chain
- **Fix:** Added vi.mock for PreviousRounds in EventPage.test.tsx
- **Files modified:** src/pages/EventPage.test.tsx
- **Verification:** All EventPage tests pass (289 total tests pass)
- **Committed in:** 3f9adab (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to maintain test suite integrity. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (Pod Generation and Admin Controls) is now complete
- All admin features implemented: generate round, remove/reactivate player, end event
- All display features implemented: current round pods, previous rounds history, player list with admin actions
- Ready for E2E testing and mutation testing coverage

## Self-Check: PASSED

All created files verified on disk, all commit hashes verified in git log.

---
*Phase: 02-pod-generation-and-admin-controls*
*Completed: 2026-02-24*
