# Phase 8: Timer Migration & Core Engine - Research

**Researched:** 2026-06-27
**Domain:** Server-authoritative three-phase (80+20) round timer — Postgres RPC migration + client-side phase derivation hooks (React 19 / Supabase / Vitest / Stryker)
**Confidence:** HIGH (grounded in first-party repo source — exact SQL, hook shapes, and test surface read line-by-line)

## Summary

This phase is an engine-only (no UI) implementation of the 80+20 three-phase timer. The work splits into three deterministic, low-risk pieces, all expressible with existing libraries and one additive migration:

1. **Migration `00005`** — add `overtime_seconds INTEGER NOT NULL DEFAULT 0` to `round_timers`; add `p_overtime_minutes INTEGER DEFAULT 0` to `generate_round` (persisting `overtime_seconds = p_overtime_minutes * 60`); and **remove the `GREATEST(0, …)` clamp** in `pause_timer` (`supabase/migrations/00004_timer_system.sql:185`) so a paused remaining value is **signed**. `resume_timer`, `extend_timer`, `cancel_timer` need **no structural change** — they already work correctly once the stored remaining is signed (verified below).

2. **`src/hooks/useCountdown.ts`** — derive all three phases purely client-side from two server quantities (`expires_at`, `overtime_seconds`) plus the local clock. The entire three-phase model collapses to a single signed `mainRemaining` plus `overtime_seconds`: `overtimeRemaining = mainRemaining + overtime_seconds`. This is the central insight that makes the migration minimal and makes pause/resume/refresh/reconnect correct "for free."

3. **`src/hooks/useTimerNotification.ts`** — replace the single `remaining <= 0 && isOvertime` trigger (`useTimerNotification.ts:46`) with **phase-transition detection** and **per-boundary dedup** (a `Set` of `${timer.id}:overtime` / `${timer.id}:countup`).

**Primary recommendation:** Model the three phases as `mainRemaining = (paused ? remaining_seconds : floor((expires_at - now)/1000))` and `overtimeRemaining = mainRemaining + overtime_seconds`; phase = `main` if `mainRemaining > 0`, else `overtime` if `overtimeRemaining > 0`, else `countup`. Removing the pause clamp is what makes signed `mainRemaining` survive pause. Drive notifications off detected phase transitions, never off `remaining <= 0`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist overtime length (1200s for 80+20) | Database (`round_timers.overtime_seconds`) | — | Server-authoritative; rides existing Realtime channel, no publication change |
| Compute `expires_at`, signed pause snapshot | API / Backend (RPCs) | — | All time math anchored on server `now()`; client never writes timer state |
| Derive current phase + display value | Browser / Client (`useCountdown.ts`) | — | Pure function of two server columns + local clock; refresh/reconnect safe |
| Fire per-boundary notifications | Browser / Client (`useTimerNotification.ts`) | — | Notifications are a client concern; dedup state is per-tab |
| Push timer row changes to all clients | Database Realtime → Client (`useEventChannel.ts`) | — | Already subscribed on `round_timers` filtered by `event_id` (`useEventChannel.ts:74-85`) |

**Why this matters:** The LOCKED clock model (CONTEXT.md) deliberately keeps phase derivation entirely in the client tier with **no** server tick and **no** server-time offset sync. Every capability above already lives in its correct tier today; this phase extends two client hooks and two RPCs without crossing tier boundaries.

## Standard Stack

### Core
No new runtime dependencies. Confirmed against `package.json` (2026-06-27) and `.planning/research/STACK.md`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 | RPC calls + Realtime on `round_timers` | Already wired in every timer hook `[VERIFIED: package.json]` |
| `@tanstack/react-query` | ^5.90.21 | `['timer', eventId]` cache (`useTimer.ts:7`) | New column rides the existing query `[VERIFIED: src/hooks/useTimer.ts]` |
| `react` / `react-dom` | ^19.2.0 | `useCountdown` `setInterval` tick | Native interval already present `[VERIFIED: src/hooks/useCountdown.ts:61]` |

### Development / Test
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | ^4.0.18 | Unit-test new phase branches | `vite.config.ts` enforces **100%** statements/branches/functions/lines `[VERIFIED: vite.config.ts]` |
| @vitest/coverage-v8 | ^4.0.18 | Coverage gate | Every new branch needs a test or the build fails |
| Stryker | ^9.5.1 (vitest-runner) | Mutation-test the new TS branches | `break: 80`, `high: 90`; project rule = 100% on critical timer logic `[VERIFIED: stryker.config.mjs + CLAUDE.md]` |

