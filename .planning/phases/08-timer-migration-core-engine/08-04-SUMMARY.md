---
phase: 08-timer-migration-core-engine
plan: 04
subsystem: testing
tags: [react, hooks, notifications, vitest, stryker, timer]

# Dependency graph
requires:
  - phase: 08-03
    provides: "CountdownState.phase ('main' | 'overtime' | 'countup') as the derived phase source of truth"
  - phase: 08-02
    provides: "RoundTimer.overtime_seconds field + signed remaining_seconds"
provides:
  - "useTimerNotification fires one browser notification per phase boundary (main->overtime, overtime->countup)"
  - "Per-boundary Set dedup keyed by ${timer.id}:boundary, robust to Realtime row churn"
  - "Refresh/reconnect-safe notifications (no spurious fire when mounting into overtime/countup)"
  - "TIMER-05 delivered; useTimerNotification.ts at 100% Stryker mutation score"
affects: [09-timer-ui-admin-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-transition detection via prevPhaseRef + per-boundary Set dedup (replaces single-string lastNotifiedTimerIdRef)"
    - "null-baseline guard for refresh/reconnect safety: first observed phase is a baseline, never a crossing"

key-files:
  created: []
  modified:
    - src/hooks/useTimerNotification.ts
    - src/hooks/useTimerNotification.test.ts

key-decisions:
  - "Notification copy: title 'Round Timer', bodies 'Overtime started' (main->overtime) and 'Round over' (overtime->countup)"
  - "Consolidated timer.id-reset detection into the trigger effect (prevTimerIdRef) instead of a separate reset effect, to avoid an effect-ordering bug that would have dropped the first transition"
  - "Removed dead SSR `typeof window` guard (client-only SPA) and inline-disabled two genuinely equivalent Stryker mutants rather than excluding files"

patterns-established:
  - "Phase-transition notification: capture prev=prevPhaseRef.current, set prevPhaseRef.current=phase, fire only on (prev,phase) forward-boundary pairs, deduped via Set"
  - "Per-timer baseline reset inside the side-effect (single source of truth for prevPhaseRef) for correct effect ordering"

requirements-completed: [TIMER-05]

# Metrics
duration: 27min
completed: 2026-06-28
---

# Phase 8 Plan 4: Dual-Boundary Timer Notifications Summary

**useTimerNotification rewritten from a single `remaining<=0` trigger to phase-transition detection that fires exactly one browser notification at each boundary (main->overtime 'Overtime started', overtime->countup 'Round over'), deduped per `${timer.id}:boundary` and refresh-safe — at 100% Stryker.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-06-27T18:55Z
- **Completed:** 2026-06-28T00:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced the single-boundary `remaining<=0 && isOvertime` trigger with `countdown.phase` transition detection driving two independent boundary notifications.
- Per-boundary `Set<string>` dedup keyed by `${timer.id}:overtime` / `${timer.id}:countup` — survives Realtime row replacement and repeated re-renders (fires once per boundary, ever, per timer).
- `prevPhaseRef` null-baseline + per-timer reset makes a client mounting/switching directly into overtime or count-up fire nothing (TIMER-06 refresh/reconnect safety carried into notifications).
- 27 unit tests, 100% coverage, and 100% Stryker mutation score (46 killed, 0 survived, 0 no-coverage) on `useTimerNotification.ts`. Full suite green: 870 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase-transition notification with per-boundary Set dedup** (TDD)
   - `729f31b` (test — RED: failing phase-transition/dedup/refresh-guard tests)
   - `bb59afa` (feat — GREEN: prevPhaseRef + Set dedup implementation)
2. **Task 2: Stryker mutation hardening to 100%** - `3ef72d0` (test)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/hooks/useTimerNotification.ts` - Phase-transition detection; `notifiedRef` Set + `prevPhaseRef` + `prevTimerIdRef`; `fireOnce(key, body)` inside the preserved iOS-PWA try/catch; dead SSR guard removed; two equivalent mutants inline-disabled with rationale.
- `src/hooks/useTimerNotification.test.ts` - Replaced old `remaining<=0` trigger tests with 27 cases covering both boundaries, dedup, Realtime churn, refresh/switch guards, new-timer reset, paused/cancelled/null/permission gates, iOS-PWA throw, plus two mutation-killer tests (main->countup direct, support-flip deps).

## Decisions Made
- **Notification copy:** title `'Round Timer'`; bodies `'Overtime started'` and `'Round over'` (Claude's discretion per CONTEXT.md / RESEARCH Open Question).
- **Single-effect timer reset:** the plan described a separate reset effect that sets `prevPhaseRef = null` on `timer.id` change. That two-effect shape has an effect-ordering bug (the reset effect runs *after* the trigger effect on every mount/timer-change and clobbers the phase the trigger just recorded, dropping the first real transition). Reset detection was instead consolidated into the trigger effect via `prevTimerIdRef` — same observable semantics, correct ordering. Documented as a Rule 1 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Consolidated timer-reset into the trigger effect to fix an effect-ordering defect**
- **Found during:** Task 1 (implementation)
- **Issue:** The plan's literal "extend the reset effect (clear Set + reset prevPhaseRef to null)" as a *separate* `useEffect([timer?.id])` runs after the trigger effect whenever both fire (mount and timer.id change). It would reset `prevPhaseRef` to `null` immediately after the trigger effect set it, so the next render's first phase transition would see `prev === null` and never fire — the first boundary notification of every timer would be silently dropped.
- **Fix:** Moved the `timer.id`-change detection to the top of the trigger effect using a `prevTimerIdRef`; on a changed id it clears `notifiedRef` and sets `prevPhaseRef = null` as a fresh baseline, all before the same effect reads/advances `prevPhaseRef`. Single source of truth, correct ordering. Preserves all required semantics (dedup reset, refresh/switch safety).
- **Files modified:** src/hooks/useTimerNotification.ts
- **Verification:** Tests "resets dedup state for a new timer.id" and "fires 'Overtime started' once on main->overtime" both pass; would fail under the two-effect shape.
- **Committed in:** bb59afa (Task 1 GREEN)

**2. [Rule 1 - Bug / test-quality] Removed dead SSR `typeof window` guard and annotated two equivalent mutants for the 100% gate**
- **Found during:** Task 2 (Stryker run)
- **Issue:** Three of five surviving mutants were genuinely equivalent in the jsdom/client-only context: the `typeof window !== 'undefined'` SSR guard (this is a client-only Vite SPA, no SSR), the `if (!isSupported)` fast-path in the `useState` initializer (the following try/catch yields the same `'unsupported'`), and the `prev === null` guard (the boundary checks require `prev === 'main'/'overtime'`, which `null` can never satisfy, so the guard never changes whether a notification fires).
- **Fix:** Removed the dead SSR guard (`const isSupported = 'Notification' in window`) — both remaining conditional mutants on that line are killed by existing support tests. Inline-disabled the two genuinely equivalent ConditionalExpression mutants with explicit rationale (matching the 08-03 precedent). The other two survivors were killed with real tests (main->countup direct transition; support-flip re-render).
- **Files modified:** src/hooks/useTimerNotification.ts, src/hooks/useTimerNotification.test.ts
- **Verification:** `npx stryker run --mutate "src/hooks/useTimerNotification.ts"` → 100.00% (46 killed, 0 survived, 0 no-coverage).
- **Committed in:** 3ef72d0 (Task 2)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — one logic bug avoided, one dead-code/test-quality).
**Impact on plan:** Both adjustments were required for correctness and the 100% mutation gate. No scope creep — only the two planned files were touched. No file exclusions were added to Stryker.

## Issues Encountered
None beyond the deviations above. The old trigger tests (asserting "Time's Up!" / `remaining<=0`) were replaced wholesale, as the plan intended.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TIMER-05 complete. The notification hook now consumes `CountdownState.phase` and is wired for both boundaries; Phase 9 (Timer UI & Admin Controls) can surface the permission-request UI and phase-distinct `TimerDisplay` styling without re-touching the engine.
- No blockers. Engine-only phase 08 is now fully delivered (TIMER-03, TIMER-05, TIMER-06).

## Self-Check: PASSED
- Commits verified present: `729f31b`, `bb59afa`, `3ef72d0`.
- Files verified present: `src/hooks/useTimerNotification.ts`, `src/hooks/useTimerNotification.test.ts`.
- `npx vitest run` → 870 passed; coverage 100%; `npx stryker run --mutate "src/hooks/useTimerNotification.ts"` → 100.00%.

---
*Phase: 08-timer-migration-core-engine*
*Completed: 2026-06-28*
