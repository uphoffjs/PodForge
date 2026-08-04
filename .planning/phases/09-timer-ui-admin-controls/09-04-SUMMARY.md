---
phase: 09-timer-ui-admin-controls
plan: 04
subsystem: timer
tags: [e2e, cypress, stryker, mutation-testing, timer, 80-20]
requires:
  - 09-03 (TimerDisplay phase bands + data-phase, TimerControls pending Start/Cancel, AdminControls 80+20 preset)
  - 09-02 (useStartTimer hook, useCountdown not-started branch)
provides:
  - cypress/e2e/timer-80-20.cy.js (select/generate/start + three-phase E2E)
  - timer.cy.js ROUND TIMER label + overtime/countup control coverage
  - Stryker gate proof (hooks 100%, changed components 95.35%)
affects:
  - TEST-05 (closed)
  - TIMER-07 (E2E half closed)
tech-stack:
  added: []
  patterns:
    - Cypress intercept harness (setupTimerPage) with computed expires_at per phase
    - RPC body assertion via cy.intercept aliases (no cy.wait(ms))
    - Scoped Stryker --mutate runs as a per-file mutation gate
key-files:
  created:
    - cypress/e2e/timer-80-20.cy.js
  modified:
    - cypress/e2e/timer.cy.js
decisions:
  - "Honored the UI-SPEC literal: main-phase label asserted as 'ROUND TIMER' (was 'Round Timer')"
  - "timer-80-20.cy.js uses an 8-player roster so generatePods reaches the generate_round RPC (client throws below 4)"
  - "Task 3 (Stryker gate) required no test-code changes — 09-02/09-03 already met the targets"
metrics:
  duration: 20min
  tasks: 3
  files: 2
  completed: 2026-06-29
---

# Phase 09 Plan 04: E2E + Stryker Gate Summary

End-to-end proof of the full 80+20 timer flow plus the mutation-coverage gate: a new `timer-80-20.cy.js` walks select → generate → start → main/overtime/count-up transitions with RPC-body and `data-phase` assertions, `timer.cy.js` adopts the `ROUND TIMER` label and exercises pause/+5/cancel across overtime and count-up, and Stryker confirms the timer-critical hooks at 100% with the changed components at 95.35% (>=80% bar).

## What Was Built

### Task 1 — `cypress/e2e/timer-80-20.cy.js` (new) — commit b7850e7
Reuses the `setupTimerPage({ timer, asAdmin })` intercept harness (Realtime socket blocked; events/players/rounds/pods mocked; `round_timers` served via the PostgREST `vnd.pgrst.object+json` single-object header). Five passing specs:
1. **Select + generate** — selects `timer-duration-80-20`, clicks `generate-round-btn`, and asserts the intercepted `generate_round` request body carries `p_overtime_minutes === 20` and `p_timer_duration_minutes === 80`.
2. **Pending card** — mounts a `pending` timer (`overtime_seconds: 1200`) and asserts `data-phase='not-started'`, `timer-status` contains `READY TO START`, `timer-countdown` shows `80:00`, and `timer-start-btn` is visible.
3. **Start** — clicks `timer-start-btn` and asserts the `start_timer` RPC fired (body `p_event_id` = the event).
4. **Overtime** — mounts a `running` timer with `expires_at = now-60s` → `data-phase='overtime'`, label `OVERTIME`.
5. **Count-up** — mounts `expires_at = now-(1200+60)s` → `data-phase='countup'`, label `OVERRUN`, countdown text matches `/^\+/`.

`data-testid` + intercept aliases only; zero numeric `cy.wait()`.

### Task 2 — `cypress/e2e/timer.cy.js` (extended) — commit 2e5b98d
- Updated the main-phase status assertion from `'Round Timer'` to the UI-SPEC literal `'ROUND TIMER'` (the only occurrence).
- Added a `describe('… operable across overtime and count-up phases')` block that mounts overtime and count-up timers via computed `expires_at` and, for each phase, asserts the band/label and that `pause_timer` / `extend_timer` fire and Cancel opens the `confirm-dialog` → `cancel_timer` (6 new specs). All `data-testid` + intercept aliases; no `cy.wait(ms)`.