**Installation:** None — no packages added. `npm install` unchanged.

## Package Legitimacy Audit

**Not applicable.** This phase installs **zero** external packages (confirmed: `.planning/research/STACK.md` verdict "No new runtime dependencies"; no `npm install` in scope). All work is first-party source edits (`src/hooks/*`, `src/types/database.ts`, `supabase/migrations/00005_*.sql`) plus tests. No registry, slopcheck, or postinstall surface to audit.

## User Constraints (from CONTEXT.md)

> These are LOCKED. Research conforms to them and does not propose alternatives. Note: two earlier research docs (`PITFALLS.md` Pitfall 3, `STACK.md`) proposed a server-time offset sync and a *nullable* `overtime_minutes` column — **both are superseded by the locked decisions below.** Do not implement offset sync; the column is `overtime_seconds NOT NULL DEFAULT 0`.

### Locked Decisions
- **Clock model:** every time value derived client-side from absolute `round_timers.expires_at` − local `Date.now()`. **NO** server-time offset / `now()` sync mechanism. Count-up uses the same model.
- **Extend semantics:** `extend_timer` (+5 min) ALWAYS adds to the underlying main `expires_at`, shifting every phase boundary (main→overtime→count-up) later by the same amount. One behavior in all three phases; no per-phase branching; not disabled outside main. During count-up, +5 pulls the displayed time back toward overtime.
- **Migration 00005 (additive, backward compatible):** add `overtime_seconds INTEGER NOT NULL DEFAULT 0`; plain timers keep `overtime_seconds = 0` and behave exactly as today. `generate_round` gains `p_overtime_minutes` (defaulted, backward compatible — mirrors `p_timer_duration_minutes` in `00004`); 80+20 persists `overtime_seconds = 1200`. Remove the `GREATEST(0, …)` clamp in `pause_timer` so it stores the **signed** remaining. `resume_timer`/`extend_timer`/`cancel_timer` need no structural change beyond honoring signed remaining.
- **Phase derivation (LOCKED):** `useCountdown.ts` derives phase purely client-side from `expires_at` + `overtime_seconds` + `Date.now()`: (1) main counts down to 0:00 at `expires_at`; (2) overtime counts down `overtime_seconds` after `expires_at`; (3) count-up increments `+M:SS` indefinitely. **No** `phase` column, **no** server tick.
- **Notifications (LOCKED):** fire exactly once at EACH boundary (main→overtime, overtime→count-up). De-duplicate per boundary (track last-notified boundary/phase) so repeated Realtime updates / re-renders don't re-fire.

### Claude's Discretion
- Exact field shape added to `CountdownState` (recommend adding `phase: 'main' | 'overtime' | 'countup'`; keep `isOvertime` for backward compat).
- How `urgency` maps across phases (recommend conservative mapping that keeps existing 4-value union — see Open Questions Q1).
- Notification copy strings ("Overtime started" vs "Round over").

### Deferred Ideas (OUT OF SCOPE — Phase 9, do not build)
- 80+20 preset picker, explicit admin "Start timer" action, phase-distinct `TimerDisplay` styling/labels, `TimerControls`/`AdminControls` wiring, Cypress E2E. (TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05.)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIMER-03 | Main→0:00 transitions to 20-min overtime countdown; overtime→0:00 counts up +M:SS indefinitely | `useCountdown.ts` three-phase derivation (see Pattern 1) + `overtime_seconds` column. Backward compat: `overtime_seconds=0` reproduces today's down→count-up behavior. |
| TIMER-05 | Browser notification once at each boundary (main→overtime, overtime→count-up), de-duped per boundary | `useTimerNotification.ts` phase-transition detection + per-boundary `Set` dedup (see Pattern 3) |
| TIMER-06 | Server-authoritative across refresh/reconnect; pause during overtime/count-up preserves signed remaining on resume | Remove `GREATEST(0,…)` clamp (`00004:185`) → signed `remaining_seconds`; `resume_timer` math already correct with signed value (proof in Pattern 2). Phase is a pure function of server columns → refresh/reconnect safe. |

## Architecture Patterns

### System Architecture Diagram

