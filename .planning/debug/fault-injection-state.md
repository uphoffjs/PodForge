# Fault Injection Campaign State

## Status: INVESTIGATION COMPLETE — 69/69 faults tested, all 5 survivors resolved

## Summary
- **Total faults**: 69 (including 1 N/A)
- **KILLED**: 64 (tests correctly detected the fault, including 1 fixed gap: 11.2)
- **EXPECTED_REDUNDANCY**: 4 (defense-in-depth guards with untestable redundancy: 5.3, 8.5, 8.7, 9.2)
- **N/A**: 1 (fault 8.10 covered by 5.5)
- **Kill rate**: 64/68 = 94.1% (excluding N/A and EXPECTED_REDUNDANCY)
- **Effective kill rate**: 64/64 = 100% (excluding N/A and EXPECTED_REDUNDANCY)

## Investigation Results (2026-03-02)

All 5 survived faults were re-investigated using the Edit tool (not sed). Each was applied, spec was run, result recorded, and fault reverted.

### Fault 5.3 — EXPECTED_REDUNDANCY
- **Fault**: Comment out `setShowConfirm(false)` in both onSuccess callbacks of AdminPlayerActions.tsx
- **Applied via Edit tool**: Confirmed fault was applied correctly (not a sed bug)
- **Result**: SURVIVED — test still passes
- **Root cause**: Component unmount/remount masks the bug. When a player is removed, the mock returns updated players, React Query refetches, and the AdminPlayerActions instance for that player is destroyed and recreated in the dropped section. The dialog disappears because the component is unmounted, not because `setShowConfirm(false)` was called.
- **Classification**: EXPECTED_REDUNDANCY — `setShowConfirm(false)` provides faster UX feedback but the end state is identical with or without it.

### Fault 8.5 — EXPECTED_REDUNDANCY
- **Fault**: Remove `timer.status !== 'cancelled'` guard from EventPage.tsx line 238
- **Applied via Edit tool**: Confirmed fault was applied correctly (not a sed bug)
- **Result**: SURVIVED — test still passes
- **Root cause**: `useCountdown` hook (line 75-76) returns `null` for cancelled timers, and `TimerDisplay` returns `null` when countdown is null (line 20). The EventPage guard is redundant.
- **Classification**: EXPECTED_REDUNDANCY — two layers of defence: EventPage guard + useCountdown null return

### Fault 8.7 — EXPECTED_REDUNDANCY
- **Fault**: Remove `isAdmin` from timer controls guard on EventPage.tsx line 241
- **Applied via Edit tool**: Confirmed fault was applied correctly (not a sed bug)
- **Result**: SURVIVED — test still passes
- **Root cause**: Non-admin users have `passphrase === null` (from `useAdminAuth`). The guard `{!isEventEnded && passphrase && (` already prevents rendering because `passphrase` is falsy. The `isAdmin` check is redundant.
- **Classification**: EXPECTED_REDUNDANCY — `passphrase` null check already gates non-admin users

### Fault 9.2 — EXPECTED_REDUNDANCY
- **Fault**: Delete `if (!isAdmin) return null` from AdminControls.tsx line 62
- **Applied via Edit tool**: Confirmed fault was applied correctly (not a sed bug)
- **Result**: SURVIVED — test still passes
- **Root cause**: EventPage.tsx line 262 has parent guard `{isAdmin && !isEventEnded && (` which prevents AdminControls from ever being rendered for non-admins. The internal guard is redundant.
- **Classification**: EXPECTED_REDUNDANCY — parent component already gates rendering

### Fault 11.2 — SURVIVED -> FIXED
- **Fault**: Replace `previousRounds` filter with `const previousRounds = rounds` (include all rounds)
- **Applied via Edit tool**: Confirmed fault was applied correctly
- **Result**: SURVIVED on "displays previous rounds in order" test (no negative assertion for current round)
- **Root cause**: Test checked round-2 and round-1 exist and are ordered, but never asserted round-3 (current) is absent
- **Fix applied**: Added `cy.getByTestId('previous-round-3').should('not.exist')` assertion to previous-rounds.cy.js
- **Verification**: Re-applied fault after fix, test now KILLS it (fails correctly)
- **Classification**: GENUINE TEST GAP -> FIXED

## Full Results Table

