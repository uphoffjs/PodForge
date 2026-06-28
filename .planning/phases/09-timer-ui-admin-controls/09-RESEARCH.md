# Phase 9: Timer UI & Admin Controls - Research

**Researched:** 2026-06-28
**Domain:** React/Vite client surfacing a server-authoritative Postgres timer (Supabase RPC + Realtime), Tailwind v4 `@theme`, TanStack Query, Vitest + Stryker, Cypress E2E
**Confidence:** HIGH (all findings verified against the in-repo migration/component/hook source — no external library guesswork required)

## Summary

Phase 8 shipped the entire three-phase 80+20 engine: the `overtime_seconds` column (`supabase/migrations/00005_timer_overtime.sql:12-13`), signed `pause_timer` (`00005:171-178`), and `useCountdown`'s `phase: 'main' | 'overtime' | 'countup'` derivation (`src/hooks/useCountdown.ts:43-62,116`). Phase 9 is a pure **UI + one small additive migration** layer: a 4th duration preset, an explicit Start action backed by a new not-started timer state, phase-keyed band styling on `TimerDisplay`, controls working in all three phases, and tests. Zero new runtime dependencies. [VERIFIED: in-repo source read 2026-06-28]

The one genuine architecture decision — how to represent a "not-started" 80+20 timer so the main countdown begins only on explicit Start — is resolved below in favor of **Option (a): a new `'pending'` timer status set at generation and flipped to `'running'` by a new `start_timer` RPC** (migration `00006`). It is the smallest change that stays *server-authoritative and persistent* (survives refresh + multi-device), keeps `expires_at` `NOT NULL` (no nullable migration), and avoids the not-started/paused ambiguity that sinks the pre-paused alternative.

**Primary recommendation:** Add migration `00006`: extend the `status` CHECK to include `'pending'`, make `generate_round` insert `status = 'pending'` when `p_overtime_minutes > 0` (else `'running'`, unchanged), and add a passphrase-gated `start_timer(p_event_id, p_passphrase)` RPC that sets `started_at = now()`, `expires_at = now() + duration_minutes`, `status = 'running'`. Surface it with a `useStartTimer` hook (mirror `useResumeTimer`), a `not-started` branch in `useCountdown` (the 100%-Stryker engine), a phase-first band map in `TimerDisplay`, a `'pending'` branch + Start button in `TimerControls`, an `80+20` chip in `AdminControls` that finally threads `overtimeMinutes`, and intercept-based Cypress specs that mount each phase via computed `expires_at`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Not-started" state persistence | Database (`round_timers.status='pending'`) | — | Must survive refresh and be visible to all devices → cannot live in React state. Server-authoritative model (`00004`/`00005`) owns timer lifecycle. |
| Start / pause / resume / +5 / cancel | Database RPC (SECURITY DEFINER, passphrase-gated) | API hook (mutation) | All existing timer mutations are RPCs (`00004:145-336`); Start joins them. Client only invalidates the `['timer']` query. |
| Phase derivation (main/overtime/countup/not-started) | Browser/Client (`useCountdown`) | — | Locked decision: client derives from `expires_at + overtime_seconds + Date.now()` (no server-time sync). `00005`/`08-03` already established this. |
| Phase-distinct band styling + labels | Browser/Client (`TimerDisplay`) | — | Pure presentational mapping off `countdown.phase`. |
| Preset selection + routing durations | Browser/Client (`AdminControls`) | API hook (`useGenerateRound`) | Picker state is local; durations route into the existing `generate_round` RPC params. |
| Realtime phase sync to all clients (TIMER-04) | Database (Realtime publication) | Client (`useEventChannel`) | `round_timers` already in `supabase_realtime` with `REPLICA IDENTITY FULL` (`00004:35,41`); `pending→running` row update broadcasts automatically. No new work. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x (in repo) | Component layer | Already the project stack [VERIFIED: in-repo] |
| @tanstack/react-query | in repo | Timer query + mutations | All timer hooks already use it (`useResumeTimer.ts:1`) |
| @supabase/supabase-js | in repo | RPC + Realtime | All timer RPCs go through `supabase.rpc(...)` (`useGenerateRound.ts:23`) |
| lucide-react | in repo | Icons (`Play` for Start) | UI-SPEC line 134 specifies `Play` [CITED: 09-UI-SPEC.md] |
| sonner | in repo | Toast errors | Existing mutation error pattern (`useResumeTimer.ts:24-32`) |
| tailwindcss | v4 `@theme` | Band tokens | `src/app.css` token system [CITED: 09-UI-SPEC.md:14] |