```
                    Admin action (+passphrase)
                              │
                              ▼
            ┌──────────────────────────────────────┐
            │  RPCs (SECURITY DEFINER, passphrase)  │
            │  generate_round(... p_overtime_minutes)│  writes overtime_seconds = mins*60
            │  pause_timer   → SIGNED remaining_secs │  (clamp removed)
            │  resume_timer  → expires_at = now()+rem│  (rem may be negative)
            │  extend_timer  → expires_at += 5m      │  (shifts ALL boundaries)
            │  cancel_timer  → status='cancelled'    │
            └───────────────┬──────────────────────┘
                            │ row INSERT/UPDATE
                            ▼
                 round_timers (one row / active timer)
              expires_at · overtime_seconds · remaining_seconds(signed) · status
                            │
            ┌───────────────┴───────────── Realtime (event_id filter) ──────────┐
            ▼                                                                    ▼
   useTimer (TanStack Query)  ◄── invalidate ['timer',eventId] ── useEventChannel
            │ RoundTimer row
            ▼
   useCountdown(timer)  ── pure derive ──►  mainRemaining = paused ? remaining_seconds
            │                                              : floor((expires_at-now)/1000)
            │                                overtimeRemaining = mainRemaining + overtime_seconds
            │                                phase = main | overtime | countup
            ▼
   CountdownState { phase, display, remainingSeconds, isOvertime, urgency, ... }
            │
            ├──► TimerDisplay (Phase 9 styling — out of scope here)
            └──► useTimerNotification(timer, countdown)
                       prevPhaseRef + Set<`${id}:overtime`|`${id}:countup`>
                       fire once per forward boundary crossing
```

### Recommended Project Structure (files touched)
```
supabase/migrations/
└── 00005_timer_overtime.sql      # NEW: add column, redefine generate_round + pause_timer
src/
├── types/database.ts             # add overtime_seconds: number to RoundTimer (line ~37-48)
└── hooks/
    ├── useCountdown.ts           # add phase derivation (computeRemaining/State/format)
    ├── useCountdown.test.ts      # new phase + boundary + backward-compat tests
    ├── useTimerNotification.ts   # dual-boundary dedup
    ├── useTimerNotification.test.ts
    └── useGenerateRound.ts       # add overtimeMinutes? → p_overtime_minutes
```

### Pattern 1: Single-signed-value three-phase derivation (`useCountdown.ts`)

**What:** All three phases derive from one signed `mainRemaining` plus the constant `overtime_seconds`. No second timestamp column, no `phase` column, no per-phase storage — exactly the LOCKED model.

**Current code:** `computeRemaining` (`useCountdown.ts:19-25`) returns `remaining_seconds ?? 0` when paused, else `floor((expires_at - now)/1000)`. `formatDisplay` (`:34-44`) already renders `>=0 → "M:SS"` and `<0 → "+M:SS"`. `isOvertime` (`:82`) is `remainingSeconds <= 0`.

**Derivation (recommended):**
```typescript
// mainRemaining = signed seconds until/ since main boundary (expires_at)
const mainRemaining = timer.status === 'paused'
  ? (timer.remaining_seconds ?? 0)
  : Math.floor((new Date(timer.expires_at).getTime() - Date.now()) / 1000)

const overtime = timer.overtime_seconds ?? 0
const overtimeRemaining = mainRemaining + overtime  // seconds until/since overtime end

let phase: 'main' | 'overtime' | 'countup'
let displaySeconds: number          // feed to formatDisplay()
if (mainRemaining > 0) {
  phase = 'main';      displaySeconds = mainRemaining        // 80:00 → 0:00
} else if (overtimeRemaining > 0) {
  phase = 'overtime';  displaySeconds = overtimeRemaining    // 20:00 → 0:00  (positive → "M:SS")
} else {
  phase = 'countup';   displaySeconds = overtimeRemaining    // negative → "+M:SS"
}
```

**Why this is correct in every case (verified by hand):**

| Scenario | `remaining_seconds` stored | `mainRemaining` | `overtimeRemaining` (=+1200) | phase | display |
|----------|---------------------------|-----------------|-------------------------------|-------|---------|
| Running, 5 min into main | — | +4500 | +5700 | main | `75:00` |
| Running, at main boundary | — | 0 | +1200 | overtime | `20:00` |
| Running, 5 min into overtime | — | −300 | +900 | overtime | `15:00` |
| Running, 2 min into count-up | — | −1320 | −120 | countup | `+2:00` |
| **Paused** during overtime | −300 (signed) | −300 | +900 | overtime | `15:00` ✓ |
| **Paused** during count-up | −1320 (signed) | −1320 | −120 | countup | `+2:00` ✓ |
| Plain timer (`overtime_seconds=0`), past zero | — | −90 | −90 | countup | `+1:30` (identical to today) ✓ |

The paused rows only work because the migration removes `GREATEST(0,…)` — otherwise `remaining_seconds` would be clamped to 0 and both paused rows would collapse to `20:00` / `0:00`.

