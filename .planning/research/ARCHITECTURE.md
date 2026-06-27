# Architecture Research

**Domain:** v5.0 feature integration — 80+20 round-timer format + mid-event join UX (Commander Pod Pairer)
**Researched:** 2026-06-27
**Confidence:** HIGH (grounded entirely in current source: `00004_timer_system.sql`, `src/hooks/useCountdown.ts`, `useTimer.ts`, `useTimerNotification.ts`, `useGenerateRound.ts`, `useRounds.ts`, `src/components/TimerDisplay.tsx`, `PlayerItem.tsx`, `AdminControls.tsx`, `src/types/database.ts`)

## Executive Recommendation

Both features integrate cleanly with the existing server-authoritative, pure-derivation architecture **without introducing any new server-side ticking, cron, or phase-transition writes.**

- **80+20 timer:** Add **one** column (`overtime_seconds`) to `round_timers`. Keep `expires_at` meaning "end of main period." **Derive the phase (main → overtime → count-up) purely on the client** from `expires_at` + `overtime_seconds` + `Date.now()`. Do **not** add a `phase` column — phase is a function of time and storing it would require a server tick to keep current (redundant state, violates the existing zero-drift model).
- **Mid-event join:** **Zero migration, zero new columns.** Derive "joined mid-event" on the client by comparing `player.created_at` against the `created_at` of the earliest round (`round_number = 1`). Both values already flow through existing queries (`useEventPlayers`, `useRounds`).

The single most important insight: **`useCountdown` already counts up past zero** (negative `remainingSeconds`, `+M:SS` display, `isOvertime`). The only genuinely new timer concept is a *second, configurable countdown segment* that sits between the main countdown and the existing unbounded count-up.

## Standard Architecture

### System Overview — Timer data flow (after v5.0)

```
┌──────────────────────────────────────────────────────────────────────┐
│  round_timers row (server-authoritative anchors)                       │
│    expires_at        = end of MAIN period (existing, unchanged meaning) │
│    overtime_seconds  = length of OVERTIME segment (NEW column)          │
│    status            = running | paused | cancelled (unchanged)         │
│    remaining_seconds = signed, on pause (semantics generalized)         │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ useTimer() query + Realtime invalidation
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  useCountdown(timer)  — PURE client derivation, recomputed every tick   │
│                                                                         │
│   t = now()                                                             │
│   mainEnd     = expires_at                                              │
│   overtimeEnd = expires_at + overtime_seconds                          │
│                                                                         │
│   if t <  mainEnd      → phase=main      remaining = mainEnd - t   (↓)  │
│   if t <  overtimeEnd  → phase=overtime  remaining = overtimeEnd - t(↓) │
│   else                 → phase=countup   elapsed   = t - overtimeEnd(↑) │
└───────────────┬───────────────────────────────────┬────────────────────┘
                ▼                                   ▼
       TimerDisplay (phase label/styling)   useTimerNotification
                                            (fires at BOTH zero crossings)
```

Because every value derives from two absolute server quantities (`expires_at`, `overtime_seconds`) plus the client clock, **refresh and reconnect are automatically correct**: re-reading the row and recomputing yields the identical phase/value. The count-up segment needs no upper bound and no server write — it is just `now - overtimeEnd`. This preserves the existing "Server-authoritative timer (expires_at - now())" key decision verbatim.

### Component / module responsibilities (timer)

