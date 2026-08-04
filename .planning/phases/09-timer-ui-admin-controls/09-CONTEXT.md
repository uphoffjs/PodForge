# Phase 9: Timer UI & Admin Controls - Context

**Gathered:** 2026-06-28
**Status:** Ready for UI-SPEC then planning
**Source:** Inline design sign-off (plan-phase)

<domain>
## Phase Boundary

The user-facing layer for the 80+20 timer. Phase 8 delivered the server-authoritative engine (migration `00005`, `RoundTimer.overtime_seconds`, signed pause, `useCountdown` three-phase derivation with a `phase` field, dual-boundary notifications). Phase 9 surfaces it.

In scope (TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05):
- 80+20 preset in the admin duration picker.
- An explicit admin "Start Timer" action (the 80-min countdown begins on Start, NOT at round generation).
- Phase-distinct visual treatment of main / overtime / count-up on the shared timer card.
- pause / resume / +5 / cancel working across all three phases.
- Unit/integration tests + Cypress E2E for selecting, starting, and the phase transitions.

Out of scope: the engine itself (done in Phase 8); mid-event join (Phase 10); fault-injection (Phase 11).
</domain>

<decisions>
## Implementation Decisions

### Start UX (LOCKED)
- A **separate "Start Timer" button** (distinct from "Generate Next Round"). Generating a round with 80+20 selected creates the timer in a **not-started** state; the admin presses Start when the table is ready, which begins the 80-minute main countdown. This decouples seating/setup time from the clock.
- The engine representation of "not-started" (e.g. a new status, a null `expires_at` until start, or a dedicated start RPC) is an OPEN architecture question for RESEARCH to resolve — Phase 8 added no not-started state. Prefer the smallest additive change consistent with the server-authoritative model.

### Preset (LOCKED)
- Add an **"80+20"** option to the existing duration picker alongside 60 / 90 / 120. Selecting it routes `overtimeMinutes = 20` (and main = 80) into `useGenerateRound` (already wired in Phase 8).

### Phase-distinct visuals (LOCKED intent, details for UI-SPEC)
- Each of the three phases (main / overtime / count-up) is a **flat, single distinct color** per phase, with a clear label per phase (e.g. main = neutral; overtime = amber + "OVERTIME"; count-up = red pulse + "OVERRUN" / "+M:SS"). The `phase` field from `useCountdown` is the source of truth.

### OPEN QUESTION for the UI-SPEC (must resolve before planning)
- **Existing-timer regression risk.** The current `TimerDisplay` shows a within-period urgency progression for plain 60/90/120 timers (`normal → warning` yellow <10m → `danger` red <5m → `expired` red-pulse). "Flat per-phase colors" as stated would remove that progression for the **main** phase, regressing existing plain timers. The UI-SPEC must decide one of:
  1. Flat color applies only to the NEW phases (overtime, count-up); the main phase keeps the existing within-period urgency progression (applies to both plain and 80+20 timers), OR
  2. Flat per-phase color replaces the urgency progression entirely for ALL timers (accepting the change to existing 60/90/120 behavior).
  Default recommendation: option 1 (no regression to shipped behavior) unless the user prefers a clean flat look everywhere.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before designing/planning or implementing.**

### Existing components to extend
- `src/components/TimerDisplay.tsx` — `urgencyStyles` map (normal/warning/danger/expired), existing "OVERTIME" label; add phase-distinct styling driven by `useCountdown().phase`
- `src/components/TimerControls.tsx` — pause/resume/+5/cancel buttons; must work in all three phases
- `src/components/AdminControls.tsx` — the 60/90/120 duration picker (add 80+20) and where the "Generate Next Round" button lives (add "Start Timer")
- `src/hooks/useCountdown.ts` — now returns `phase: 'main' | 'overtime' | 'countup'` (Phase 8)
- `src/hooks/useGenerateRound.ts` — already threads `overtimeMinutes → p_overtime_minutes`
- `src/hooks/usePauseTimer.ts` / `useResumeTimer.ts` / `useExtendTimer.ts` / `useCancelTimer.ts` — timer mutation hooks
- `supabase/migrations/00004_timer_system.sql` + `00005_timer_overtime.sql` — current timer schema/RPCs (relevant if a not-started state needs a small migration)

### Design system
- Established dark theme, amber/gold accent `#f59e0b`, mobile-first glanceable cards, `data-testid` kebab-case selectors, no slow animations (per PROJECT.md decisions)
</canonical_refs>

<specifics>
## Specific Ideas
- 80+20 = `duration_minutes 80` + `overtime_seconds 1200`.
- All admin actions stay gated by the existing passphrase flow (and the completed passphrase-error feedback loop).
- E2E (TEST-05) must cover: selecting 80+20, the explicit Start, and observing the main→overtime→count-up transitions/labels.
</specifics>

<deferred>
## Deferred Ideas
- Mid-event join UX (Phase 10), fault-injection campaign (Phase 11), configurable/custom overtime lengths (out of scope — fixed 80+20).
</deferred>

---

*Phase: 09-timer-ui-admin-controls*
*Context gathered: 2026-06-28 via inline design sign-off*