**When to use:** This is THE model for the phase. Keep `formatDisplay` unchanged — feed it `displaySeconds`. Keep public `remainingSeconds = mainRemaining` and `isOvertime = mainRemaining <= 0` so `TimerDisplay.tsx:24` and its tests stay green; add `phase` as the new source of truth for Phase 9.

### Pattern 2: Signed pause/resume — why only `pause_timer` changes

**`pause_timer` (the only RPC body that changes):** `supabase/migrations/00004_timer_system.sql:185`
```sql
-- BEFORE (clamps to 0 — destroys overtime/count-up position):
remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER),
-- AFTER (signed — preserves position):
remaining_seconds = EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER,
```

**`resume_timer` needs NO change** (`00004:233`): `expires_at = now() + (v_remaining * INTERVAL '1 second')`. With `v_remaining = −300`, this sets `expires_at = now() − 300s`, so on the next client tick `mainRemaining = −300` and Pattern 1 re-derives overtime correctly. The `overtime_seconds` column is untouched by pause/resume, so the boundary distance is preserved.

**`extend_timer` needs NO change** (`00004:280-290`): running path adds to `expires_at` (shifts all boundaries later — matches LOCKED); paused path adds to the now-signed `remaining_seconds` (e.g. count-up `−1320 + 300 = −1020`, pulled back toward overtime — matches LOCKED "+5 pulls displayed time back toward overtime").

**`cancel_timer` needs NO change.** Because all four RPCs were defined with `CREATE OR REPLACE` in `00004`, migration `00005` only needs to redefine `pause_timer` and `generate_round`; do **not** restate `resume`/`extend`/`cancel`.

### Pattern 3: Phase-transition notification dedup (`useTimerNotification.ts`)

**What:** Fire once per forward boundary crossing, deduped per boundary, robust to Realtime row-identity churn and refresh.

**Current trigger to replace:** `useTimerNotification.ts:42-62` fires when `remainingSeconds <= 0 && isOvertime`, deduped by a single `lastNotifiedTimerIdRef` string (`:29`, `:47`).

**Recommended:**
```typescript
const notifiedRef = useRef<Set<string>>(new Set())   // `${timer.id}:overtime`, `${timer.id}:countup`
const prevPhaseRef = useRef<string | null>(null)

useEffect(() => {
  if (!countdown || !timer || countdown.isPaused || countdown.isCancelled) return
  const phase = countdown.phase
  const prev = prevPhaseRef.current
  prevPhaseRef.current = phase
  if (prev === null) return                  // fresh mount / refresh — do NOT fire for a boundary crossed before mount (TIMER-06)
  if (permission !== 'granted') return

  if (prev === 'main' && phase === 'overtime') fireOnce(`${timer.id}:overtime`, 'Overtime started')
  if (prev === 'overtime' && phase === 'countup') fireOnce(`${timer.id}:countup`, 'Round over')
}, [countdown, timer, permission])
```
`fireOnce(key, msg)` checks `notifiedRef.current.has(key)`, adds it, then constructs the `Notification` inside a `try/catch` (preserve the iOS-PWA guard at `useTimerNotification.ts:50-58`). Reset both refs when `timer.id` changes (extend the existing effect at `:65-69`).

**Key correctness points:** (a) keying on `${timer.id}:boundary` (not the `timer` object reference) survives Realtime row replacement; (b) `prevPhaseRef === null` guard prevents a spurious fire when a client refreshes directly into overtime/count-up (TIMER-06 refresh/reconnect safety); (c) driving off `prev !== phase` rather than `remaining <= 0` makes it immune to the zero-crossing off-by-one (PITFALLS Pitfall 11).

### Migration 00005 — `generate_round` overload hazard (HIGH-priority gotcha)

`generate_round` already exists in **two** signatures: 3-arg from `00002_rounds_pods_admin.sql:83` and 4-arg from `00004_timer_system.sql:47`. Because `CREATE OR REPLACE FUNCTION` keys on name **+ argument types**, the `00004` 4-arg version did **not** replace the 3-arg one — it created an **overload**. Adding `p_overtime_minutes` creates a *third* overload, and PostgREST will throw `PGRST203 / "Could not choose the best candidate function"` on RPC calls.

**Required migration hygiene:** explicitly `DROP FUNCTION` the prior signatures before creating the new one:
```sql
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb);            -- 00002 overload
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb, integer);  -- 00004 overload
CREATE OR REPLACE FUNCTION generate_round(
  p_event_id UUID, p_passphrase TEXT, p_pod_assignments JSONB,
  p_timer_duration_minutes INTEGER DEFAULT NULL,
  p_overtime_minutes INTEGER DEFAULT 0
) RETURNS INTEGER ...
```
In the body, extend the timer INSERT (`00004:110-111`) to include `overtime_seconds`:
```sql
INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, expires_at)
VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
        COALESCE(p_overtime_minutes, 0) * 60,
        now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
```

