---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/AdminControls.test.tsx
  - src/components/PlayerList.test.tsx
  - src/components/AdminPlayerActions.test.tsx
  - src/hooks/useEventChannel.test.ts
  - src/hooks/useTimerNotification.test.ts
  - src/hooks/useCountdown.test.ts
  - src/pages/EventPage.test.tsx
autonomous: true
requirements: [COV-100]

must_haves:
  truths:
    - "All source files report 100% statement coverage"
    - "All source files report 100% branch coverage"
    - "All source files report 100% function coverage"
    - "All source files report 100% line coverage"
  artifacts:
    - path: "src/components/AdminControls.test.tsx"
      provides: "Full coverage for AdminControls including end event flow, timer picker, error branches"
    - path: "src/hooks/useEventChannel.test.ts"
      provides: "Coverage for subscribe callback CHANNEL_ERROR and TIMED_OUT branches"
    - path: "src/pages/EventPage.test.tsx"
      provides: "Coverage for passphrase cancel, passphrase needed, and event ended branches"
  key_links:
    - from: "test files"
      to: "source files"
      via: "vitest coverage"
      pattern: "npx vitest run --coverage"
---

<objective>
Achieve 100% code coverage across all metrics (statements, branches, functions, lines) by adding targeted tests for uncovered code paths.

Purpose: Current coverage is 94.7% stmts / 89.21% branch / 93.75% funcs / 95.1% lines. Specific gaps exist in 8 files that need targeted test additions.
Output: Updated test files with full coverage, verified by `npx vitest run --coverage`.
</objective>

<execution_context>
@/Users/jacobstoragepug/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jacobstoragepug/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@vite.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Cover AdminControls end event flow, timer picker, and error/success callbacks</name>
  <files>src/components/AdminControls.test.tsx</files>
  <action>
Add tests to `src/components/AdminControls.test.tsx` covering the following uncovered code paths (lines 135-144, 175-237):

1. **End Event button rendering and click handler** (handleEndEvent):
   - Test clicking "End Event" button when passphrase is null calls `onPassphraseNeeded` (line 128-129)
   - Test clicking "End Event" button when event is ended does nothing (line 124, early return)
   - Test clicking "End Event" button with valid passphrase opens ConfirmDialog (line 131, setShowEndConfirm(true))

2. **End Event confirm flow** (handleEndEventConfirm, lines 134-148):
   - Test confirming end event calls `endEvent.mutate` with `{ passphrase }` and correct callbacks
   - Test `onSuccess` callback closes the confirm dialog (setShowEndConfirm(false))
   - Test `onError` callback closes the confirm dialog (setShowEndConfirm(false))
   - Test `handleEndEventConfirm` returns early when passphrase is null (line 135)

3. **Timer duration picker** (lines 167-188):
   - Test timer duration buttons render when event is not ended
   - Test timer duration buttons are hidden when event is ended
   - Test clicking a duration button selects it (toggles selectedDuration)
   - Test clicking the same duration button again deselects it (toggling behavior on line 175)
   - Test selected duration is passed to generateRound.mutate's `timerDurationMinutes` parameter

4. **Generate round success/error callbacks** (lines 106-113):
   - Test `onSuccess` callback shows toast, resets isGenerating, and resets selectedDuration to null
   - Test `onError` callback resets isGenerating
   - Test that `generatePods` throwing an Error calls `toast.error` with the error message (lines 116-120)
   - Test algorithm warnings are shown via `toast.warning` (lines 95-97)

5. **isPending state** (line 150):
   - Test button shows "Generating..." text and Loader icon when isPending
   - Test end event button shows "Ending..." text when endEvent.isPending

To achieve this, you need to update mocks:
- Make `useEndEvent` mock configurable (similar to how useGenerateRound is mocked) so you can control isPending and capture mutate calls
- The ConfirmDialog is already imported in the component; ensure your test can interact with it (render it, click confirm/cancel)
- For the ConfirmDialog interaction, render the full component and use the ConfirmDialog's data-testid attributes (`confirm-dialog`, `confirm-dialog-confirm-btn`, `confirm-dialog-cancel-btn`) from the real ConfirmDialog component, OR mock it like EventPage.test.tsx does

Note: The existing mock for useEndEvent returns `{ mutate: mockEndMutate, isPending: false }`. You need to make isPending configurable for the "Ending..." test.
  </action>
  <verify>
    <automated>cd /Users/jacobstoragepug/Desktop/PodForge && npx vitest run src/components/AdminControls.test.tsx --coverage 2>&1 | grep -E "AdminControls|All files"</automated>
    <manual>AdminControls.tsx should show 100% across all coverage metrics</manual>
  </verify>
  <done>AdminControls.tsx has 100% statement, branch, function, and line coverage</done>
</task>

<task type="auto">
  <name>Task 2: Cover remaining hooks gaps (useEventChannel, useTimerNotification, useCountdown) and component branches (PlayerList, EventPage, AdminPlayerActions)</name>
  <files>
    src/hooks/useEventChannel.test.ts
    src/hooks/useTimerNotification.test.ts
    src/hooks/useCountdown.test.ts
    src/components/PlayerList.test.tsx
    src/pages/EventPage.test.tsx
    src/components/AdminPlayerActions.test.tsx
  </files>
  <action>
Add targeted tests to cover specific uncovered branches/lines in 6 files:

**useEventChannel.test.ts** — Cover subscribe callback (lines 86-92):
The `.subscribe((status, err) => {...})` callback handles CHANNEL_ERROR and TIMED_OUT. Currently the mock's `subscribe` just returns the channel object without capturing/invoking the callback.
- Update the mock so `mockSubscribe` captures the callback passed to `.subscribe()`
- Add test: invoke subscribe callback with `('CHANNEL_ERROR', { message: 'test error' })` and verify `console.error` is called with the correct message pattern `[useEventChannel] Realtime channel error:`
- Add test: invoke subscribe callback with `('TIMED_OUT', undefined)` and verify `console.warn` is called with `[useEventChannel] Realtime channel subscription timed out`
- Add test: invoke subscribe callback with `('SUBSCRIBED', undefined)` and verify neither console.error nor console.warn is called (default/no-op branch)

**useTimerNotification.test.ts** — Cover lines 25 and 67:
- Line 25: The `catch` in the initial `useState` callback when `Notification.permission` throws. Add test: set up `Notification` with a getter on `permission` that throws, verify hook returns `permission: 'unsupported'`
- Line 67: The timer reset effect. Add test: render with timer-1 expired (notification fires, lastNotifiedTimerId = timer-1), then change to timer-2 NOT expired (resets lastNotifiedTimerId to null), then change timer-2 to expired - notification should fire. This proves the reset effect on line 66-68 executes. The key is that timer-2 must initially NOT be expired, then become expired, to prove the ref was reset.

**useCountdown.test.ts** — Cover lines 53-54:
These lines handle clearing an existing interval when the timer prop changes (the `if (intervalRef.current !== null)` block at the TOP of the effect, before the early return for cancelled).
- Add test: render with a running timer (starts interval), then rerender with a DIFFERENT running timer. This exercises lines 52-55 where it clears the old interval before setting up the new one.
- Add test: render with a running timer, then rerender with `null` timer. This exercises lines 52-55 then the early return on line 57.

**PlayerList.test.tsx** — Cover branches on lines 31, 60-66, 99-105:
These are the `canShowAdminActions` conditional branches where admin actions are rendered for active and dropped players.
- Add test: render with `isAdmin=true`, `eventId="evt1"`, `onPassphraseNeeded={vi.fn()}`, and `passphrase="secret"` for active players. Verify the `admin-action-{playerId}` test IDs appear (from the AdminPlayerActions mock).
- Add test: render with `isAdmin=true`, `eventId="evt1"`, `onPassphraseNeeded={vi.fn()}`, `passphrase="secret"`, with dropped players visible (toggle open). Verify admin actions appear for dropped players too.
- Add test: render with `isAdmin=false` — verify no admin actions rendered.
- Add test: render with `isAdmin=true` but `eventId` undefined — verify no admin actions rendered (canShowAdminActions is falsy).
- Add test: render with `isAdmin=true` and `eventId` set but `onPassphraseNeeded` undefined — verify no admin actions rendered.

**EventPage.test.tsx** — Cover lines 149-150, 154-155:
- Lines 148-151: `handlePassphraseCancel` — closes modal and clears error. Add test: trigger passphrase modal open (click the "Need Passphrase" button from admin-controls mock), then click the cancel button from the passphrase modal mock. Verify modal closes.
- Lines 153-156: `handlePassphraseNeeded` — opens modal. Already partially tested by admin controls interaction, but need to verify the passphrase modal actually appears by clicking the mock's "Need Passphrase" button. Ensure the test checks that `admin-passphrase-modal` test ID appears.
- Additionally test the submit flow: open passphrase modal, click submit (which calls onSubmit with 'secret123' from mock), verify `setPassphrase` was called and modal closes.
- Cover EventPage event-ended conditional branches: render with event status 'ended', verify: event-ended-banner visible, join form hidden, admin controls hidden, add player form hidden, leave event button hidden, timer controls hidden.
- Cover timer display visibility: render with a non-null timer with status 'running', verify timer-display appears. Then test with timer status 'cancelled', verify timer-display does NOT appear.
- Cover timer controls visibility: render with admin=true, passphrase set, timer running, event not ended. Verify timer-controls appears. Then render with admin=true but passphrase null — verify timer-controls does NOT appear.

**AdminPlayerActions.test.tsx** — Cover line 109 (cancel handler):
- Add test: open confirm dialog, click cancel button, verify dialog closes. The ConfirmDialog's cancel button has `data-testid="confirm-dialog-cancel-btn"`.
  </action>
  <verify>
    <automated>cd /Users/jacobstoragepug/Desktop/PodForge && npx vitest run --coverage 2>&1 | tail -60</automated>
    <manual>All files should show 100% across all four coverage metrics</manual>
  </verify>
  <done>Every source file reports 100% statements, branches, functions, and lines in the coverage report</done>
</task>

</tasks>

<verification>
Run full test suite with coverage and confirm all metrics are 100%:
```bash
npx vitest run --coverage
```
Every row in the coverage table must show 100% for Stmts, Branch, Funcs, and Lines.
</verification>

<success_criteria>
- `npx vitest run --coverage` shows 100% across all four metrics for every file
- All 568+ existing tests still pass (no regressions)
- No test uses arbitrary waits or flaky patterns
</success_criteria>

<output>
After completion, create `.planning/quick/2-get-code-coverage-to-100/2-SUMMARY.md`
</output>
