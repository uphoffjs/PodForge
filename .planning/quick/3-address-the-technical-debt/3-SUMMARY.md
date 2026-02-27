---
phase: quick-3
plan: 01
subsystem: testing
tags: [tech-debt, determinism, flaky-tests, e2e]
dependency_graph:
  requires: []
  provides: [deterministic-bye-tests, committed-e2e-tests]
  affects: [src/lib/pod-algorithm.test.ts, cypress/e2e/timer.cy.js, cypress/e2e/admin-passphrase.cy.js]
tech_stack:
  added: []
  patterns: [seeded-prng-mock, lcg-determinism]
key_files:
  created: []
  modified:
    - src/lib/pod-algorithm.test.ts
    - cypress/e2e/timer.cy.js
    - cypress/e2e/admin-passphrase.cy.js
decisions:
  - Seeded LCG mock via vi.spyOn(Math, 'random') for deterministic bye rotation tests
  - ROADMAP.md checkboxes already accurate, no fixes needed
metrics:
  duration: 2min
  completed: "2026-02-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Quick Task 3: Address Technical Debt Summary

Seeded PRNG mock eliminates flaky bye rotation tests; committed 2 uncommitted E2E test files for timer and admin passphrase flows.

## What Was Done

### Task 1: Fix flaky pod-algorithm bye rotation test
- Added `seedRandom(seed)` helper function using a Linear Congruential Generator (LCG) that mocks `Math.random` via `vi.spyOn`
- Applied seeded PRNG to the `bye rotation for all non-divisible-by-4 counts` parameterized test (12 player counts)
- Applied seeded PRNG to the `fairly rotates sit-outs across 4 rounds with 7 players` regression test
- Used try/finally blocks to ensure `spy.mockRestore()` always runs
- Verified determinism: 10 consecutive runs, 10 passes (90 tests each)
- **Commit:** b0b5001

### Task 2: Commit uncommitted files and verify ROADMAP accuracy
- Verified ROADMAP.md checkboxes for 04-03, 05-02, 05-03 -- all already `[x]`, no fixes needed
- Committed `cypress/e2e/timer.cy.js` (timer display + admin control E2E tests)
- Committed `cypress/e2e/admin-passphrase.cy.js` (admin passphrase modal flow E2E tests)
- Full test suite passes: 678 tests across 49 files
- **Commit:** be42319

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `npx vitest run` -- all 678 tests pass across 49 files
2. `npx vitest run src/lib/pod-algorithm.test.ts` run 10 times -- 10/10 passes (deterministic)
3. `git status` -- clean working tree
4. ROADMAP.md shows `[x]` for 04-03, 05-02, 05-03 (already correct)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | b0b5001 | fix(quick-3): make pod-algorithm bye rotation tests deterministic |
| 2 | be42319 | test(quick-3): commit uncommitted E2E test files |