### Anti-Patterns to Avoid
- **Adding a second boundary timestamp column** (e.g. `overtime_expires_at`). Unnecessary — the locked single-signed-value model (Pattern 1) is sufficient and is what CONTEXT mandates. (`STACK.md`/`PITFALLS.md` floated two-timestamp variants; superseded.)
- **Server-time offset sync.** Explicitly rejected by CONTEXT. Do not fetch `now()` or read response `Date` headers; keep bare `Date.now()` (`useCountdown.ts:24`).
- **Per-phase `extend_timer` branching.** Locked to always shift the main `expires_at`. Do not special-case overtime/count-up.
- **Gating notifications on `remaining === 0` or `remaining <= 0`.** Use phase-transition detection (Pattern 3).
- **Restating `resume`/`extend`/`cancel` in `00005`.** They are already correct; touching them risks regressions and bloats the diff.
- **Keeping the single `lastNotifiedTimerIdRef` string dedup.** It cannot express two boundaries per timer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time arithmetic / `M:SS` formatting | A date library (date-fns/dayjs/luxon) | Existing `formatDisplay` (`useCountdown.ts:34-44`) | Pure integer math; no tz/calendar need (`STACK.md` "What NOT to Add") |
| Countdown state machine | `react-timer-hook` / `react-countdown` | Existing recompute-from-`expires_at` tick (`useCountdown.ts:50-73`) | Client-owned timer libs reintroduce drift and break the server-authoritative model |
| Overtime length storage | Second table / second timer row | One `overtime_seconds` column on `round_timers` | Splitting one logical timer complicates Realtime, pause/resume, cancel |
| Notification dedup store | New persistence / context | A `useRef<Set<string>>` keyed by `${id}:boundary` | Dedup is per-tab ephemeral state; refs are the established pattern (`useTimerNotification.ts:29`) |

**Key insight:** The entire feature is additive arithmetic over data the system already stores. The one structural fix (remove the clamp) is what unlocks correctness; everything else is derivation.

## Runtime State Inventory

> Migration phase — runtime state beyond source files inventoried per category.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `round_timers` rows have **no** `overtime_seconds` column. New column is `NOT NULL DEFAULT 0` → all existing/in-flight rows backfill to `0` automatically and keep today's single-phase behavior. **No data migration needed.** | Code edit only (ALTER ADD COLUMN with default). |
| Live service config | Supabase Realtime publication already includes `round_timers` with `REPLICA IDENTITY FULL` (`00004:35,41`). A new column rides the existing publication — **no** publication/replica change. | None — verified by `00004:35-41` + `useEventChannel.ts:74-85`. |
| OS-registered state | None — no schedulers, cron, or OS-registered timers. The "timer" is pure data + client interval. | None — verified (no infra files reference timers). |
| Secrets / env vars | None changed. RPC passphrase gating uses existing `events.passphrase_hash` + `crypt()`; no key names change. Cypress `SUPABASE_URL`/`SUPABASE_ANON_KEY` exist for the unused `createRealEvent` command (`cypress/support/commands.js:66-67`) — out of scope unless a real-backend test is added. | None for this phase. |
| Build artifacts / installed packages | No package changes → no `node_modules`/lockfile churn. The DB function overloads (3-arg + 4-arg `generate_round`) are stale registered state that the migration must `DROP` (see overload hazard above). | Migration must `DROP FUNCTION` old `generate_round` signatures. |

**The canonical question — after every source file is updated, what runtime state still carries the old shape?** Answer: the **two stale `generate_round` overloads** registered in Postgres (`00002:83`, `00004:47`). The migration must drop them explicitly or PostgREST throws ambiguity errors. Nothing else (existing timer rows backfill cleanly via the column default).

## Common Pitfalls

### Pitfall 1: `pause_timer` clamp silently destroys overtime/count-up position
**What goes wrong:** Leaving `GREATEST(0, …)` at `00004:185` floors a pause-in-overtime/count-up to `remaining_seconds = 0`; resume then snaps `expires_at = now()` and the round re-expires at 0:00.
**How to avoid:** Remove the clamp (Pattern 2). This is the single most important change for TIMER-06.
**Warning signs:** DB shows `remaining_seconds = 0` after any pause past the 80-min mark; resume jumps to `20:00`/`0:00`; count-up resets to `+0:00`.

