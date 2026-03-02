---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - cypress/e2e/admin-player-management.cy.js
  - cypress/e2e/timer.cy.js
  - cypress/e2e/admin-passphrase.cy.js
  - cypress/e2e/previous-rounds.cy.js
  - src/components/AdminPlayerActions.tsx
  - src/pages/EventPage.tsx
  - src/components/AdminControls.tsx
  - src/components/PreviousRounds.tsx
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "Each of the 5 survived faults is investigated via Edit tool (not sed)"
    - "True test gaps are strengthened with new assertions"
    - "False survivals (sed bugs) are confirmed killed with correct fault application"
    - "Full E2E suite passes green after all fixes"
  artifacts:
    - path: "cypress/e2e/previous-rounds.cy.js"
      provides: "Assertion that current round does NOT appear in previous rounds"
    - path: "cypress/e2e/admin-passphrase.cy.js"
      provides: "Negative assertion testing AdminControls internal guard"
  key_links:
    - from: "cypress/e2e/previous-rounds.cy.js"
      to: "src/components/PreviousRounds.tsx"
      via: "Assertion that current round number is excluded"
      pattern: "previous-round-.*should.*not.exist"
---

<objective>
Investigate the 5 survived faults from the fault injection campaign (5.3, 8.5, 8.7, 9.2, 11.2) and fix real test gaps.

Purpose: The fault injection campaign achieved 92.6% kill rate (63/68). The 5 survivors may be sed script bugs (fault never applied correctly) or genuine test gaps that need strengthening. This plan resolves every survivor.

Output: Strengthened E2E tests, updated fault-injection-state.md, committed visual regression baselines.
</objective>

<execution_context>
@/Users/jacobstoragepug/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jacobstoragepug/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/debug/fault-injection-state.md
@src/components/AdminPlayerActions.tsx
@src/pages/EventPage.tsx
@src/components/AdminControls.tsx
@src/components/PreviousRounds.tsx
@cypress/e2e/admin-player-management.cy.js
@cypress/e2e/timer.cy.js
@cypress/e2e/admin-passphrase.cy.js
@cypress/e2e/previous-rounds.cy.js

<interfaces>
<!-- The 5 survived faults and their investigation approach -->

Fault 5.3 — admin-player-management — Dialog stays open after confirm
  Source: src/components/AdminPlayerActions.tsx lines 50, 63 (setShowConfirm(false))
  Fault: Comment out setShowConfirm(false) in BOTH onSuccess callbacks
  Test: cypress/e2e/admin-player-management.cy.js
  Analysis: Test DOES assert `confirm-dialog should not.exist` on lines 122, 189.
  Likely cause: sed script bug. Test already has the right assertions.
  Action: Apply fault with Edit tool, run spec, expect KILLED.

Fault 8.5 — timer — Cancelled timer still shows
  Source: src/pages/EventPage.tsx line 238
  Fault: Change `{timer && timer.status !== 'cancelled' && (` to `{timer && (`
  Test: cypress/e2e/timer.cy.js line 121-130
  Analysis: Test DOES assert `timer-display should not.exist` for cancelled timer.
  Likely cause: sed failed on the pattern (quotes/escaping).
  Action: Apply fault with Edit tool, run spec, expect KILLED.

Fault 8.7 — timer — Non-admin sees timer controls
  Source: src/pages/EventPage.tsx line 241
  Fault: Change `{isAdmin && !isEventEnded && passphrase && (` to `{!isEventEnded && passphrase && (`
  Test: cypress/e2e/timer.cy.js line 149-166
  Analysis: Test DOES assert `timer-pause-btn should not.exist` for non-admin.
  Likely cause: sed failed on the pattern (complex JSX expression).
  Action: Apply fault with Edit tool, run spec, expect KILLED.