| Module | Current responsibility | v5.0 change |
|--------|------------------------|-------------|
| `round_timers` table (`supabase/migrations/00004_timer_system.sql:8`) | Authoritative timer state | **+1 column** `overtime_seconds` |
| `generate_round` RPC (`00004_timer_system.sql:47`) | Create round + optional timer | Accept `p_overtime_minutes`, persist `overtime_seconds` |
| `pause_timer` RPC (`00004_timer_system.sql:145`) | Snapshot remaining on pause | Generalize: drop `GREATEST(0, …)` clamp so it stores *signed* remaining (preserves overtime/count-up position across pause) |
| `resume_timer` / `extend_timer` / `cancel_timer` | Resume/extend/cancel | **No structural change** — they manipulate `expires_at`; `overtime_seconds` rides along as a constant offset |
| `src/types/database.ts:37` `RoundTimer` | DB row type | **+1 field** `overtime_seconds: number` |
| `src/hooks/useCountdown.ts` | Derive remaining/display/urgency/overtime | Add `phase` derivation + per-phase remaining; extend `CountdownState` |
| `src/hooks/useTimerNotification.ts` | Fire once at zero | Fire at **two** boundaries (main→overtime, overtime→count-up) |
| `src/components/TimerDisplay.tsx` | Render countdown + status | Phase-aware label (`MAIN` / `OVERTIME` / `OVERTIME ELAPSED`) + styling |
| `src/components/AdminControls.tsx:179` | Timer duration picker (60/90/120) | Add an "80+20" format option |
| `src/hooks/useGenerateRound.ts` | Call `generate_round` RPC | Pass `overtimeMinutes` |
| `src/hooks/useTimer.ts` | Fetch active timer | **No change** — `.select('*')` already returns the new column |
| `src/hooks/useEventChannel.ts` | Realtime invalidation | **No change** — `round_timers` already subscribed, `REPLICA IDENTITY FULL` already set |

### Component / module responsibilities (mid-event join)

| Module | v5.0 change |
|--------|-------------|
| `src/lib/mid-event.ts` (**NEW** pure helper) | `isMidEventJoin(playerCreatedAt, firstRoundCreatedAt): boolean` — mirrors the `pod-algorithm.ts` "pure, exported, unit-tested" convention |
| `src/pages/EventPage.tsx` | Compute earliest-round timestamp from `useRounds` data; build a `midEventPlayerIds` Set (mirrors existing `newPlayerIds` Set pattern) and pass down |
| `src/components/PlayerList.tsx` | Thread the Set / flag through to each row |
| `src/components/PlayerItem.tsx:3` | Accept `isMidEvent?: boolean`; render a persistent badge (distinct from the existing 400ms `isNew` flash) |
| Migrations / RPCs / types | **None** — fully derived |

## Architectural Patterns

### Pattern 1: Minimal column + pure phase derivation (the core timer decision)

**What:** Store only the *configurable, authoritative* fact the client cannot otherwise know — the overtime length — and derive everything time-dependent on the client.

**Why store `overtime_seconds` at all (vs. a hardcoded client constant)?** Because it is per-timer configuration that must be part of the authoritative record and survive format changes. A client-side `const OVERTIME = 20*60` would not be server-authoritative and would silently misrender historical timers if the format ever changed. One column is the correct minimal cost.

**Why NOT a `phase` column?** Phase is a deterministic function of `(now, expires_at, overtime_seconds)`. Persisting it would force a server-side tick/cron to advance `main → overtime → countup` at the boundaries — reintroducing the drift and liveness problems the `expires_at` model was specifically chosen to avoid. Derivation keeps the DB write-free between admin actions.

**Trade-offs:** Inherits the existing client/server clock-skew characteristic (already present for the v2.0 countdown — no worse). Phase boundaries are evaluated on the 1s `setInterval`, so a transition is visible within ~1s of the true crossing.

**Example:**
```typescript
// useCountdown.ts — replaces single computeRemaining for running timers
const mainEnd = new Date(timer.expires_at).getTime()
const overtimeEnd = mainEnd + timer.overtime_seconds * 1000
const t = Date.now()
let phase: 'main' | 'overtime' | 'countup'
let value: number // seconds; signed for display
if (t < mainEnd)         { phase = 'main';     value = Math.floor((mainEnd - t) / 1000) }
else if (t < overtimeEnd){ phase = 'overtime'; value = Math.floor((overtimeEnd - t) / 1000) }
else                     { phase = 'countup';  value = Math.floor((overtimeEnd - t) / 1000) } // negative → "+M:SS"
```
A plain timer (no overtime) sets `overtime_seconds = 0`, so `overtimeEnd === mainEnd` and behavior is **identical to today** (main countdown straight into count-up) — backward compatible with all existing 60/90/120 timers.

