# Stack Research — v5.0 Mid-Event Flow & Round Formats

**Domain:** MTG Commander pod-pairing web app (subsequent milestone — additive features only)
**Researched:** 2026-06-27
**Confidence:** HIGH

> Supersedes the v4.0 STACK.md. The existing stack (React 19, Vite, Supabase, Tailwind CSS v4,
> TypeScript, TanStack Query, Vitest, Cypress, Stryker) is already validated and in production.
> This research covers ONLY what is new for v5.0.

## Verdict (read this first)

**No new runtime dependencies are required for any v5.0 feature.** All three features
(mid-event join UX, 80+20 timer format, fault-injection E2E campaign) are expressible with the
libraries already in `package.json` and the existing server-authoritative timer model.

The only backend change worth considering is **one nullable schema column** on `round_timers`
(`overtime_minutes`) plus a new migration `00005`, to keep the overtime length
server-authoritative. Everything else is application code (display logic, UI, tests) on top of
the current stack.

| Feature | New npm dep? | New schema? | New RPC? | Notes |
|---------|--------------|-------------|----------|-------|
| Mid-event join UX | No | No (reuse `players.created_at` / `round_number`) | No | Pure UI + existing Realtime on `players` |
| 80+20 timer format | No | **1 nullable column** (recommended) | Modify `generate_round` only | Count-up already implemented |
| Fault-injection E2E | No | No | No | Cypress 15.10 already configured |

## Existing Capabilities That Already Cover v5.0

Verified by reading source, not assumed:

| Need | Already exists | Where | Evidence |
|------|----------------|-------|----------|
| Count UP past zero ("how far over") | Yes | `src/hooks/useCountdown.ts` | `formatDisplay()` returns `+M:SS` for negative remaining; `isOvertime = remainingSeconds <= 0` |
| Server-authoritative countdown (zero drift) | Yes | `useCountdown.ts` + `00004_timer_system.sql` | Each tick recomputes `(expires_at - now) / 1000`; never trusts client clock |
| OVERTIME label + flashing-at-zero UI | Yes | `src/components/TimerDisplay.tsx` | `urgency: 'expired'` → `animate-pulse`; `statusLabel` switches to `OVERTIME` |
| Realtime push of timer changes to all clients | Yes | `src/hooks/useEventChannel.ts` | `round_timers` subscribed, `event_id` filtered, `REPLICA IDENTITY FULL` set |
| Pause / resume / extend / cancel | Yes | `pause_timer`/`resume_timer`/`extend_timer`/`cancel_timer` RPCs | `00004_timer_system.sql` |
| Player join + Realtime list refresh | Yes | `src/hooks/useJoinEvent.ts`, `useEventChannel.ts` | `players` insert + `['players', eventId]` invalidation |
| Round number / join ordering for "joined mid-event" flag | Yes | `rounds.round_number`, `players.created_at` | Existing columns; no new storage to detect post-round-1 joins |

## Recommended Stack (v5.0 delta)

There are **no additions to the dependency stack.** Versions below confirmed against
`package.json` (2026-06-27).

### Core Technologies (reused, no change)

| Technology | Version | Purpose for v5.0 | Why no change needed |
|------------|---------|------------------|----------------------|
| `@supabase/supabase-js` | ^2.97.0 | Timer RPC + Realtime for overtime/join | Existing RPC + `round_timers` channel already carry the data |
| `@tanstack/react-query` | ^5.90.21 | `['timer', eventId]` cache, 5s staleTime | Already drives `useTimer`; a new column rides the existing query |
| `react` / `react-dom` | ^19.2.0 | Timer display + join-indicator UI | Native `setInterval` tick already in `useCountdown` |
| `tailwindcss` / `@tailwindcss/vite` | ^4.2.1 | Segment/OVERTIME styling, "joined this round" badge | `animate-pulse` + urgency classes already present |
| `lucide-react` | ^0.575.0 | Any new icon (join indicator / overtime glyph) | Already vendored; reuse an existing icon |
| `sonner` | ^2.0.7 | Mid-event join confirmation toast | Already the standard feedback mechanism |
| `cypress` | ^15.10.0 | Fault-injection E2E campaign | Framework + `eslint-plugin-cypress` ^6.1.0 already configured |