Fault 9.2 — admin-passphrase — Controls always show (removed admin check)
  Source: src/components/AdminControls.tsx line 62 (`if (!isAdmin) return null`)
  Fault: Delete that line
  Test: cypress/e2e/admin-passphrase.cy.js line 88-93
  Analysis: GENUINE TEST GAP. EventPage.tsx line 262 has a PARENT guard:
    `{isAdmin && !isEventEnded && (<AdminControls ...>)}`.
    Removing AdminControls' internal guard has NO visible effect because the parent
    never renders AdminControls for non-admins. The test passes not because of
    AdminControls' guard, but because of EventPage's guard.
  Resolution: This is defense-in-depth. The internal guard is redundant but good practice.
    Either (a) accept as redundant/non-testable, or (b) create a unit-level test for AdminControls.
    Since the parent guard is tested, mark as EXPECTED_REDUNDANCY in the report.

Fault 11.2 — previous-rounds — Don't filter current round
  Source: src/components/PreviousRounds.tsx lines 93-95
  Fault: Change filter to include all rounds (remove `r.round_number < currentRoundNumber`)
  Test: cypress/e2e/previous-rounds.cy.js
  Analysis: GENUINE TEST GAP. The "displays previous rounds in order" test (line 173)
    has 3 rounds (current=3, previous=2,1). It checks round-2 and round-1 are present
    and ordered, but NEVER asserts round-3 is absent. If filter is removed, round-3
    appears in previous rounds and the test still passes.
  Resolution: Add `.should('not.exist')` assertion for `previous-round-3` (the current round).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Investigate all 5 survived faults via Edit tool</name>
  <files>
    src/components/AdminPlayerActions.tsx
    src/pages/EventPage.tsx
    src/components/AdminControls.tsx
    src/components/PreviousRounds.tsx
  </files>
  <action>
For each of the 5 survived faults, follow this exact protocol:

1. Start dev server if not running: `npm run dev` (background)
2. Ensure source files are clean: `git checkout src/` to restore pristine state

For EACH fault (5.3, 8.5, 8.7, 9.2, 11.2):
  a. Apply the fault using the Edit tool (NOT sed)
  b. Verify the file compiles (check Vite output or run `npx tsc --noEmit` on the file)
  c. Run ONLY the corresponding Cypress spec:
     - 5.3: `npx cypress run --spec cypress/e2e/admin-player-management.cy.js`
     - 8.5: `npx cypress run --spec cypress/e2e/timer.cy.js`
     - 8.7: `npx cypress run --spec cypress/e2e/timer.cy.js`
     - 9.2: `npx cypress run --spec cypress/e2e/admin-passphrase.cy.js`
     - 11.2: `npx cypress run --spec cypress/e2e/previous-rounds.cy.js`
  d. Record result: KILLED (test caught it) or SURVIVED (test gap)
  e. Revert the fault: `git checkout {source_file}`

SPECIFIC FAULT EDITS:

Fault 5.3 — AdminPlayerActions.tsx:
  Comment out `setShowConfirm(false)` on line 50 (onSuccess of removePlayer) AND line 63 (onSuccess of reactivatePlayer). Keep lines 53, 66 (onError) intact.

Fault 8.5 — EventPage.tsx:
  Line 238: Change `{timer && timer.status !== 'cancelled' && (` to `{timer && (`

Fault 8.7 — EventPage.tsx:
  Line 241: Change `{isAdmin && !isEventEnded && passphrase && (` to `{!isEventEnded && passphrase && (`

Fault 9.2 — AdminControls.tsx:
  Line 62: Delete `if (!isAdmin) return null`

Fault 11.2 — PreviousRounds.tsx:
  Lines 93-95: Change the filter logic so previousRounds includes ALL rounds (not just rounds < currentRoundNumber). Replace:
    ```
    const previousRounds = currentRoundNumber
      ? rounds.filter((r) => r.round_number < currentRoundNumber)
      : rounds.slice(1)
    ```
  With:
    ```
    const previousRounds = rounds
    ```

Keep a running tally of results. Expected outcomes:
  - 5.3: Likely KILLED (sed bug in original campaign)
  - 8.5: Likely KILLED (sed bug)
  - 8.7: Likely KILLED (sed bug)
  - 9.2: Likely SURVIVED (redundant guard — parent already gates)
  - 11.2: Likely SURVIVED (no negative assertion for current round)
  </action>
  <verify>
