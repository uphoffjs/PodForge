# Project Research Summary

**Project:** Commander Pod Pairer — v5.0 "Mid-Event Flow & Round Formats"
**Domain:** Real-time MTG Commander pod-pairing web app (additive milestone on a shipped system)
**Researched:** 2026-06-27
**Confidence:** HIGH

## Executive Summary

v5.0 adds three features to a fully deployed, well-tested system: a three-phase 80+20 round timer (80-min main countdown → 20-min overtime countdown → unbounded count-up), a persistent mid-event join UX indicator, and completion of the batch-1 fault-injection E2E campaign (21 pending faults). The research verdict is unambiguous: **no new runtime dependencies are needed for any of the three features.** The existing stack (React 19, Supabase, TanStack Query, Tailwind v4, Vitest, Cypress, Stryker) covers everything. The only backend change is one additive column (`overtime_seconds INTEGER NOT NULL DEFAULT 0`) on `round_timers` in a new migration `00005`, making the overtime length server-authoritative without touching any existing RPCs beyond `generate_round` and `pause_timer`.

The two principal build tracks are architecturally independent and can be parallelized after the migration lands. The timer track is strictly ordered (migration → types → `useCountdown` phase engine → `useTimerNotification` → `TimerDisplay` → `AdminControls`/`useGenerateRound` → E2E + Stryker) because every downstream step depends on the column existing. The mid-event join track has zero migration dependencies and can begin any time; its core decision is to derive "joined mid-event" from pod participation (`pod_players` membership), not from `created_at` timestamp comparison. The fault-injection campaign is a process-disciplined track that parallelizes with both.

The headline risk for v5.0 is the `pause_timer` RPC: it currently clamps `remaining_seconds = GREATEST(0, expires_at - now())`, which silently discards overtime and count-up position on any mid-overtime pause. This one-line clamp removal (`00005` migration, alongside the column addition) is the most critical correctness fix in the milestone and must land before any timer UI work begins. Secondary risks are notification double-firing at the two phase boundaries (requires per-boundary dedup keyed on `timer.id + boundary-name`, not a single flag) and mid-event badge flicker due to unordered Realtime invalidations (mitigated by deriving the flag from a single coherent snapshot rather than two independent query keys).

## Key Findings

### Recommended Stack

No additions to `package.json`. The entire milestone is expressible with the existing dependency set. Versions confirmed against `package.json` on 2026-06-27: Supabase JS `^2.97.0`, TanStack Query `^5.90.21`, React `^19.2.0`, Tailwind `^4.2.1`, Lucide React `^0.575.0`, Sonner `^2.0.7`, Cypress `^15.10.0`, Vitest `^4.0.18`, Stryker `^9.5.1`. The 80+20 timer needs no date/time library and no timer-hook library; it extends `useCountdown`'s existing `Date.now()` arithmetic. The `overtime_seconds` column rides the already-published `round_timers` Realtime channel (REPLICA IDENTITY FULL set in `00004`) with no re-publish step.

**Core technologies (delta only):**
- `supabase/migrations/00005_timer_overtime.sql` — new migration: `overtime_seconds` column, `generate_round` param, `pause_timer` clamp removal
- `src/hooks/useCountdown.ts` — phase-derivation engine; highest-value change; 100% Stryker kill target
- `src/hooks/useTimerNotification.ts` — dual-boundary notification with per-boundary dedup
- `src/components/TimerDisplay.tsx` — phase-aware label and styling (three distinct urgency states)
- `src/lib/mid-event.ts` (new pure helper) — `isMidEventJoin` derived from pod participation
- Cypress specs — timer phase E2E + mid-event badge E2E + batch-1 fault completion

### Expected Features