### Supporting (test)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | in repo | Unit/integration | `useCountdown`, `useStartTimer`, `TimerDisplay`, `AdminControls` |
| @stryker-mutator/* | in repo | Mutation testing | 100% on timer logic per CLAUDE.md + TEST-05 |
| cypress | in repo | E2E | TEST-05: select/start/transition specs |

**No new packages required.** All work uses libraries already in `package.json`. No `npm install`, no Package Legitimacy Audit needed (zero external installs).

## The Not-Started Representation Decision (RESOLVED)

**Recommendation: Option (a) — new `'pending'` status. Migration `00006` required.**

### Why (a) over (b) and (c)

| Option | Server-authoritative + persistent? | Distinguishes not-started vs paused cleanly? | Schema cost | Verdict |
|--------|-------------------------------------|----------------------------------------------|-------------|---------|
| (a) `'pending'` status | ✅ row exists, survives refresh, multi-device, Realtime-synced | ✅ explicit status, self-documenting | CHECK change + 1 new RPC + 1 conditional line | **CHOSEN** |
| (b) pre-paused (Start = resume) | ✅ row exists | ❌ a not-started timer and a genuinely-paused-with-full-time timer are both `status='paused'`; only fragile heuristics (`remaining === duration*60`) separate them → pollutes `READY TO START` vs `PAUSED` labels and Start vs Resume button. Brittle in a 100%-Stryker codebase. | Smallest SQL, but ambiguous | Rejected |
| (c) defer timer creation | ❌ **no row until Start** → the "READY TO START 80:00" card has no server state to render; intended durations live only in the generating admin's React state (lost on refresh, invisible to other devices); `start_timer` has no row/durations to act on without a new `rounds` column | n/a | Not actually smaller (needs a place to stash intended durations) and breaks the locked server-authoritative model | Rejected |

Option (c) directly contradicts UI-SPEC §3 ("the not-started timer card") and the locked "server-authoritative … no server-time sync" model — the not-started card must be a real persisted row. Option (b) is the smallest SQL but its not-started/paused ambiguity is exactly the fragility CONTEXT flagged as the open question. Option (a) is the smallest **correct** additive change.

### Migration `00006_timer_pending.sql` — concrete impact

1. **Extend the status CHECK** (default constraint name `round_timers_status_check`; verify with `\d round_timers`):
   ```sql
   ALTER TABLE round_timers DROP CONSTRAINT round_timers_status_check;
   ALTER TABLE round_timers ADD CONSTRAINT round_timers_status_check
     CHECK (status IN ('running', 'paused', 'cancelled', 'pending'));
   ```
   [VERIFIED: original CHECK at `00004:13`]

2. **Modify `generate_round`** (CREATE OR REPLACE — signature identical to `00005:28-34`, so no DROP/overload concern):
   - The pre-insert cancel sweep must also cancel a prior un-started pending timer:
     change `00005:94-95` `status IN ('running','paused')` → `status IN ('running','paused','pending')`.
   - Insert with a conditional status:
     ```sql
     INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, status, expires_at)
     VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
             COALESCE(p_overtime_minutes,0)*60,
             CASE WHEN COALESCE(p_overtime_minutes,0) > 0 THEN 'pending' ELSE 'running' END,
             now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
     ```
   - `expires_at` stays `NOT NULL` — the inserted value is a harmless placeholder while pending (the not-started card renders a STATIC `duration_minutes:00`, never reading `expires_at`); `start_timer` overwrites it. **No nullable-column migration needed.**
   - Discriminator is `p_overtime_minutes > 0` (i.e. the 80+20 flow). Plain 60/90/120 keep today's immediate-start behavior. (Alternative: add an explicit `p_deferred BOOLEAN` param for future-proofing if configurable overtime ever ships — deferred per CONTEXT, so not recommended now.)

3. **New `start_timer` RPC** (mirror the `00004` SECURITY DEFINER + passphrase pattern):
   ```sql
   CREATE FUNCTION start_timer(p_event_id UUID, p_passphrase TEXT) RETURNS VOID ...
   -- validate passphrase (copy 00004:159-169)
   -- find latest pending timer for event (status='pending', ORDER BY created_at DESC LIMIT 1)
   -- if none: RAISE EXCEPTION 'No pending timer found';
   UPDATE round_timers
     SET started_at = now(),
         expires_at = now() + (duration_minutes || ' minutes')::INTERVAL,
         status = 'running'
     WHERE id = v_timer_id;
   ```
   `overtime_seconds` unchanged. `resume_timer`/`extend_timer`/`cancel_timer`/`pause_timer` need **no change**.

### Client impact of `'pending'`

| File | Change |
|------|--------|
| `src/hooks/useTimer.ts:13` | Widen filter `.in('status', ['running','paused'])` → `['running','paused','pending']` so the not-started row is fetched. |
| `src/types/database.ts:42` | `status` union add `'pending'`. |
| `src/hooks/useCountdown.ts` | Add a `not-started` branch: when `timer.status === 'pending'`, return a static state (`display = '${duration_minutes}:00'`, no `setInterval`, `phase: 'not-started'`, `isPaused: false`). Extend `CountdownState['phase']` union to include `'not-started'`. This is the **100% Stryker target** — see Validation. |
| `src/pages/EventPage.tsx:238` | Existing guard `timer && timer.status !== 'cancelled'` already lets `pending` through — no change. |
| `src/components/TimerControls.tsx:34` | Add a `pending` branch: render only the **Start Timer** button (and optionally Cancel), not pause/resume/+5. |
| `src/components/TimerDisplay.tsx` | Render the not-started card (see UI-SPEC §3 / band table). |
| new `src/hooks/useStartTimer.ts` | Mirror `useResumeTimer.ts` exactly: `supabase.rpc('start_timer', {p_event_id, p_passphrase})`, invalidate `['timer', eventId]`, sonner error mapping. |

## Architecture Patterns

### System Data Flow (Start path)
```
Admin selects "80+20" chip (AdminControls, local state: duration=80, overtime=20)
        │
        ▼  click Generate Next Round
generateRound.mutate({timerDurationMinutes:80, overtimeMinutes:20})  ── useGenerateRound
        │  supabase.rpc('generate_round', {... p_overtime_minutes:20})
        ▼
generate_round (00006): inserts round_timers row status='pending', overtime_seconds=1200
        │  Realtime broadcast (round_timers REPLICA IDENTITY FULL)
        ▼
useTimer query (now includes 'pending') → EventPage renders TimerDisplay (not-started card: "80:00 / READY TO START")
        │                                              + TimerControls pending-branch → "Start Timer" btn
        ▼  admin click timer-start-btn
useStartTimer.mutate({passphrase}) → rpc('start_timer')
        │
        ▼
start_timer (00006): status='running', expires_at=now()+80min, started_at=now()
        │  Realtime broadcast
        ▼
useCountdown ticks from expires_at → phase main→(─10m warning)→(─5m danger)→overtime(amber)→countup(red pulse)
        │  every client derives identically from expires_at + overtime_seconds + Date.now()
        ▼
TimerDisplay band keyed by countdown.phase (main falls back to urgency); useTimerNotification fires at each boundary (08-04)
```

### Pattern 1: Phase-first band selection in `TimerDisplay`
**What:** Replace the single `urgencyStyles[countdown.urgency]` lookup (`TimerDisplay.tsx:30`) with a phase-keyed map; only `main` falls back to the urgency progression.
**When:** Core of TIMER-04.
**Example (target shape):**
```tsx
// Source: derived from 09-UI-SPEC.md:103-114 band table
const phaseBands = {
  'not-started': 'bg-surface-raised text-text-secondary border-border',
  overtime: 'bg-accent/15 text-accent-bright border-accent',
  countup: 'bg-red-900/50 text-red-300 border-red-500 animate-pulse',
} as const
const band = countdown.phase === 'main'
  ? urgencyStyles[countdown.urgency]          // KEEP existing progression (no regression)
  : phaseBands[countdown.phase]
const dimmed = countdown.isPaused ? 'opacity-70' : ''
// <div data-testid="timer-display" data-phase={countdown.phase} className={`... ${band} ${dimmed}`}>
const statusLabel = countdown.isPaused ? 'PAUSED'
  : countdown.phase === 'not-started' ? 'READY TO START'
  : countdown.phase === 'overtime' ? 'OVERTIME'
  : countdown.phase === 'countup' ? 'OVERRUN'
  : 'ROUND TIMER'
```
Add `data-phase={countdown.phase}` to the `timer-display` element (UI-SPEC:105) — it is the clean E2E hook for phase assertions.

### Pattern 2: Preset model in `AdminControls` (must thread overtime)
**What:** Today `selectedDuration` is a lone `number | null` (`AdminControls.tsx:56`) and `handleGenerateRound` passes only `timerDurationMinutes` (`:110`) — `overtimeMinutes` is **never threaded** even though `useGenerateRound` and the RPC support it (`useGenerateRound.ts:22-29`, `00005:33`). Phase 9 must fix this.
**Recommended:** model presets as objects and store the selected one:
```tsx
const PRESETS = [
  { id: 60, label: '60 min', duration: 60, overtime: 0 },
  { id: 90, label: '90 min', duration: 90, overtime: 0 },
  { id: 120, label: '120 min', duration: 120, overtime: 0 },
  { id: '80-20', label: '80+20', duration: 80, overtime: 20 },
] as const
// data-testid={`timer-duration-${p.id}`} → yields timer-duration-80-20 (UI-SPEC:129)
generateRound.mutate({ passphrase, podAssignments,
  timerDurationMinutes: sel?.duration, overtimeMinutes: sel?.overtime ?? 0 })
```
Keeps `data-testid="timer-duration-60/90/120"` stable (existing `generate-round.cy.js` assertions) and adds `timer-duration-80-20`.

### Anti-Patterns to Avoid
- **Keying the whole card off `urgency`** (current `TimerDisplay.tsx:30`): UI-SPEC:32 explicitly forbids this for Phase 9 — select by `phase` first.
- **Distinguishing not-started via `remaining_seconds === duration*60` heuristics** (the pre-paused trap): rejected — use the explicit `'pending'` status.
- **Putting the Start button in `AdminControls`** instead of on the timer card: Start operates on the persisted pending row (server state), like pause/resume/cancel — it belongs in `TimerControls` (UI-SPEC:136 places it on/adjacent to the not-started card).
- **Auto-starting the 80+20 timer at generation**: violates TIMER-02 — `generate_round` must insert `pending`, not `running`, when overtime > 0.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clock skew / server-time sync | A server-time offset fetch | `expires_at + overtime_seconds + Date.now()` client derivation (`useCountdown.ts:21-27,43-55`) | Locked decision; engine already ships this. |
| Start = re-deriving expires | New expiry math in client | `start_timer` RPC computes `now()+duration` server-side | Server-authoritative; matches `resume_timer` pattern (`00004:230-237`). |
| Pause/resume/+5/cancel in overtime/countup | Per-phase mutation variants | Existing RPCs — signed `remaining_seconds` already preserves overtime/countup position (`00005:171-178`, `08-03`) | `00005` made these phase-agnostic; TimerControls just needs the `pending` branch added. |
| Passphrase error UX | New modal flow | `INVALID_PASSPHRASE_RETRY_MESSAGE` + `onPassphraseNeeded` (`TimerControls.tsx:38-42`) | Established pattern. |
| Realtime phase fan-out | Manual polling | `round_timers` already published with `REPLICA IDENTITY FULL` (`00004:35,41`) | `pending→running` update auto-broadcasts → TIMER-04 "synced to all clients" is free. |

**Key insight:** Phase 8 deliberately made the engine phase-agnostic and signed so Phase 9 is almost entirely presentational. The only new server primitive is the not-started lifecycle (`pending` + `start_timer`); everything else is reuse.

## Common Pitfalls

### Pitfall 1: `generate_round` cancel sweep misses prior pending timers
**What goes wrong:** Admin generates two 80+20 rounds without starting → two `pending` rows.
**Why:** Current sweep only cancels `('running','paused')` (`00005:94-95`).
**Avoid:** Add `'pending'` to that `IN` list in `00006`. `useTimer` already `ORDER BY created_at DESC LIMIT 1` masks it, but cancel it to keep state clean.

### Pitfall 2: `useCountdown` ticking the pending placeholder `expires_at`
**What goes wrong:** Pending row has a placeholder `expires_at`; if `useCountdown` computes from it, the not-started card shows a live countdown instead of static `80:00`.
**Avoid:** Short-circuit `status === 'pending'` at the top of `useCountdown` — static display from `duration_minutes`, no `setInterval`.

### Pitfall 3: Existing E2E label assertion breaks on `ROUND TIMER`
**What goes wrong:** `timer.cy.js:104` asserts `timer-status` contains `'Round Timer'`; UI-SPEC:159 pins label `ROUND TIMER`. `.should('contain', ...)` is case-sensitive on text content.
**Avoid:** Either keep the literal `Round Timer` (CSS already uppercases it visually, satisfying both) or update `timer.cy.js:104` in the same plan. Pick one explicitly.

### Pitfall 4: CHECK constraint name assumption
**What goes wrong:** `DROP CONSTRAINT round_timers_status_check` fails if the auto-name differs.
**Avoid:** Confirm with `\d round_timers` (default Postgres name is `round_timers_status_check`, almost certainly correct since `00004` used an inline unnamed CHECK).

### Pitfall 5: `phaseUrgency`/Stryker regression on `useCountdown`
**What goes wrong:** Adding a `'not-started'` phase widens the `phase` union; `phaseUrgency` (`useCountdown.ts:58-62`) and `derivePhase` must stay exhaustive or a mutant survives.
**Avoid:** Handle `not-started` before `derivePhase` is reached (early return), keeping `derivePhase`'s 3-way logic untouched and 100%-covered.

## Runtime State Inventory

> This is a UI + additive-migration phase. No rename/data migration of existing rows.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `round_timers` rows backfill `overtime_seconds=0` (done in `00005:13`). No existing row uses `pending`. New `pending` rows only created going forward. | None (additive) |
| Live service config | Supabase Realtime publication already includes `round_timers` (`00004:41`) — `pending→running` updates ride it. | None |
| OS-registered state | None | None — verified (web app, no OS registration) |
| Secrets/env vars | Passphrase flow reused unchanged (`start_timer` validates like `00004:159-169`). | None |
| Build artifacts | New migration `00006` must be applied to the live DB before client deploy (same ordering rule Phase 8 followed: migration lands first). | Apply `00006`; regenerate `src/types/database.ts` status union manually |

## Code Examples

### `useStartTimer` (mirror `useResumeTimer.ts`)
```typescript
// Source: pattern from src/hooks/useResumeTimer.ts:9-33
export function useStartTimer(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ passphrase }: { passphrase: string }) => {
      const { error } = await supabase.rpc('start_timer', {
        p_event_id: eventId, p_passphrase: passphrase,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timer', eventId] }),
    onError: (error: Error) =>
      toast.error(error.message.toLowerCase().includes('invalid passphrase')
        ? 'Invalid passphrase' : 'Failed to start timer'),
  })
}
```

### Cypress: assert a phase via computed `expires_at` (existing pattern)
```javascript
// Source: pattern from cypress/e2e/timer.cy.js:95-99
// Overtime phase: main expired 60s ago, 1200s overtime remaining
const overtimeTimer = { ...base, status: 'running', overtime_seconds: 1200,
  expires_at: new Date(Date.now() - 60 * 1000).toISOString() }
setupTimerPage({ timer: overtimeTimer })
cy.getByTestId('timer-display').should('have.attr', 'data-phase', 'overtime')
cy.getByTestId('timer-status').should('contain', 'OVERTIME')
```

## State of the Art

| Old (Phase 8 baseline) | Phase 9 | Impact |
|--------------------------|---------|--------|
| `status IN ('running','paused','cancelled')` | + `'pending'` | Not-started lifecycle |
| `TimerDisplay` keyed off `urgency` only | keyed off `phase`, `main`→urgency fallback | TIMER-04 |
| `AdminControls` passes only `timerDurationMinutes` | also passes `overtimeMinutes` | TIMER-01 (closes a real gap at `AdminControls.tsx:110`) |
| Timer auto-starts at generation | 80+20 starts on explicit `start_timer` | TIMER-02 |

**Deprecated/outdated:** none — all Phase 8 engine code is current and reused.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CHECK constraint is named `round_timers_status_check` | Migration 00006 | Migration step errors; fix by reading `\d round_timers` — low risk, easily verified pre-apply |
| A2 | `p_overtime_minutes > 0` is a safe proxy for "explicit-start flow" | generate_round conditional | If a future plain timer ever wants overtime>0 with auto-start, would need an explicit param. CONTEXT defers configurable overtime, so safe now. |
| A3 | Non-admin players should also see the `READY TO START` card | not-started rendering | If undesired, gate the card render to admin in EventPage. UI-SPEC implies all viewers see the timer card. |

## Open Questions

1. **`ROUND TIMER` vs `Round Timer` literal** — UI-SPEC pins `ROUND TIMER` (uppercased anyway by CSS). Recommendation: keep `Round Timer` literal to avoid touching `timer.cy.js:104`, OR change literal and update that line. Planner picks one.
2. **Start button: also offer Cancel on the not-started card?** Admin may generate the wrong round before starting. Recommendation: render Start + Cancel in the `pending` branch of `TimerControls` (Cancel RPC already handles only running/paused — would need `'pending'` added to `cancel_timer`'s `IN` list if Cancel-while-pending is wanted). Flag for planner; default to Start-only to keep `cancel_timer` untouched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres + Realtime) | All timer RPCs | ✓ (live, Phase 8 applied 00005) | — | — |
| Vitest | Unit/integration | ✓ in repo | — | — |
| Cypress | E2E (TEST-05) | ✓ in repo | — | — |
| Stryker | Mutation gate | ✓ in repo | — | — |

No missing dependencies. Migration `00006` must be applied to the live DB before client deploy (engine-first ordering).

## Validation Architecture

> nyquist_validation key absent from `.planning/config.json` → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit/integration) + Cypress (E2E) + Stryker (mutation) |
| Config file | `vitest.config.*`, `cypress.config.*`, `stryker.config.mjs` (all in repo) |
| Quick run command | `npx vitest run src/hooks/useCountdown.test.ts src/hooks/useStartTimer.test.ts` |
| Full suite command | `npx vitest run` (870+ tests green at Phase 8 close) then `npx cypress run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIMER-01 | 80+20 chip routes duration=80, overtime=20 to mutate | component | `npx vitest run src/components/AdminControls.test.tsx` | ❌ Wave 0 (verify existing) |
| TIMER-02 | `pending` timer renders not-started card; Start fires `start_timer` | unit+e2e | `npx vitest run src/hooks/useStartTimer.test.ts` / `npx cypress run --spec cypress/e2e/timer-80-20.cy.js` | ❌ Wave 0 |
| TIMER-02 | `useCountdown` returns static `not-started` (no tick) for `status='pending'` | unit | `npx vitest run src/hooks/useCountdown.test.ts` | ✅ extend existing |
| TIMER-04 | `TimerDisplay` band/label per phase (main keeps urgency; overtime amber; countup red-pulse; data-phase) | component+e2e | `npx vitest run src/components/TimerDisplay.test.tsx` | ❌ Wave 0 (verify) |
| TIMER-07 | pause/resume/+5/cancel operate in main/overtime/countup | e2e | `npx cypress run --spec cypress/e2e/timer.cy.js` | ✅ extend with overtime/countup mounts |
| TEST-05 | three-phase engine + dedup notifications | unit | `npx vitest run src/hooks/useCountdown.test.ts src/hooks/useTimerNotification.test.ts` | ✅ exists (Phase 8) |

### Sampling Rate
- **Per task commit:** quick Vitest on the touched timer file(s).
- **Per wave merge:** `npx vitest run` full suite.
- **Phase gate:** full Vitest + Cypress green; **Stryker 100%** on `useCountdown.ts` and `useStartTimer.ts` (timer-critical per CLAUDE.md + TEST-05), ≥80% elsewhere.

### Wave 0 Gaps
- [ ] `cypress/e2e/timer-80-20.cy.js` — select 80+20, generate (assert RPC body `p_overtime_minutes=20`), render `pending` card, Start (assert `start_timer` RPC), and per-phase band/label via computed `expires_at`.
- [ ] `src/hooks/useStartTimer.test.ts` — mirror `useResumeTimer.test.ts` (success invalidates `['timer']`, error toast mapping). **100% Stryker.**
- [ ] Extend `src/hooks/useCountdown.test.ts` — `not-started` branch (static display, no interval, phase value). **Keep 100% Stryker.**
- [ ] Verify/extend `src/components/AdminControls.test.tsx` + `TimerDisplay.test.tsx` exist (none seen in `src/hooks` listing; confirm under `src/components`).
- [ ] Extend `cypress/e2e/timer.cy.js` controls tests with overtime + countup `expires_at` mounts (TIMER-07).

## Security Domain

> security_enforcement absent → enabled. This phase adds one RPC; threat surface is minimal and follows established controls.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `start_timer` is SECURITY DEFINER + passphrase-gated (`crypt(p_passphrase, v_hash)`), identical to `00004:159-169`. Admin-only Start enforced both client (EventPage isAdmin) and server (passphrase). |
| V5 Input Validation | yes | Overtime bounds already enforced in `generate_round` (`00005:51-53`); `start_timer` takes no numeric input. |
| V6 Cryptography | yes | Reuses `pgcrypto crypt()` passphrase hashing — never hand-rolled. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-admin starts/manipulates timer | Elevation of Privilege | Passphrase validation inside every RPC (server-side); client gating is convenience only |
| Replay/forged RPC body | Tampering | RPC validates event existence + passphrase hash before any mutation |

## Project Constraints (from CLAUDE.md)
- **UV for any Python** (N/A — no Python in this phase).
- **Vitest** unit/integration; tests in same PR as feature.
- **Cypress**: `data-testid` kebab-case selectors only; `cy.intercept()` not arbitrary `cy.wait(ms)`; no conditional DOM testing. (Existing `timer.cy.js` already conforms.)
- **Stryker ≥80%, 100% on critical timer logic** (`useCountdown`, `useStartTimer`); run after any test add/update; no `--mutate` exclusion gaming.
- **Conventional commits**, trunk-based: work on the v5.0 feature branch, PR to `main`.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00004_timer_system.sql` — schema, status CHECK, RPC patterns, Realtime publication
- `supabase/migrations/00005_timer_overtime.sql` — overtime_seconds, signed pause, generate_round signature
- `src/hooks/useCountdown.ts`, `useGenerateRound.ts`, `useResumeTimer.ts`, `useTimer.ts` — engine + mutation patterns
- `src/components/TimerDisplay.tsx`, `TimerControls.tsx`, `AdminControls.tsx`; `src/pages/EventPage.tsx` — wiring
- `src/types/database.ts` — RoundTimer shape
- `cypress/e2e/timer.cy.js`, `cypress/support/commands.js` — E2E intercept pattern
- `.planning/phases/09-timer-ui-admin-controls/09-CONTEXT.md`, `09-UI-SPEC.md`; `.planning/REQUIREMENTS.md`; `.planning/STATE.md`

### Secondary / Tertiary
- None required — fully verified against in-repo source.

## Metadata

**Confidence breakdown:**
- Not-started decision: HIGH — evaluated all three options against the actual schema/query/component constraints in-repo.
- Standard stack: HIGH — zero new deps; all in `package.json`.
- Architecture/pitfalls: HIGH — cited to exact file:line.

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable; in-repo source-derived)