### Task 3 — Stryker gate (verification only, no code change)
Two scoped runs:
- **Timer-critical hooks (100% required):** `npx stryker run --mutate "src/hooks/useCountdown.ts,src/hooks/useStartTimer.ts"` → **100.00%** (useCountdown 66 killed, useStartTimer 18 killed, 0 survived, 0 no-coverage). The `# errors` column (48/2) are mutants rejected by the TypeScript checker (non-compiling), not survivors.
- **Changed components (>=80% project bar):** `npx stryker run --mutate "src/components/TimerDisplay.tsx,src/components/TimerControls.tsx,src/components/AdminControls.tsx"` → **95.35%** overall (TimerDisplay 100% / 27, TimerControls 100% / 56, AdminControls 91.01% / 81). Clears the break threshold.

The NEW 80+20 branch logic is fully killed: TimerDisplay phase-band selection + not-started card (100%) and TimerControls pending Start/Cancel branch (100%). AdminControls' 8 survivors are all pre-existing / presentational and outside the 80+20 preset branch (see Known Survivors). The 80+20 preset threading (`p_overtime_minutes=20`) is proven killed by the unit tests and the Task-1 E2E body assertion.

No test-file edits were needed for Task 3 — Plans 09-02 and 09-03 already drove these files to the required scores, so the gate passed as-is.

## Verification Results

| Check | Result |
|-------|--------|
| `npx cypress run --spec cypress/e2e/timer-80-20.cy.js` | 5/5 passing |
| `npx cypress run --spec cypress/e2e/timer.cy.js` | 16/16 passing (10 original + 6 new) |
| `npx vitest run` (full suite) | 900/900 passing, 51 files |
| Stryker hooks (useCountdown, useStartTimer) | 100.00% (84 killed) |
| Stryker components (TimerDisplay, TimerControls, AdminControls) | 95.35% (164 killed, 8 survived) |

Cypress was run headlessly against the local Vite dev server (`http://localhost:5173`, the configured `baseUrl`). All specs executed and passed; nothing was stubbed or skipped.

## Known Survivors (AdminControls — documented equivalents / pre-existing)

All 8 survivors are outside the 80+20 preset branch and were already documented as untouched in 09-03:

| Line | Region | Nature |
|------|--------|--------|
| 75:48 | `roundIds = rounds?.map(...) ?? []` | Pre-existing PODG opponent-history default |
| 130:29 | `toast.success(\`Round ${roundCount + 1} generated!\`)` | Presentational toast message arithmetic |
| 150:9 | `handleEndEvent` `if (isEventEnded) return` | End Event guard (pre-existing) |
| 236:19 / 237:31 | generate-round-btn `disabled` / `title` | Pre-existing disabled-state styling |
| 257:19 (x2) | End Event btn `disabled={endEvent.isPending || isEventEnded}` | End Event button state (pre-existing) |

None affect the 80+20 logic. Killing them would require End-Event-disabled-state assertions out of scope for this plan; they are equivalent/presentational per the CLAUDE.md mutation guidance.

## Deviations from Plan

None — all 3 tasks executed as written. Task 3 found the hooks and components already at/above target from prior plans, so it served purely as a passing verification gate (no source/test edits).

## Requirements Closed

- **TEST-05** — E2E covers selecting + starting 80+20 and the main→overtime→count-up transitions; timer-critical hooks at 100% Stryker.
- **TIMER-07** (E2E half) — controls proven operable in overtime and count-up.

## Self-Check: PASSED
- FOUND: cypress/e2e/timer-80-20.cy.js
- FOUND: commit b7850e7 (Task 1)
- FOUND: commit 2e5b98d (Task 2)