**Must have (table stakes — v5.0 core):**
- 80+20 three-phase timer: main counts 80:00→0:00, overtime counts 20:00→0:00, then unbounded count-up with `+` prefix — no admin action needed to transition phases
- Distinct per-phase visual treatment: normal/warning/danger within main, amber "OVERTIME" identity, past-deadline red count-up — glanceable at arm's length
- Two boundary browser notifications (main→overtime, overtime→count-up) each firing exactly once per-boundary, phase-correct copy
- Admin pause/resume/extend/cancel working across all three phases with defined semantics
- Persistent mid-event join badge on player rows ("Joined R{N}"), cleared the moment the player is assigned to a pod
- 80+20 as a selectable preset in the admin duration picker alongside existing 60/90/120 presets

**Should have (v5.x after validation):**
- "Event in progress" notice on the join form for late arrivals
- Sub-urgency ladder within overtime (warning at OT <5m)

**Defer (v6+):**
- Optional non-blocking admin-confirm for new joins (only if abuse is observed; open join is the correct default)
- Named custom presets beyond 80+20 (avoid the N-phase builder anti-feature entirely)
- Sound alarm at boundaries (explicitly out of scope per PROJECT.md)
- Admin-approval-gated join (anti-feature: high cost, breaks the open-join model, admin remove-player is the corrective tool)

### Architecture Approach

Both features integrate into the existing server-authoritative, pure-derivation architecture without any new server ticking, cron jobs, or phase-transition server writes. The timer adds one column (`overtime_seconds`) to `round_timers`; `expires_at` retains its meaning as "end of main period." All three timer phases derive purely on the client from `expires_at + overtime_seconds + Date.now()` (with a server-time offset applied to correct for clock skew in the count-up phase). The mid-event join feature requires zero migration — the indicator derives from pod participation: a player is mid-event iff at least one round exists and the player appears in no `pod_players` row of any existing round. This is strictly more accurate than timestamp comparison (Pitfall 6) and automatically clears when the player is paired.

**Major components and responsibilities:**

1. `supabase/migrations/00005_timer_overtime.sql` — additive column + modified `generate_round` (new `p_overtime_minutes DEFAULT 0` param, persists `overtime_seconds = p_overtime_minutes * 60`) + `pause_timer` clamp removal (drop `GREATEST(0,…)` so `remaining_seconds` is signed)
2. `src/hooks/useCountdown.ts` — extend `CountdownState` with `phase: 'main' | 'overtime' | 'countup'`; three-branch derivation from `expires_at` and `overtime_seconds`; backward-compatible for plain timers (`overtime_seconds = 0` collapses overtime and count-up into the existing single zero-crossing)
3. `src/hooks/useTimerNotification.ts` — phase-transition detection (prev phase != current phase) driving a `Set` ref keyed on `"${timer.id}:overtime-start"` / `"${timer.id}:countup-start"` to dedup per boundary, not per timer
4. `src/components/TimerDisplay.tsx` — phase-aware label (`MAIN` / `OVERTIME` / `OVERTIME ELAPSED`) and urgency classes; `+mm:ss` prefix in count-up phase
5. `src/lib/mid-event.ts` (new) — pure exported helper following the `pod-algorithm.ts` pure-helper convention; unit-tested and Stryker-validated; derives mid-event status from pod participation data passed in from `EventPage`
6. `src/pages/EventPage.tsx` — derive `midEventPlayerIds` Set from `useRounds` + pod membership data (mirrors existing `newPlayerIds` Set pattern); passes to `PlayerList` → `PlayerItem` as `isMidEvent` prop
7. `src/types/database.ts` — `RoundTimer` gains `overtime_seconds: number`

### Critical Pitfalls