### Supporting Libraries

None to add. The 80+20 segmented countdown needs **no date/time library** and **no
timer/hook library** — see "What NOT to Use."

### Development Tools (reused, no change)

| Tool | Purpose for v5.0 | Notes |
|------|------------------|-------|
| Vitest ^4.0.18 + @vitest/coverage-v8 | Unit-test new segment math in `useCountdown` | 100% coverage threshold enforced — every new branch needs a test |
| Stryker ^9.5.1 | Mutation-test the overtime/segment-boundary logic | Timer logic is a "critical hook"; match the established ~100% kill rate |
| Cypress ^15.10.0 + eslint-plugin-cypress ^6.1.0 | Fault-injection specs (`cypress/e2e/*.cy.js`) | Reuse existing dynamic `expires_at` fixtures to avoid wall-clock flake |

## Installation

```bash
# Nothing to install. No new dependencies for v5.0.
```

## The 80+20 Timer Model — How It Maps to Existing Schema

The existing `round_timers` row already holds everything except the overtime length:

```
round_timers (
  duration_minutes,    -- = 80 (the main segment)
  started_at,
  expires_at,          -- = started_at + 80 min  (END of main segment; current semantics)
  remaining_seconds,   -- pause snapshot
  paused_at, status
)
```

Three display phases, all derivable client-side once the overtime length is known:

| Phase | Condition | Display | Label | Source |
|-------|-----------|---------|-------|--------|
| Main | `now < expires_at` | `expires_at - now` counts 80:00 → 0:00 | "Round Timer" | existing `computeRemaining` |
| Overtime | `expires_at <= now < expires_at + overtime` | `(expires_at + overtime) - now` counts 20:00 → 0:00 | "OVERTIME" | new branch |
| Over | `now >= expires_at + overtime` | `now - (expires_at + overtime)` counts up `+M:SS` | "OVERTIME" / "OVER" | existing `formatDisplay` negative path |

**Where does the 20 come from?** Two viable options:

1. **Recommended — one nullable column** `overtime_minutes INTEGER` on `round_timers`
   (NULL = classic single-segment behavior; `20` = 80+20 format). Add via new migration
   `supabase/migrations/00005_timer_overtime.sql` and pass it through a modified `generate_round`
   (add `p_overtime_minutes INTEGER DEFAULT NULL`, mirroring how `p_timer_duration_minutes` was
   added in `00004`). Keeps overtime length **server-authoritative** and configurable, needs
   **no new RPC** and **no Realtime/publication change** (the column rides the existing
   `round_timers` channel; `REPLICA IDENTITY FULL` already set).

2. **Zero-schema fallback** — treat overtime as a fixed client constant (20 min) gated by a
   format flag inferred from `duration_minutes === 80`. Avoids a migration but couples the format
   to a magic number and breaks the server-authoritative principle. **Not recommended.**

### Integration points (for roadmap)

- **Type:** extend `RoundTimer` in `src/types/database.ts` with `overtime_minutes: number | null`.
- **Display logic:** add the overtime-segment branch in `src/hooks/useCountdown.ts`
  (`computeRemaining` / `computeUrgency` / `formatDisplay` / `CountdownState`). Highest-value
  change; needs the most unit + mutation coverage.
- **Write path:** `generate_round` RPC (`00004` → new `00005`) + `src/hooks/useGenerateRound.ts`
  (`GenerateRoundParams` already has `timerDurationMinutes?`; add `overtimeMinutes?`).
- **UI:** a timer-format picker wherever round-duration presets live today (the 60/90/120 picker
  in the round-generation UI), plus segment-aware labeling in `TimerDisplay.tsx`.

### Pause/resume caveat (flag for the implementing phase, not a stack item)

`pause_timer` snapshots `remaining_seconds = GREATEST(0, expires_at - now)` — it floors at 0, so
pausing **during overtime** loses the overtime position. The 80+20 work must decide whether
overtime is pausable and, if so, adjust the snapshot to allow negative remaining (or store an
overtime-relative offset). This is application/migration logic, not a dependency choice.

## Mid-Event Join UX — Stack Notes

