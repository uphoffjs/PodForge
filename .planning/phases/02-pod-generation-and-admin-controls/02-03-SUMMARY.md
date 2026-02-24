---
phase: 02-pod-generation-and-admin-controls
plan: 03
subsystem: ui
tags: [react, components, pod-display, admin-controls, passphrase-modal, event-page]

# Dependency graph
requires:
  - phase: 02-pod-generation-and-admin-controls/01
    provides: "useGenerateRound, useCurrentRound, usePods hooks, Round/Pod/PodPlayer types"
  - phase: 02-pod-generation-and-admin-controls/02
    provides: "generatePods pure function, PlayerInfo/RoundHistory types"
provides:
  - "AdminPassphraseModal component for passphrase entry"
  - "AdminControls component with Generate Next Round button"
  - "PodCard component with seat ordinals, color-coded borders, bye variant"
  - "RoundDisplay component showing current round pods in responsive grid"
  - "EventPage integration with round display, admin controls, ended event banner"
affects: [02-pod-generation-and-admin-controls/04]

# Tech tracking
tech-stack:
  added: []
  patterns: [passphrase-modal-pattern, pod-card-color-cycling, event-ended-read-only-view]

key-files:
  created:
    - src/components/AdminPassphraseModal.tsx
    - src/components/AdminControls.tsx
    - src/components/PodCard.tsx
    - src/components/RoundDisplay.tsx
  modified:
    - src/pages/EventPage.tsx
    - src/pages/EventPage.test.tsx

key-decisions:
  - "AdminControls builds round history from the latest round's pods only (sufficient for greedy algorithm)"
  - "PodCard uses 4-color cycling (blue, green, amber, red) for pod border colors"
  - "Event ended state hides join form, admin controls, add player, and leave button but keeps pods and player list visible"

patterns-established:
  - "Passphrase modal pattern: AdminPassphraseModal stores passphrase via useAdminAuth.setPassphrase on submit"
  - "Pod color cycling: POD_COLORS array indexed by (podNumber - 1) % 4"
  - "Ended event read-only view: isEventEnded flag controls visibility of interactive elements"

requirements-completed: [PODG-01, PODG-04, PODG-05]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 02 Plan 03: Admin Controls & Pod Display Summary

**Admin Generate Round button, passphrase modal, color-coded pod cards with seat ordinals, and current round display integrated into EventPage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T18:48:02Z
- **Completed:** 2026-02-24T18:52:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AdminPassphraseModal with password input, overlay dismiss, Escape key close, error display
- AdminControls component calls generatePods algorithm then useGenerateRound mutation, with round counter
- PodCard with 4-color cycling borders, seat ordinal badges (1st-4th), current player highlighting, bye variant with muted styling
- RoundDisplay fetches pods via usePods hook, responsive 1-2 column grid, non-bye pods first
- EventPage integrates all new components in correct layout order: header, ended banner, join form, round display, admin controls, player list, add player, leave, share
- Ended events show read-only view with Lock icon banner

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AdminPassphraseModal and AdminControls components** - `a87ad33` (feat)
2. **Task 2: Create PodCard, RoundDisplay, and integrate into EventPage** - `57dae58` (feat)

## Files Created/Modified
- `src/components/AdminPassphraseModal.tsx` - Modal dialog for admin passphrase entry with submit/cancel/error
- `src/components/AdminControls.tsx` - Admin panel with Generate Next Round button, pod algorithm + RPC integration
- `src/components/PodCard.tsx` - Pod card with colored borders, seat ordinals, bye variant, player highlighting
- `src/components/RoundDisplay.tsx` - Current round display with responsive pod grid layout
- `src/pages/EventPage.tsx` - Integrated RoundDisplay, AdminControls, AdminPassphraseModal, ended event banner
- `src/pages/EventPage.test.tsx` - Added mocks for useCurrentRound, RoundDisplay, AdminControls, AdminPassphraseModal

## Decisions Made
- AdminControls builds round history from the latest round's pods only -- the greedy algorithm primarily benefits from the most recent round data, and fetching all rounds' pods would require multiple queries
- PodCard uses a 4-color cycling array (blue, green, amber, red) for pod border colors, wrapping for pods 5+
- Event ended state hides all interactive elements (join form, admin controls, add player, leave button) but preserves pods and player list for historical viewing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated EventPage tests to mock new hooks and components**
- **Found during:** Task 2 (EventPage integration)
- **Issue:** EventPage.test.tsx failed because importing useCurrentRound triggered the Supabase client module which requires Web Worker support unavailable in jsdom
- **Fix:** Added vi.mock for useCurrentRound hook and three new component mocks (RoundDisplay, AdminControls, AdminPassphraseModal)
- **Files modified:** src/pages/EventPage.test.tsx
- **Verification:** All 289 tests pass (49 EventPage tests)
- **Committed in:** 57dae58 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test mock update was necessary consequence of adding new imports to EventPage. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All pod display and admin control components are in place
- Plan 04 (admin player management UI) can use the AdminControls pattern and passphrase modal
- useRemovePlayer, useReactivatePlayer, useEndEvent hooks ready for Plan 04 integration
- RoundDisplay and PodCard are fully functional for real-time pod viewing

## Self-Check: PASSED

All 6 files verified present. Both task commits (a87ad33, 57dae58) verified in git history.

---
*Phase: 02-pod-generation-and-admin-controls*
*Completed: 2026-02-24*
