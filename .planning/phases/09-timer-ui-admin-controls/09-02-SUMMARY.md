---
phase: 09-timer-ui-admin-controls
plan: 02
subsystem: timer-client-data-layer
tags: [timer, hooks, pending, mutation, stryker]
requires:
  - "migration 00006 (09-01): 'pending' status, start_timer RPC, cancel widened to pending"
provides:
  - "RoundTimer.status union includes 'pending'"
  - "useTimer fetches pending (not-started) rows"
  - "useCountdown not-started static state (phase='not-started')"
  - "useStartTimer passphrase-gated mutation hook"
affects:
  - "Plan 09-03 UI components (TimerDisplay/TimerControls/AdminControls) build on these hooks/types"
tech-stack:
  added: []
  patterns:
    - "early-return BEFORE derivePhase to preserve 100%-Stryker exhaustiveness of the phase engine"
    - "verbatim mutation-hook mirror (useStartTimer ← useResumeTimer)"
key-files:
  created:
    - src/hooks/useStartTimer.ts
    - src/hooks/useStartTimer.test.ts
  modified:
    - src/types/database.ts
    - src/hooks/useTimer.ts
    - src/hooks/useTimer.test.ts
    - src/hooks/useCountdown.ts
    - src/hooks/useCountdown.test.ts
decisions:
  - "Pending display derives from duration_minutes (not expires_at) — expires_at is a placeholder while pending"
  - "not-started branch placed AFTER the cancelled return-null guard and BEFORE derivePhase/phaseUrgency so those stay untouched and exhaustive"
metrics:
  duration: ~25min
  completed: 2026-06-28
---

# Phase 09 Plan 02: Client Data Layer (pending-aware types/query/countdown + useStartTimer) Summary

Surfaced the migration-00006 `pending` contract in the client: widened the `RoundTimer.status` union and the `useTimer` query filter, added a static `not-started` early-return to `useCountdown` (no interval, display from `duration_minutes`) that preserves the 100%-Stryker exhaustiveness of the existing three-phase engine, and added a verbatim-shape `useStartTimer` passphrase-gated mutation hook.

## What Was Built

### Task 1 — `useStartTimer` hook + 100%-Stryker test (commit 07db8bf)
- `src/hooks/useStartTimer.ts`: exact-shape mirror of `useResumeTimer` with three swaps — function name, RPC name (`start_timer`), and generic error string (`'Failed to start timer'`). Calls `supabase.rpc('start_timer', { p_event_id: eventId, p_passphrase: passphrase })`, throws on error, invalidates `['timer', eventId]` on success, maps `'invalid passphrase'` → `toast.error('Invalid passphrase')` else generic.
- `src/hooks/useStartTimer.test.ts`: 5-case mirror of `useResumeTimer.test.ts` (rpc args, invalidation spy, no success toast, invalid-passphrase toast, generic-failure toast).

### Task 2 — pending types/query + useCountdown not-started branch (commit 52c5343)
- `src/types/database.ts`: `RoundTimer.status` → `'running' | 'paused' | 'cancelled' | 'pending'`.
- `src/hooks/useTimer.ts`: filter widened to `.in('status', ['running', 'paused', 'pending'])`.
- `src/hooks/useCountdown.ts`: `CountdownState['phase']` extended with `'not-started'`; render-time short-circuit for `status === 'pending'` returning a static state (`remainingSeconds: duration_minutes*60`, `display: '{duration_minutes}:00'`, `phase: 'not-started'`, `urgency: 'normal'`, all flags false). Placed after the cancelled guard and before `derivePhase` — `derivePhase`/`phaseUrgency` source untouched.
- `src/hooks/useCountdown.test.ts`: +5 cases (static 80:00 state, duration-not-expires_at derivation, no setInterval, display unchanged on fake-timer advance, running-80+20 regression).
- `src/hooks/useTimer.test.ts`: filter assertion updated to include `'pending'`.

## Verification
- `npx tsc --noEmit`: clean.
- `npx vitest run`: full suite green (880 tests; the single pre-update `useTimer` filter assertion was updated to match the widened filter).
- Stryker `useCountdown.ts`: 100.00% (66 killed, 0 survived).
- Stryker `useStartTimer.ts`: 100.00% (18 killed, 0 survived).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated useTimer filter assertion to match widened query**
- **Found during:** Task 2 (full-suite run)
- **Issue:** `src/hooks/useTimer.test.ts:102` asserted the old `['running', 'paused']` filter, failing once the query was widened to include `'pending'`.
- **Fix:** Updated the assertion to `['running', 'paused', 'pending']` — a directly-caused, in-scope consequence of the planned filter change.
- **Files modified:** src/hooks/useTimer.test.ts
- **Commit:** 52c5343

## Authentication Gates
None.

## Known Stubs
None. The not-started static state is intentional final behavior (a generated-but-not-started round has no live clock); it is not a placeholder.

## Self-Check: PASSED
- FOUND: src/hooks/useStartTimer.ts
- FOUND: src/hooks/useStartTimer.test.ts
- FOUND commit 07db8bf (Task 1)
- FOUND commit 52c5343 (Task 2)