All 5 faults have been applied, tested, and reverted. Source files are clean (git checkout).
Run: `git diff --name-only src/` returns empty (all source reverted).
  </verify>
  <done>
All 5 fault investigation results documented. True test gaps identified vs sed script bugs.
  </done>
</task>

<task type="auto">
  <name>Task 2: Strengthen tests for confirmed gaps, run full suite, commit</name>
  <files>
    cypress/e2e/previous-rounds.cy.js
    cypress/e2e/admin-passphrase.cy.js
    .planning/debug/fault-injection-state.md
  </files>
  <action>
Based on Task 1 results, strengthen tests for any SURVIVED faults:

**Fault 11.2 (almost certainly SURVIVED):**
In `cypress/e2e/previous-rounds.cy.js`, in the test "displays previous rounds in order" (around line 173), after the existing assertions for round-2 and round-1, add a NEGATIVE assertion that the current round (round-3) does NOT appear in previous rounds:

```javascript
// Current round (round 3) must NOT appear in previous rounds section
cy.getByTestId('previous-round-3').should('not.exist')
```

Then re-apply fault 11.2 and re-run `npx cypress run --spec cypress/e2e/previous-rounds.cy.js` to confirm the test now KILLS it. Revert the fault after.

**Fault 9.2 (likely SURVIVED — redundant guard):**
This is a defense-in-depth case. EventPage.tsx line 262 already guards `{isAdmin && !isEventEnded && (` before rendering AdminControls. The internal `if (!isAdmin) return null` in AdminControls is a redundant safety net.

Two options:
  - Option A (preferred): Accept as EXPECTED_REDUNDANCY. The parent guard is already tested by the admin-passphrase spec. Document in fault-injection-state.md.
  - Option B: If you want to catch this, add a unit test (Vitest) for AdminControls that renders it directly with `isAdmin=false` and verifies it returns null. Only do this if it is simple and fast.

Go with Option A unless the executor decides Option B is trivial.

**For any other faults that SURVIVED unexpectedly:**
  - Add the missing assertion to the relevant spec
  - Re-apply the fault, re-run spec, confirm KILLED
  - Revert fault

**After all test fixes:**

1. Ensure all source files are clean: `git diff --name-only src/` should be empty
2. Run the FULL E2E suite: `npx cypress run`
3. Verify all specs pass green
4. Update `.planning/debug/fault-injection-state.md`:
   - Update the status line to reflect final results
   - For each fault, record the final result (KILLED, SURVIVED->FIXED, or EXPECTED_REDUNDANCY)
   - Update kill rate
5. Stage and commit the visual regression baseline PNGs that are pending:
   ```
   git add cypress/snapshots/base/
   ```
6. Stage the updated test files and fault-injection-state.md
7. Commit all changes together with message describing the fault investigation outcomes
  </action>
  <verify>
    <automated>npx cypress run 2>&1 | tail -20</automated>
Full E2E suite passes (all 14 specs green). `git diff --name-only src/` returns empty.
  </verify>
  <done>
All confirmed test gaps fixed. Full E2E suite green. Visual regression baselines committed. Fault injection state doc updated with final results. Kill rate improved or explained for every survivor.
  </done>
</task>

</tasks>

<verification>
1. All 5 survived faults investigated individually with Edit tool
2. Source files are clean (no fault mutations left in codebase)
3. Test gaps strengthened with explicit assertions
4. Full E2E suite passes: `npx cypress run` — all 14 specs green
5. `.planning/debug/fault-injection-state.md` updated with final results
6. Visual regression baselines committed
</verification>

<success_criteria>
- Every survived fault has a documented resolution (KILLED / SURVIVED->FIXED / EXPECTED_REDUNDANCY)
- Kill rate >= 95% (at most 1 accepted redundancy out of 68)
- Full Cypress E2E suite passes
- All pending visual regression baselines committed
</success_criteria>

<output>
After completion, create `.planning/quick/5-investigate-the-5-survived-faults-from-t/5-SUMMARY.md`
</output>