### Pattern 2: Generalized pause snapshot (signed remaining)

**What:** `pause_timer` currently does `remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (expires_at - now())))` (`00004_timer_system.sql:185`). The `GREATEST(0, …)` clamp means pausing in overtime/count-up loses position (resumes at 0). For 80+20 this would silently discard overtime/count-up progress on a mid-overtime pause.

**Recommendation:** Remove the clamp so `remaining_seconds` is **signed** (can be negative, meaning "already past main end"). `resume_timer` already does `expires_at = now() + (remaining * INTERVAL '1 second')` (`:233`), which is correct for negative values too — it places `expires_at` in the past, and `overtime_seconds` (constant) keeps overtime/count-up aligned. This is a one-line RPC change that also fixes the pre-existing "pause-in-overtime resets to zero" limitation for plain timers.

**Trade-off:** `remaining_seconds` is no longer guaranteed non-negative; any client code reading it directly must tolerate negatives (today only `useCountdown` reads it, and only for `paused` status — route the paused value through the same phase math).

### Pattern 3: Pure-derivation flag via timestamp comparison (mid-event)

**What:** "Joined mid-event" = there is at least one round AND `player.created_at > earliestRound.created_at`. The earliest round is `round_number = 1`; `useRounds` returns rounds ordered `round_number` descending (`useRounds.ts:13`), so the earliest is the last element (or `Math.min` of `created_at`).

**Why derive (vs. a stored `joined_round` column)?** It avoids redundant state that could drift, requires no migration, and is robust to drop→reactivate (reactivation does not change `created_at`). It also automatically matches the pairing algorithm's existing behavior (mid-joiners already get empty opponent history + 0 byes).

**Edge cases handled:** Pre-first-round joiners have `created_at < round1.created_at` → not flagged. With zero rounds, nobody is mid-event (no baseline yet) → flag `false` for all. Removed-then-readded-by-admin players keep their original insert time.

**Trade-off:** Relies on `created_at` accuracy of the `players` insert vs. the `rounds` insert — both are server `now()` defaults, so ordering is reliable. A player joining in the same second as round-1 generation is a negligible boundary case (treat `>` strictly = not mid-event).

**Example:**
```typescript
// src/lib/mid-event.ts (NEW, pure + unit-tested per pod-algorithm convention)
export function isMidEventJoin(playerCreatedAt: string, firstRoundCreatedAt: string | null): boolean {
  if (!firstRoundCreatedAt) return false               // no rounds yet
  return new Date(playerCreatedAt).getTime() > new Date(firstRoundCreatedAt).getTime()
}
```

## Data Flow

### 80+20 round creation

```
Admin picks "80+20" format in AdminControls (duration=80, overtimeMinutes=20)
   ↓
useGenerateRound.mutate({ ..., timerDurationMinutes: 80, overtimeMinutes: 20 })
   ↓
generate_round RPC → INSERT round_timers (duration_minutes=80, overtime_seconds=1200,
                                          expires_at = now() + 80 min)
   ↓
Realtime round_timers change → useEventChannel invalidates ['timer', eventId]
   ↓
useTimer refetch → useCountdown derives phase every 1s → TimerDisplay + notifications
```

### The two zero crossings (notification)

`useTimerNotification` currently fires once per `timer.id` when `isOvertime` (`useTimerNotification.ts:46`). For 80+20 there are **two** meaningful alerts:
1. **main → overtime** ("Main time up — 20:00 overtime begins")
2. **overtime → count-up** ("Overtime over — round running long")

Track the **last-notified phase** per `timer.id` (not a single boolean), and fire on each forward phase transition. A plain timer (`overtime_seconds = 0`) collapses both crossings into one moment — guard against double-firing by only notifying `main→overtime` when `overtime_seconds > 0`, otherwise on the single `→countup` crossing.

## Migration / RPC Impact (explicit)