### Pitfall 2: `generate_round` overload ambiguity (PGRST203)
**What goes wrong:** Adding a parameter creates a third overload; PostgREST can't choose a candidate and RPC calls fail at runtime (tests that mock `supabase.rpc` will NOT catch this — see Validation gap).
**How to avoid:** `DROP FUNCTION IF EXISTS` both prior signatures before `CREATE` (see Migration section).
**Warning signs:** "Could not choose the best candidate function" on `generate_round` after deploy; works locally with one signature but fails after replay.

### Pitfall 3: Reusing `isOvertime`/`remaining <= 0` to drive phase or notifications
**What goes wrong:** `isOvertime` cannot distinguish overtime from count-up; notifications fire at the wrong boundary or once for both.
**How to avoid:** Add `phase` to `CountdownState`; drive notifications off `prev !== current` phase (Pattern 3).
**Warning signs:** Overtime styled as "expired"; only one of two boundaries notifies; notification labeled "round over" when overtime merely started.

### Pitfall 4: Spurious notification on refresh into overtime/count-up
**What goes wrong:** A client that loads directly into overtime fires "Overtime started" for a boundary crossed minutes ago.
**How to avoid:** `prevPhaseRef === null` guard returns before firing on the first observed render (Pattern 3).
**Warning signs:** Refreshing a long-running round pops a notification immediately on load.

### Pitfall 5: Zero-crossing off-by-one
**What goes wrong:** `setInterval` + `Math.floor` may skip rendering exactly `0:00`; logic gated on `remaining === 0` misfires.
**How to avoid:** Gate transitions on phase change, never on an exact second.

## Code Examples

### Add `overtime_seconds` to the type (`src/types/database.ts:37-48`)
```typescript
export type RoundTimer = {
  // ...existing fields...
  remaining_seconds: number | null   // now SIGNED (negative = into overtime/count-up)
  overtime_seconds: number           // NEW — 0 for plain timers, 1200 for 80+20
  // ...
}
```

### Thread overtime through `useGenerateRound.ts` (`:11-31`)
```typescript
interface GenerateRoundParams {
  passphrase: string
  podAssignments: PodAssignment[]
  timerDurationMinutes?: number
  overtimeMinutes?: number            // NEW
}
// in mutationFn rpc call (mirrors existing p_timer_duration_minutes at :26):
p_overtime_minutes: overtimeMinutes ?? 0,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-phase `remaining <= 0` overtime | Three-phase derivation via `mainRemaining + overtime_seconds` | This phase | Adds true 20-min overtime countdown segment |
| `pause_timer` clamps to 0 | Signed `remaining_seconds` | This phase | Pause/resume preserves overtime & count-up position |
| Single-string notification dedup | Per-boundary `Set` dedup keyed by phase | This phase | Two boundaries notify independently, once each |

**Deprecated/outdated within this repo's planning docs:** `PITFALLS.md` Pitfall 3 (server-time offset sync) and `STACK.md` (nullable `overtime_minutes`) are **superseded** by CONTEXT.md locked decisions. Do not implement them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CREATE OR REPLACE FUNCTION` with a new param creates a Postgres **overload** (not a replace), causing PostgREST candidate ambiguity | Migration / Pitfall 2 | If wrong, the `DROP FUNCTION` lines are harmless no-ops (`IF EXISTS`); recommendation is safe either way. Standard Postgres behavior `[ASSUMED]`. |
| A2 | Adding a `NOT NULL DEFAULT 0` column to `round_timers` backfills existing rows without a separate data migration | Runtime State Inventory | Standard Postgres `ALTER TABLE ADD COLUMN ... DEFAULT` behavior; low risk `[ASSUMED]`. |
| A3 | No automated SQL/RPC test harness exists; `supabase.rpc` is mocked in hook tests, so SQL correctness is **not** machine-verified | Validation Architecture | Verified by filesystem scan (no `supabase/tests`, no pgTAP, Stryker `mutate` excludes SQL). HIGH confidence `[VERIFIED: stryker.config.mjs + repo scan]`. |

## Open Questions (RESOLVED)

1. **`urgency` mapping across phases.** The existing union is `'normal' | 'warning' | 'danger' | 'expired'` and `TimerDisplay.tsx:9-14` + its tests rely on exactly these four keys. Adding a 5th (`'overtime'`) would break the UI map and several tests — but phase-distinct styling is **Phase 9 (TIMER-04)**, not this phase.
   - **Recommendation:** Keep the 4-value union unchanged this phase. Map: main → existing thresholds on `mainRemaining`; overtime → `'danger'`; count-up → `'expired'`. Expose the new `phase` field as the real source of truth so Phase 9 can introduce distinct styling without re-touching the engine. Flag for the planner: do **not** widen the `urgency` union in Phase 8.