No new tech. Detecting "joined after round 1" uses existing data: compare a player's `created_at`
(or the first round they appear in `pod_players`) against the current `round_number`. The
indicator is a Tailwind badge on the existing `PlayerList`/`PlayerItem`, refreshed by the
already-subscribed `players` Realtime channel. `lucide-react` supplies any icon; `sonner` supplies
any confirmation toast. The pairing algorithm already tolerates empty opponent history and 0 byes
(validated in v2.0/v4.0), so there is no algorithm dependency.

## Fault-Injection E2E Campaign — Stack Notes

Tooling only. Cypress 15.10 and `eslint-plugin-cypress` 6.1 are installed. Continue the
established conventions: `.cy.js` specs, `data-testid` selectors, `cy.intercept()` for fault
injection (force `round_timers` / `players` / RPC responses into error states), dynamic
`expires_at` fixtures for timer faults, and no arbitrary `cy.wait(ms)`. No new packages. Note: the
existing dead `createRealEvent` Cypress command needs `SUPABASE_URL` / `SUPABASE_ANON_KEY` wired
into both `cypress.config.js` and `cypress.yml` if any new fault spec requires a real backend —
add those only if real-backend faults are in scope.

## Alternatives Considered

| Recommended | Alternative | When the alternative would make sense |
|-------------|-------------|----------------------------------------|
| Native `Date` + `setInterval` recompute (existing) | `date-fns` / `dayjs` / `luxon` | Only if you needed timezone math or human-readable durations — neither applies; display is `M:SS` arithmetic |
| Extend `useCountdown` for segments | `react-timer-hook` / `use-timer` / `react-countdown` | Only if you wanted client-owned timer state — would break the server-authoritative, zero-drift model that already works |
| One nullable `overtime_minutes` column | `timer_format` enum + lookup table | Overkill for a single 80+20 format; revisit only if many named formats emerge |
| Modify `generate_round` | New `set_timer_format` RPC | Only if format must change after a round is generated (not a v5.0 requirement) |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any date/time library (`date-fns`, `dayjs`, `luxon`, `moment`) | Adds a dependency for arithmetic the code already does; no tz/calendar needs | Native `Date` math in `useCountdown.ts` (already present) |
| Timer/countdown hook libraries (`react-timer-hook`, `use-timer`, `react-countdown`) | Moves state to the client and reintroduces drift; duplicates working logic | Existing `useCountdown` recompute-from-`expires_at` pattern |
| A separate `overtime_timers` table or a second `round_timers` row | Splits one logical timer across rows; complicates Realtime, pause/resume, and cancel | One row + `overtime_minutes` column; derive segments client-side |
| Client-only overtime constant with no schema | Breaks server-authoritative consistency; magic-number coupling to `duration_minutes === 80` | Nullable `overtime_minutes` column (Option 1) |
| New Realtime channel / publication change for overtime | Unnecessary; the new column rides the existing `round_timers` subscription | Existing `useEventChannel` `round_timers` filter |

## Version Compatibility

All versions confirmed against `package.json` (2026-06-27). No upgrades required and no new
packages introduced, so there are no new compatibility surfaces. Adding a nullable column to
`round_timers` is backward compatible with the deployed `00004` migration and with existing
`RoundTimer` consumers (column defaults to NULL → current single-segment behavior preserved).

## Sources

- `package.json` — exact installed versions (HIGH, first-party)
- `src/hooks/useCountdown.ts` — confirmed count-up/overtime already implemented (HIGH, first-party)
- `src/components/TimerDisplay.tsx` — confirmed OVERTIME label + flashing-at-zero UI (HIGH, first-party)
- `src/hooks/useTimer.ts`, `src/hooks/useGenerateRound.ts` — query/mutation wiring (HIGH, first-party)
- `supabase/migrations/00004_timer_system.sql` — `round_timers` schema, RPCs, Realtime/replica identity (HIGH, first-party)
- `src/types/database.ts` — `RoundTimer` shape (HIGH, first-party)
- `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md` — existing inventory cross-check (HIGH, first-party)

---
*Stack research for: Commander Pod Pairer v5.0 — mid-event flow & round formats milestone*
*Researched: 2026-06-27*
