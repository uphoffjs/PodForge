# Phase 8: Timer Migration & Core Engine - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning
**Source:** Inline design sign-off (plan-phase)

<domain>
## Phase Boundary

Engine-level implementation of the 80+20 three-phase round timer. This phase makes the timer **correct and server-authoritative at the data + hook layer** — it does NOT build any UI.

In scope (TIMER-03, TIMER-05, TIMER-06):
- Additive migration `00005` to `round_timers` and the admin RPCs.
- Client-side three-phase derivation in `src/hooks/useCountdown.ts` (main countdown → overtime countdown → unbounded count-up).
- Dual-boundary browser-notification dedup in `src/hooks/useTimerNotification.ts`.
- Server-authoritative correctness across pause/resume, page refresh, and Realtime reconnect.

Explicitly OUT of scope (deferred to Phase 9):
- The "80+20" preset picker, the explicit admin "Start timer" action, phase-distinct `TimerDisplay` styling, control wiring in `TimerControls`/`AdminControls`, and Cypress E2E. These are TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05.
</domain>

<decisions>
## Implementation Decisions

### Clock model (LOCKED)
- Reuse the existing zero-config model: every time value is derived client-side from the absolute server timestamp `round_timers.expires_at` minus local `Date.now()`. The count-up phase uses the SAME model.
- Do NOT add a server-time offset / `now()` sync mechanism. The minor client-clock skew is identical to what the existing countdown already tolerates; not worth the added round-trip and tests.

### Extend semantics (LOCKED)
- `extend_timer` (+5 min) ALWAYS adds time to the underlying main `expires_at`, shifting every phase boundary (main→overtime→count-up) later by the same amount — one behavior in all three phases.
- During count-up, +5 therefore pulls the displayed time back toward overtime. No per-phase branching; no disabling outside the main phase. (The control/UI is Phase 9; the engine + RPC must support this shift correctly.)

### Migration 00005 (LOCKED — additive, backward compatible)
- Add `overtime_seconds INTEGER NOT NULL DEFAULT 0` to `round_timers`. Plain (non-80+20) timers keep `overtime_seconds = 0` and behave exactly as today.
- `generate_round` gains a new `p_overtime_minutes` parameter (defaulted, backward compatible — mirrors how `p_timer_duration_minutes` was added in `00004`). For the 80+20 format it persists `overtime_seconds = 1200`.
- Remove the `GREATEST(0, …)` clamp in `pause_timer` so it stores the **signed** remaining value — this preserves overtime/count-up position across pause and also fixes a pre-existing plain-timer limitation. `resume_timer`, `extend_timer`, `cancel_timer` need no structural change beyond honoring signed remaining.

### Phase derivation (LOCKED)
- `useCountdown.ts` derives the phase purely on the client from `expires_at` + `overtime_seconds` + `Date.now()`:
  1. main: counts down to 0:00 (ends at `expires_at`)
  2. overtime: counts down `overtime_seconds` after `expires_at`
  3. count-up: increments `+M:SS` past the overtime end, indefinitely, until an admin acts
- No `phase` column and no server tick — phase is a pure function of two absolute server quantities plus the local clock, keeping it refresh/reconnect safe.

### Notifications (LOCKED)
- Fire a browser notification exactly once at EACH boundary: main→overtime, and overtime→count-up.
- De-duplicate per boundary (track the last-notified boundary/phase) so repeated Realtime row updates or re-renders don't re-fire.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing timer schema & RPCs
- `supabase/migrations/00004_timer_system.sql` — current `round_timers` schema and the `pause_timer` `GREATEST(0, …)` clamp that must be removed
- `src/hooks/useGenerateRound.ts` — `generate_round` RPC call to extend with `p_overtime_minutes`
- `src/hooks/useTimer.ts`, `usePauseTimer.ts`, `useResumeTimer.ts`, `useExtendTimer.ts`, `useCancelTimer.ts` — timer mutation hooks
- `src/types/database.ts` — `RoundTimer` type to extend with `overtime_seconds`

### Existing client timer logic (extend, do not rewrite)
- `src/hooks/useCountdown.ts` — already formats `+M:SS` for negative remaining and flags overtime; add the second (overtime) countdown segment here
- `src/hooks/useTimerNotification.ts` — existing 0:00 notification; becomes dual-boundary with dedup

### Research
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`
</canonical_refs>

<specifics>
## Specific Ideas

- 80+20 means `duration_minutes = 80` (main) and `overtime_seconds = 1200` (20 min) on `round_timers`.
- Target 100% Stryker mutation score on the new timer-engine branches (per TIMER success criteria + project test rules).
- Pitfall to design against (from PITFALLS.md): the current single-phase `isOvertime = remaining <= 0` cannot express three phases; and the `GREATEST(0,…)` clamp silently destroys signed position on resume.
</specifics>

<deferred>
## Deferred Ideas

All user-facing timer work is Phase 9: 80+20 preset picker, explicit admin "Start timer" action, phase-distinct `TimerDisplay` labels/colors, `TimerControls`/`AdminControls` wiring, and Cypress E2E (TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05).
</deferred>

---

*Phase: 08-timer-migration-core-engine*
*Context gathered: 2026-06-27 via inline design sign-off*