2. **Whether `useTimer.ts` `select('*')` (`:11`) auto-includes the new column.** It does (`*` projects all columns), so no query change is needed — but confirm during planning that no narrowed select exists elsewhere.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Unit tests / Stryker runner | ✓ | ^4.0.18 | — |
| Stryker (vitest-runner) | Mutation gate | ✓ | ^9.5.1 | — |
| Supabase CLI / migration apply | Applying `00005` to DB | Unknown (not in `package.json`) | — | Migrations are plain SQL applied via the project's existing deploy path; verify the apply mechanism during planning |
| pgTAP / SQL test harness | Machine-verifying RPC SQL | ✗ | — | **None** — no SQL test infra exists (see Validation gap) |

**Missing with no fallback:** Automated SQL/RPC verification. The signed-pause and overload-drop correctness (TIMER-06) cannot be caught by the existing mocked-`rpc` unit tests. See Validation Architecture → Wave 0.

## Validation Architecture

> `config.json` has no `workflow.nyquist_validation` key → treated as **enabled**.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (jsdom, globals) `[VERIFIED: vite.config.ts]` |
| Config file | `vite.config.ts` (`test` block); setup `src/test/setup.ts` |
| Quick run command | `npm test -- src/hooks/useCountdown.test.ts src/hooks/useTimerNotification.test.ts` |
| Full suite command | `npm test` (`vitest --run`); mutation: `npm run test:mutation` |
| Coverage gate | 100% statements/branches/functions/lines (`vite.config.ts`) — a single uncovered new branch fails CI |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIMER-03 | main→overtime→countup derivation incl. exact boundaries | unit | `npm test -- src/hooks/useCountdown.test.ts` | ✅ extend |
| TIMER-03 | backward compat: `overtime_seconds=0` reproduces today's behavior | unit | same | ✅ extend |
| TIMER-05 | fire once at each boundary; per-boundary dedup; no double-fire on Realtime churn; no fire on refresh-into-phase | unit | `npm test -- src/hooks/useTimerNotification.test.ts` | ✅ extend |
| TIMER-06 (client) | paused overtime/count-up derive correct phase from signed `remaining_seconds` | unit | `npm test -- src/hooks/useCountdown.test.ts` | ✅ extend |
| TIMER-06 (SQL) | `pause_timer` stores signed value; `resume_timer` restores position; `generate_round` persists `overtime_seconds`; no overload ambiguity | integration (DB) | **none — no harness** | ❌ Wave 0 |

### Stryker mutation surface (target 100% on new branches — critical timer logic)
Mutants Stryker will generate on the new code, and the test that kills each:
- **Boundary operators** `mainRemaining > 0` and `overtimeRemaining > 0` (`>` ↔ `>=` ↔ `<`): need tests at `mainRemaining = 0` (→ overtime when `overtime_seconds>0`), `mainRemaining = 1` (→ main), `overtimeRemaining = 0` (→ countup), `overtimeRemaining = 1` (→ overtime).
- **Arithmetic** `mainRemaining + overtime_seconds` (`+` ↔ `-`): a test where `overtime_seconds = 1200` and `mainRemaining = −300` asserts `15:00`, distinct from the `−` result.
- **Backward-compat path** `overtime_seconds = 0`: assert past-zero behaves as count-up identical to today (kills the "default removed" mutant).
- **Notification:** distinct tests for (a) main→overtime fires `overtime` key only, (b) overtime→countup fires `countup` key only, (c) re-render with same phase fires nothing, (d) new `timer.id` resets the `Set`, (e) `prevPhaseRef===null` mount-into-countup fires nothing, (f) paused → no fire. Each kills the corresponding conditional/string-literal mutant.

**Note:** Stryker `mutate` globs are `src/**/*.{ts,tsx}` only (`stryker.config.mjs`) — **SQL is never mutated**. 100% mutation score therefore covers only the TS hooks, not the migration. The SQL must be validated another way (Wave 0).