1. **`GREATEST(0,…)` pause clamp destroys overtime/count-up position** — remove in `00005`; `resume_timer` already handles negative `remaining_seconds` correctly (it sets `expires_at = now() + remaining * interval`, placing `expires_at` in the past); test pause+resume in overtime and in count-up as explicit RPC unit tests before any UI work
2. **Single-phase model reused for 80+20 (setting `duration_minutes = 100`)** — implement the three-phase branch derivation in `useCountdown`; the warning sign is "overtime never shows 20:00"; verify the middle phase is visible in a timed spec
3. **Mid-event join detected by `created_at` timestamp comparison** — use pod participation instead: "rounds exist AND player in zero `pod_players` rows"; timestamp comparison mislabels late pre-round-1 joiners and reactivated drop-outs; the flag should clear the moment the player is paired
4. **Notification double-firing at two phase boundaries** — use per-boundary dedup `Set` ref (`timer.id + boundary-name`), drive firing from phase-transition detection (prev != current), never from `remaining === 0`; guard against object-identity-caused ref resets on Realtime row updates
5. **Mid-event badge flicker from Realtime invalidation race** — derive the flag from a single coherent query snapshot; default to not-flagged when uncertain; test that the badge clears without flicker after round generation (CONCERNS.md's `justJoinedRef` pattern is the precedent)
6. **HMR caching means the injected fault isn't actually running** — confirm each fault is live in the browser before recording a result; use `git checkout -- <file>` (not manual re-edit) to revert between faults; run `git status` to verify a clean tree; narrow the blanket `uncaught:exception` suppressor to specific Realtime websocket text so unexpected crashes still fail specs

## Implications for Roadmap

Two largely independent build tracks allow parallel execution after the migration lands. Track A (timer) is strictly ordered because each step is a prerequisite for the next. Track B (mid-event) and Track C (fault-injection) have no migration dependency and can start at any time, including before Track A completes.

### Phase 1: Timer Migration and Core Logic (Track A, steps 1-4)

**Rationale:** Everything client-side for the timer depends on `overtime_seconds` existing in the DB and in TypeScript types. Migration must be strictly first. The `useCountdown` phase engine and `useTimerNotification` dual-boundary logic are the highest-risk, most-tested units of the milestone — they belong in a dedicated phase with full unit coverage before any UI is layered on.

**Delivers:** `00005_timer_overtime.sql` (column + `generate_round` param + `pause_timer` clamp removal); updated `RoundTimer` type; `useCountdown` with three-phase derivation and extended `CountdownState`; `useTimerNotification` with per-boundary dedup; Vitest + Stryker at 100% kill for all new branches

**Addresses:** Table-stakes timer phases (all three), admin pause/resume correctness in overtime and count-up

**Avoids:** Pitfalls 1 (single-phase model), 2 (pause clamp), 3 (clock skew — add server-time offset here), 4 (notification mis-fire), 5 (reconnect/refresh loses phase), 8 (duplicate active timers — add partial unique index in `00005`), 9 (urgency thresholds miss overtime), 11 (zero-crossing off-by-one)

**Research flag:** None — architecture and migration pattern fully specified. Phase 1 planner should make two explicit design decisions before coding: (a) server-time offset mechanism (`select now()` RPC vs. response `Date` header); (b) `extend_timer` per-phase semantics (recommended: push the current phase's active boundary).

### Phase 2: Timer UI and Admin Controls (Track A, steps 5-7)

**Rationale:** Depends entirely on Phase 1's hook output (`phase`, per-phase `value`). Once `useCountdown` returns the correct phase structure, `TimerDisplay` and `AdminControls` are standard React component changes with low blast radius.

**Delivers:** `TimerDisplay.tsx` with phase-aware labels and three-state urgency styling; `AdminControls.tsx` with 80+20 preset option; `useGenerateRound.ts` passing `overtimeMinutes`; Cypress E2E on `timer.cy.js` exercising all three phases via dynamic `expires_at` fixtures; Stryker on any changed hooks

**Addresses:** Glanceable per-phase UX (amber OVERTIME identity, `+mm:ss` count-up), 80+20 picker preset, extend/cancel semantics across all phases

**Avoids:** Pitfall 10 (extend semantics undefined — define and test extend in each phase), Pitfall 9 (urgency thresholds)

**Research flag:** None — standard React component work with established Tailwind urgency class pattern.

### Phase 3: Mid-Event Join UX (Track B — parallelizable with Phases 1-2)

**Rationale:** Zero migration dependency. The pod-participation detection approach is fully specified by research. This is the lower-risk, highest-visibility quick win of the milestone — a persistent badge requires only a new pure helper, `EventPage` derivation, and a prop thread through `PlayerList` → `PlayerItem`.

**Delivers:** `src/lib/mid-event.ts` pure helper (with unit tests + Stryker); `EventPage` `midEventPlayerIds` Set derived from round + pod data; persistent "Joined R{N}" badge in `PlayerItem` (distinct from the existing 400ms `isNew` flash); Cypress mid-event E2E spec

**Addresses:** Persistent mid-event join indicator, "Joined R{N}" round-scoped wording, badge auto-clearing on first pairing

**Avoids:** Pitfall 6 (timestamp detection — use pod participation), Pitfall 7 (Realtime race — single-snapshot derivation, default to not-flagged)

**Research flag:** None — key detection decision resolved by research (pod participation wins over `created_at` comparison; do not revisit).

### Phase 4: Fault-Injection E2E Campaign Completion (Track C — parallelizable)

**Rationale:** The 21 pending faults in `.planning/debug/fault-injection-batch1.md` are independent of the timer and mid-event work. They can run on the existing codebase before, during, or after the other phases. The process discipline is the risk here, not the code.

**Delivers:** Completed batch-1 campaign results table (all 21 faults marked KILLED/SURVIVED with verified symptom match); narrowed `uncaught:exception` suppressor; `git checkout` revert discipline between faults; honest scope statement that results cover frontend assertions only (not DB/RPC behavior)

**Addresses:** Test coverage confidence, mutation campaign integrity

**Avoids:** Pitfall 12 (global suppression hides crashes), Pitfall 13 (HMR/cache fault not running), Pitfall 14 (mocked-only blind spot — acknowledge scope honestly), Pitfall 15 (flake misattributed as KILLED), Pitfall 16 (incomplete revert contaminates)

**Research flag:** None — process is fully specified. If any fault requires a real Supabase backend, wire `SUPABASE_URL`/`SUPABASE_ANON_KEY` into `cypress.config.js` and `cypress.yml` before running (the unused `createRealEvent` command is already the seed).

### Phase Ordering Rationale

- **Migration strictly first within the timer track:** `useCountdown`, `TimerDisplay`, and `AdminControls` all require `overtime_seconds` to exist in the DB and in TypeScript before they can be written or tested
- **Core hook before UI:** The `useCountdown` phase engine is the highest-mutation-risk unit; isolating it in Phase 1 allows full Stryker coverage before any UI dependencies are added
- **Mid-event and fault-injection are independent:** They share no code paths with the timer migration; running them in parallel reduces total calendar time
- **Pitfall 2 (`pause_timer` clamp) belongs in Phase 1:** The clamp is a migration-level change; deferring it risks shipping a timer that silently resets overtime position — this is a correctness requirement, not an enhancement
- **Partial unique index (Pitfall 8) belongs in `00005`:** Add `CREATE UNIQUE INDEX ON round_timers(event_id) WHERE status IN ('running','paused')` while the migration is open; prevents the duplicate-active-timer bug class before any new timer format lands

### Research Flags

Phases needing `--research-phase` during planning: **none** — all four tracks are fully specified by the combined research. Phase 1 warrants an explicit design sign-off on `pause_timer` signed-remaining semantics and `extend_timer` per-phase behavior before implementation begins, but this is a design decision from existing knowledge, not a research gap.

Phases with standard patterns (skip research-phase): all four phases follow established patterns already present in the codebase (additive migration, hook extension, component prop threading, Cypress `cy.intercept` fault injection).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed against `package.json` (2026-06-27); no new dependencies; all capabilities verified by reading source files directly |
| Features | HIGH (timer) / MEDIUM (mid-event) | Timer conventions verified against MTR official rules + tabletop timer apps; mid-event badge UX synthesized from tournament software behavior (no single canonical reference) |
| Architecture | HIGH | Grounded entirely in current source: `00004_timer_system.sql`, `useCountdown.ts`, `useTimer.ts`, `useTimerNotification.ts`, `PlayerItem.tsx`, `AdminControls.tsx`, `database.ts` |
| Pitfalls | HIGH | Each pitfall rooted in specific line references in the current codebase; no speculative pitfalls included |

**Overall confidence:** HIGH

### Gaps to Address

- **`extend_timer` cross-phase semantics (Pitfall 10):** Research specifies "define and test extend in each phase" but defers the UX call. Phase 2 planner must decide explicitly: recommended default is "extend pushes the current phase's active boundary" (main phase → pushes `expires_at` later; overtime phase → pushes `overtime_seconds` effective end later; count-up → re-opens a countdown from the current position).
- **Server-time offset implementation (Pitfall 3):** Research identifies the need; Phase 1 planner chooses the mechanism (Supabase `select now()` RPC vs. response `Date` header). Either is low-cost; document the choice.
- **Column naming resolved:** ARCHITECTURE.md's `overtime_seconds INTEGER NOT NULL DEFAULT 0` is the definitive stored column name; STACK.md's `overtime_minutes` refers to the `generate_round` RPC parameter (`p_overtime_minutes`) which converts to seconds internally. This is resolved — state it clearly in Phase 1 to prevent drift.
- **Mid-event detection resolved:** ARCHITECTURE.md's `created_at` comparison is overruled by PITFALLS.md Pitfall 6 — use pod participation. This is resolved — do not revisit in Phase 3.
- **Fault-injection real-backend scope:** If any of the 21 faults targets real RPC/DB behavior, `createRealEvent` command needs Supabase env wiring. Scope decision belongs in Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00004_timer_system.sql` — `round_timers` schema, all timer RPCs, `pause_timer` clamp at line 185, `resume_timer` at line 233, Realtime/REPLICA IDENTITY
- `src/hooks/useCountdown.ts` — count-up/overtime already implemented; `isOvertime = remainingSeconds <= 0`; `formatDisplay` `+M:SS` path
- `src/hooks/useTimerNotification.ts` — single zero-crossing dedup by `timer.id` at line 46; iOS PWA `try/catch`; `tag` field at line 51
- `src/hooks/useTimer.ts`, `useGenerateRound.ts`, `useRounds.ts`, `useEventChannel.ts` — existing query/mutation/Realtime wiring
- `src/components/TimerDisplay.tsx`, `AdminControls.tsx` (line 179), `PlayerItem.tsx` (line 3, line 11) — existing urgency classes, OVERTIME label, `isNew` flash
- `src/types/database.ts` (line 37) — `RoundTimer` shape
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `TESTING.md` — known gaps, Realtime reconnect, unfiltered pods subscription, `justJoinedRef` race, mocked-only E2E, unused `createRealEvent`
- `.planning/debug/fault-injection-batch1.md` — 21 pending faults across 4 specs
- `package.json` — exact installed versions (2026-06-27)

### Secondary (MEDIUM confidence)
- [MTR Appendix B — Time Limits](https://blogs.magicjudges.org/rules/mtr-appendix-b/) — official round/overtime structure
- [MTR 2.4 End-of-Match Procedure](https://blogs.magicjudges.org/rules/mtr2-4/) — additional-turns / end-of-round procedure
- [WotC MTR Apr 21 2025](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2025_Apr%2021_EN.pdf) — current tournament rules
- [TopDeck.gg tournament operations](https://topdeck.gg/features/tournament-operations) — late-player add/drop as standard TO function

### Tertiary (MEDIUM confidence — conventions, not authoritative specs)
- [EventTimer game timer](https://www.eventtimer.io/tools/game-timer) — count-up `+M:SS` display convention
- [Shared Board Game Timer](https://sharedgametimer.com/features) — admin controls, pause, round management
- [Multiplayer Addendum to MTR](https://juizes-mtg-portugal.github.io/multiplayer-addendum-mtr) — Commander-specific overtime turns

---
*Research completed: 2026-06-27*
*Ready for roadmap: yes*