| # | Spec | Fault | Result |
|---|------|-------|--------|
| 2.1 | event-creation | Modal never renders | KILLED |
| 2.2 | event-creation | No navigation | KILLED |
| 2.3 | event-creation | Wrong event name | KILLED |
| 2.4 | event-creation | Close btn noop | KILLED |
| 2.5 | event-creation | Overlay click noop | KILLED |
| 2.6 | event-creation | Remove required | KILLED |
| 2.7 | event-creation | Modal closes on error | KILLED |
| 3.1 | player-join | Join form never renders | KILLED |
| 3.2 | player-join | No trim on name | KILLED |
| 3.3 | player-join | Remove onJoined | KILLED |
| 3.4 | player-join | IDs instead of names | KILLED |
| 3.5 | player-join | Skip btn noop | KILLED |
| 3.6 | player-join | Wrong empty msg | KILLED |
| 4.1 | admin-add-player | Form never renders | KILLED |
| 4.2 | admin-add-player | Input not cleared | KILLED |
| 4.3 | admin-add-player | Threshold broken | KILLED |
| 4.4 | admin-add-player | Wrong dup error msg | KILLED |
| 5.1 | admin-player-management | Buttons swapped | KILLED |
| 5.2 | admin-player-management | Generic dialog title | KILLED |
| 5.3 | admin-player-management | Dialog stays open | EXPECTED_REDUNDANCY |
| 5.4 | admin-player-management | Count off by 1 | KILLED |
| 5.5 | admin-player-management | Cancel btn noop | KILLED |
| 5.6 | admin-player-management | Dropped hidden | KILLED |
| 6.1 | generate-round | Controls always hidden | KILLED |
| 6.2 | generate-round | Wrong btn label | KILLED |
| 6.3 | generate-round | Wrong round prefix | KILLED |
| 6.4 | generate-round | Generic error | KILLED |
| 6.5 | generate-round | Hardcoded round count | KILLED |
| 7.1 | pod-display | Wrong pod prefix | KILLED |
| 7.2 | pod-display | No ordinal suffix | KILLED |
| 7.3 | pod-display | IDs instead of names | KILLED |
| 7.4 | pod-display | Wrong bye label | KILLED |
| 7.5 | pod-display | Wrong self indicator | KILLED |
| 7.6 | pod-display | Wrong border color | KILLED |
| 7.7 | pod-display | Seat in bye pod | KILLED |
| 8.1 | timer | Timer never renders | KILLED |
| 8.2 | timer | Wrong running label | KILLED |
| 8.3 | timer | Wrong paused case | KILLED |
| 8.4 | timer | Hardcoded countdown | KILLED |
| 8.5 | timer | Cancelled still shows | EXPECTED_REDUNDANCY |
| 8.6 | timer | Controls never render | KILLED |
| 8.7 | timer | Non-admin sees controls | EXPECTED_REDUNDANCY |
| 8.8 | timer | Pause no mutation | KILLED |
| 8.9 | timer | Always show pause | KILLED |
| 8.10 | timer | Cancel confirm dialog | N/A |
| 9.1 | admin-passphrase | isAdmin inverted | KILLED |
| 9.2 | admin-passphrase | Controls always show | EXPECTED_REDUNDANCY |
| 9.3 | admin-passphrase | No passphrase check | KILLED |
| 9.4 | admin-passphrase | No setPassphrase | KILLED |
| 9.5 | admin-passphrase | Submit never disabled | KILLED |
| 9.6 | admin-passphrase | Cancel stores pass | KILLED |
| 10.1 | qr-code | QR toggle noop | KILLED |
| 10.2 | qr-code | Wrong share URL | KILLED |
| 10.3 | qr-code | Copy btn removed | KILLED |
| 11.1 | previous-rounds | Always null | KILLED |
| 11.2 | previous-rounds | No filter | KILLED (fixed) |
| 11.3 | previous-rounds | Reversed order | KILLED |
| 11.4 | previous-rounds | Starts expanded | KILLED |
| 11.5 | previous-rounds | Toggle noop | KILLED |
| 11.6 | previous-rounds | Eager fetch | KILLED |
| 12.1 | self-drop | Leave btn hidden | KILLED |
| 12.2 | self-drop | Dialog open noop | KILLED |
| 12.3 | self-drop | ID not cleared | KILLED |
| 12.5 | self-drop | Cancel clears ID | KILLED |
| 12.6 | self-drop | Overlay noop | KILLED |
| 13.1 | duplicate-name | Wrong error text | KILLED |
| 13.2 | duplicate-name | Error hidden | KILLED |
| 14.1 | end-event | End btn removed | KILLED |
| 14.2 | end-event | Wrong dialog title | KILLED |
| 14.3 | end-event | Wrong banner text | KILLED |
| 14.4 | end-event | Status hardcoded | KILLED |
| 14.5 | end-event | Controls when ended | KILLED |
| 14.6 | end-event | Data hidden when ended | KILLED |
| 15.1 | visual-regression | BG color red | KILLED |
| 15.2 | visual-regression | Font size change | KILLED |
| 15.3 | visual-regression | Layout alignment | KILLED |

## Campaign Complete
- All 69 faults investigated
- 1 genuine test gap found and fixed (fault 11.2: previous-rounds filter)
- 4 expected redundancies documented (defense-in-depth guards)
- Full E2E suite: 14 specs, 92 tests, all green
- Visual regression baselines committed