### Sampling Rate
- **Per task commit:** quick run (the two hook test files).
- **Per wave merge:** `npm test` full suite + `npm run test:mutation` on the changed hooks.
- **Phase gate:** full suite + 100% coverage + Stryker ≥ project threshold (100% on the new timer branches) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] **SQL verification harness (TIMER-06 SQL row).** No `supabase/tests`, no pgTAP, and `supabase.rpc` is mocked in `useGenerateRound.test.ts`/`usePauseTimer.test.ts` — so the signed-pause fix, the `overtime_seconds` persistence, and the overload `DROP` are **not** machine-tested. Options for the planner to choose (this is the one real decision Wave 0 must make):
  1. Add a minimal real-Supabase integration test seeded from the existing unused `createRealEvent` Cypress command (`cypress/support/commands.js:66`, needs `SUPABASE_URL`/`SUPABASE_ANON_KEY` wired into `cypress.config.js`); assert pause-in-overtime → resume preserves position end-to-end.
  2. Add a pgTAP suite under `supabase/tests/` exercising `generate_round`/`pause_timer`/`resume_timer`.
  3. Accept a documented manual verification checkpoint for the SQL (lowest cost; explicitly note coverage is "TS-only" — mirrors PITFALLS Pitfall 14).
- [ ] Existing `useCountdown.test.ts` and `useTimerNotification.test.ts` `makeTimer` factories must add `overtime_seconds` (default 0) or they won't compile against the new `RoundTimer` type.
- [ ] `TimerDisplay.test.tsx` / `useGenerateRound.test.ts` factories likewise need the new field; `useGenerateRound.test.ts` should assert `p_overtime_minutes` is passed.

*(No new framework install needed — Vitest/Stryker already configured.)*

## Security Domain

> `security_enforcement` absent in `config.json` → treated as enabled. Scope is narrow (schema + two RPC bodies + two client hooks).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All RPCs gate on `crypt(p_passphrase, passphrase_hash)` — the modified `generate_round` and `pause_timer` MUST preserve the existing passphrase check (`00004:76`, `:167`). New `p_overtime_minutes` does not bypass it. |
| V4 Access Control | yes | `round_timers` RLS allows anon SELECT only (`00004:27-29`); all writes go through `SECURITY DEFINER` RPCs. No new write path is added — keep it that way. |
| V5 Input Validation | yes | `p_overtime_minutes` is a server-side INTEGER; coerce with `COALESCE(...,0)` and treat as minutes→seconds. No client-supplied phase/elapsed is ever trusted. |
| V6 Cryptography | no (unchanged) | No crypto changes; reuse existing `crypt()`. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| New timer-format RPC path skips passphrase check | Elevation of Privilege | Modified `generate_round`/`pause_timer` must retain the existing `crypt()` validation block verbatim |
| Client fakes "round over" / extends indefinitely | Tampering | Phase & elapsed are derived from server columns (`expires_at`, `overtime_seconds`); client sends only action + passphrase |

## Sources

### Primary (HIGH confidence — first-party source, read line-by-line)
- `supabase/migrations/00004_timer_system.sql` — schema, all four RPC bodies, the `GREATEST(0,…)` clamp at `:185`, Realtime/replica identity at `:35,41`
- `supabase/migrations/00002_rounds_pods_admin.sql:83` — original 3-arg `generate_round` (overload evidence)
- `src/hooks/useCountdown.ts`, `useTimerNotification.ts`, `useTimer.ts`, `useGenerateRound.ts`, `usePauseTimer.ts`, `useResumeTimer.ts`, `useExtendTimer.ts`, `useCancelTimer.ts`, `useEventChannel.ts`
- `src/hooks/useCountdown.test.ts`, `src/hooks/useTimerNotification.test.ts`, `src/hooks/useGenerateRound.test.ts` — existing test surface + `makeTimer` factories
- `src/types/database.ts:37-48` — `RoundTimer` shape
- `src/components/TimerDisplay.tsx` — `urgency` union consumer
- `vite.config.ts` (100% coverage gate), `stryker.config.mjs` (mutate globs, thresholds), `package.json` (scripts/deps)
- `.planning/phases/08-timer-migration-core-engine/08-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md:52-55,117-120` — TIMER-03/05/06 text + phase mapping

### Secondary (HIGH — repo planning docs, partially superseded by CONTEXT)
- `.planning/research/STACK.md`, `.planning/research/PITFALLS.md` — note: offset-sync and nullable-column proposals superseded by locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all versions read from `package.json`
- Architecture / derivation model: HIGH — Pattern 1 hand-verified against every phase/pause scenario; reconciles exactly with locked decisions
- Migration SQL: HIGH for the three required edits; MEDIUM-HIGH on the overload `DROP` (standard Postgres behavior, `IF EXISTS` makes it safe regardless)
- Validation / SQL test gap: HIGH — confirmed absence of any SQL test harness by filesystem scan

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable; first-party code, no fast-moving external surface)