**NEW migration `supabase/migrations/00005_timer_overtime.sql`:**
- `ALTER TABLE round_timers ADD COLUMN overtime_seconds INTEGER NOT NULL DEFAULT 0;`
  - Safe additive change. Table already has `REPLICA IDENTITY FULL` and is in `supabase_realtime`; adding a column is automatically included in Realtime payloads — **no re-publish needed**.
- `CREATE OR REPLACE FUNCTION generate_round(...)` adding `p_overtime_minutes INTEGER DEFAULT 0`, persisting `overtime_seconds = p_overtime_minutes * 60` in the `INSERT round_timers` (`00004_timer_system.sql:110`). `DEFAULT 0` keeps existing callers valid.
- `CREATE OR REPLACE FUNCTION pause_timer(...)` removing the `GREATEST(0, …)` clamp (signed remaining).
- `resume_timer`, `extend_timer`, `cancel_timer`: **unchanged.**

**No migration for mid-event join.**

**Type change:** `src/types/database.ts` `RoundTimer` gains `overtime_seconds: number`. (Vitest 100% coverage gate applies to any new source file — `mid-event.ts` and any new hook need co-located tests; `database.ts` is excluded from coverage.)

## Build Order (dependency-aware)

The two features are **independent tracks** and can be separate phases or parallelized. Mid-event is the lower-risk/no-migration quick win; the timer is the headline and carries the migration.

**Track A — 80+20 timer (ordered; each step depends on the prior):**
1. `00005_timer_overtime.sql` — column + `generate_round` param + `pause_timer` signed-remaining. *(Foundation: nothing client-side works without the column.)*
2. `src/types/database.ts` — add `overtime_seconds`. *(Unblocks all TS.)*
3. `src/hooks/useCountdown.ts` — phase derivation + per-phase remaining; extend `CountdownState` with `phase`. *(Core logic; fully unit-testable in isolation — no UI needed.)*
4. `src/hooks/useTimerNotification.ts` — dual-boundary firing keyed on last-notified phase. *(Depends on step 3's `phase`.)*
5. `src/components/TimerDisplay.tsx` — phase label + styling. *(Depends on 3/4.)*
6. `src/hooks/useGenerateRound.ts` + `src/components/AdminControls.tsx` — 80+20 picker option, pass `overtimeMinutes`. *(Wires creation; depends on 1.)*
7. E2E `cypress/e2e/timer.cy.js` + `cypress/fixtures/timer.json` — add `overtime_seconds`; use dynamic `expires_at` per the existing "dynamic expires_at in timer E2E fixtures" decision to exercise all three phases. Then Stryker on changed hooks (critical-path: 100% kill target per global rule).

**Track B — mid-event join (ordered):**
1. `src/lib/mid-event.ts` (+ `mid-event.test.ts`) — pure `isMidEventJoin`. *(Foundation, no deps.)*
2. `src/pages/EventPage.tsx` — derive earliest-round timestamp, build `midEventPlayerIds` Set. *(Depends on 1; reuses `useRounds` already fetched.)*
3. `src/components/PlayerList.tsx` → `src/components/PlayerItem.tsx` — thread flag, render badge. *(Depends on 2.)*
4. E2E (`cypress/e2e/player-join.cy.js` extension or new `mid-event.cy.js` + fixture) + Stryker on the new helper.

**Recommended sequencing:** Track B first or in parallel (no migration, smaller blast radius), Track A second. If sequential, run Track A's migration early so the column exists before client work begins.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing `phase` (or `is_overtime`) on `round_timers`
**What people do:** Add a `phase` column and flip it with a scheduled job at each boundary.
**Why it's wrong:** Requires a server tick/cron, reintroduces drift, and creates redundant state that disagrees with the clock between updates — the exact problem `expires_at`-derivation was chosen to solve.
**Do this instead:** Derive `phase` in `useCountdown` from `expires_at` + `overtime_seconds` + `now()`.

### Anti-Pattern 2: A second timer row / separate "overtime timer"
**What people do:** Create a new timer row when overtime begins.
**Why it's wrong:** Needs a trigger/write at the boundary, breaks `useTimer`'s single-active-timer assumption (`useTimer.ts:13` `.limit(1)`), and complicates pause/resume.
**Do this instead:** One row, one moving anchor (`expires_at` = main end), one constant offset (`overtime_seconds`).

### Anti-Pattern 3: Keeping the `GREATEST(0, …)` pause clamp for 80+20
**What people do:** Leave `pause_timer` as-is.
**Why it's wrong:** Pausing during overtime/count-up snaps `remaining_seconds` to 0, discarding position on resume.
**Do this instead:** Store signed remaining; `resume_timer` already handles negatives correctly.

### Anti-Pattern 4: A `joined_round` / `is_mid_event` column on `players`
**What people do:** Persist the mid-event flag at insert time.
**Why it's wrong:** Redundant state that can drift; needs a migration and write-path logic; the algorithm already derives the same notion implicitly.
**Do this instead:** Derive from `player.created_at` vs. earliest round `created_at`.

### Anti-Pattern 5: Reusing the `isNew` flash for the mid-event badge
**What people do:** Overload `PlayerItem`'s 400ms `animate-flash` (`PlayerItem.tsx:11`) to mean "mid-event."
**Why it's wrong:** `isNew` is a transient just-joined animation for *all* new players; mid-event is a *persistent* status for a subset. Conflating them makes both incorrect.
**Do this instead:** Add a separate `isMidEvent` prop and a persistent badge element.

## Integration Points

### Internal boundaries

| Boundary | Communication | v5.0 note |
|----------|---------------|-----------|
| `round_timers` ↔ `useTimer` | `.select('*')` query | Auto-picks up `overtime_seconds`; no query change |
| `round_timers` ↔ `useEventChannel` | Realtime `postgres_changes` | Already subscribed + `REPLICA IDENTITY FULL`; column ride-along, no change |
| `useTimer` → `useCountdown` → `TimerDisplay`/`useTimerNotification` | props | Extend `CountdownState` with `phase`; consumers read it |
| `useRounds` + `useEventPlayers` → `EventPage` → `PlayerList` → `PlayerItem` | props | Add derived `midEventPlayerIds` Set alongside existing `newPlayerIds` |
| `AdminControls` → `useGenerateRound` → `generate_round` | RPC params | New `p_overtime_minutes` (defaulted, backward compatible) |

### External services

| Service | Integration pattern | Gotcha |
|---------|---------------------|--------|
| Supabase Postgres | Additive migration `00005` | `ADD COLUMN ... DEFAULT 0` is safe; `CREATE OR REPLACE FUNCTION` for RPC edits |
| Supabase Realtime | Existing publication on `round_timers` | No re-add; `REPLICA IDENTITY FULL` already set in `00004` |
| Browser Notifications API | `useTimerNotification` | Now two alerts; keep the iOS-PWA `try/catch` swallow and `tag` dedupe (`useTimerNotification.ts:51`) |

## Open Questions for Roadmapping

- **80+20 as a preset vs. configurable overtime length?** Recommend shipping a single "80+20" preset button in `AdminControls` first (matches the requirement); the schema (`overtime_seconds`) is already general enough for arbitrary values later — no future migration needed to generalize.
- **Admin confirmation for mid-event joiners?** PROJECT.md mentions "any admin confirmation." The badge is the core deliverable; an optional admin toast/confirm is a thin add on top of the same derived Set. Recommend scoping the badge as required, confirmation as optional stretch.
- **Notification copy at the two boundaries** is a UX detail, not architectural — defer to phase planning.

## Sources

- `supabase/migrations/00004_timer_system.sql` (round_timers schema + all timer RPCs) — HIGH
- `src/hooks/useCountdown.ts`, `useTimer.ts`, `useTimerNotification.ts`, `useGenerateRound.ts`, `useRounds.ts` — HIGH
- `src/components/TimerDisplay.tsx`, `AdminControls.tsx`, `PlayerItem.tsx` — HIGH
- `src/types/database.ts` — HIGH
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `INTEGRATIONS.md`, `.planning/PROJECT.md` — HIGH

---
*Architecture research for: v5.0 timer + mid-event integration*
*Researched: 2026-06-27*
