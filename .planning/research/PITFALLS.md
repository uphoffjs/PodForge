# Pitfalls Research

**Domain:** Real-time MTG Commander pod-pairing web app (React 19 + Vite + Supabase Postgres/Realtime) — v5.0 feature additions to a shipped, fully-tested system
**Researched:** 2026-06-27
**Confidence:** HIGH (grounded in the actual v2.0 timer code, RPCs, and notification logic in this repo; Postgres/Realtime semantics are well-established)

> Scope note: this milestone adds three features to an existing system — (1) mid-event join UX, (2) an 80+20 three-phase round timer, (3) finishing the batch-1 fault-injection E2E campaign. The pitfalls below are specific to *adding these to the current architecture*, not generic web-app advice. They are grounded in:
> - `src/hooks/useCountdown.ts` — single-phase countdown, `isOvertime: remainingSeconds <= 0`, ticks only when `status === 'running'`
> - `supabase/migrations/00004_timer_system.sql` — `pause_timer` clamps `remaining_seconds = GREATEST(0, ...)`; `resume_timer` sets `expires_at = now() + remaining`; one `expires_at` / one `duration_minutes` per timer
> - `src/hooks/useTimerNotification.ts` — fires once at `remainingSeconds <= 0 && isOvertime`, deduped by `timer.id`
> - `src/hooks/useEventChannel.ts` — Realtime invalidation; reconnect not user-visible (per CONCERNS.md)
> - `.planning/debug/fault-injection-batch1.md` — 21 pending faults across 4 specs
>
> Roadmap phases do not exist yet for v5.0; pitfalls are mapped to the three feature areas, referred to as **Phase: Timer-80+20**, **Phase: Mid-Event-Join**, and **Phase: Fault-Injection-E2E**.

---

## Critical Pitfalls

### Pitfall 1: Reusing the single-phase `expires_at <= 0` overtime model for the 80+20 format

**What goes wrong:**
The current system models overtime as "remaining went negative" (`useCountdown.ts:82` → `isOvertime: remainingSeconds <= 0`, displayed as `+M:SS`). The 80+20 format has **three distinct phases**: (a) 80-min main counting **down** 80:00→0:00, (b) a 20-min overtime counting **down** 20:00→0:00, (c) a count-**up** phase past zero (+0:00, +1:00…). If you naively set `duration_minutes = 80` and let it go negative, you get "main down then count up" and the 20-min overtime-countdown phase simply does not exist. If instead you set `duration_minutes = 100`, you get a single 100→0 countdown then count-up — there is no visual reset to "20:00 overtime," which is the whole point of the feature.

**Why it happens:**
The existing schema has exactly one `expires_at` and one `duration_minutes`. Developers reach for the smallest change ("just bump the duration") instead of modeling the phase transition. A single monotonic value cannot express "count down, then count down again from a fresh value, then count up."

**How to avoid:**
Model phases explicitly. Two clean options:
- **Two boundary timestamps:** store `main_expires_at` (start + 80m) and `overtime_expires_at` (start + 100m). Derive phase from `now()`: `now < main_expires_at` → main (display `main_expires_at - now`); `main_expires_at <= now < overtime_expires_at` → overtime (display `overtime_expires_at - now`, counts 20:00→0:00); `now >= overtime_expires_at` → count-up (display `now - overtime_expires_at`, with `+` prefix). The 80 and 20 should be columns, not magic numbers.
- **Phase + per-phase duration** column, recomputing `expires_at` on each transition (heavier; needs a trigger or client-driven transition — avoid, less server-authoritative).
Keep the old single-phase format working (existing events / 60-90-120 presets) — make 80+20 an additive format, not a replacement, so the migration is backward-compatible.

**Warning signs:**
The overtime phase never shows "20:00"; or it jumps straight from 0:00 to +0:01 with no second countdown; or `computeUrgency` returns `'expired'` the moment main hits zero (it should be a distinct overtime urgency).

**Phase to address:** Phase: Timer-80+20

---

### Pitfall 2: `pause_timer`'s `GREATEST(0, …)` clamp destroys overtime and count-up position

**What goes wrong:**
`pause_timer` (migration `00004_timer_system.sql:185`) stores `remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (expires_at - now()))::INTEGER)`. The `GREATEST(0, …)` floor means any pause after the main timer has passed zero records `remaining_seconds = 0`. Then `resume_timer` (`:233`) sets `expires_at = now() + (0 * interval)` = `now()`, so the timer instantly re-expires. For the 80+20 format an admin will very plausibly pause **during overtime** (to discuss a ruling) or **during count-up** (round ran long). With the current clamp, pausing in those phases loses all position — resume snaps back to 0:00 and any count-up elapsed is erased.

**Why it happens:**
The v2.0 clamp was a reasonable guard for the old single-phase timer where "below zero" had no meaningful resume target. The 80+20 feature makes negative/overtime/count-up positions first-class, but the pause RPC was written before those existed.

**How to avoid:**
Make pause/resume **phase-aware and sign-preserving**. Store the *signed* offset from the phase boundary (or store `paused_at` plus the two boundary timestamps and recompute on resume by shifting both `main_expires_at` and `overtime_expires_at` forward by the paused duration). The cleanest model: on resume, advance both boundary timestamps by `(now() - paused_at)` so the relative phase position is preserved regardless of whether you paused in main, overtime, or count-up. Drop the `GREATEST(0, …)` clamp from the count-up path. Add explicit unit + RPC tests for "pause during overtime → resume preserves overtime remaining" and "pause during count-up → resume continues counting up from the same elapsed."

**Warning signs:**
Pause then resume during overtime jumps the display to 0:00 or +0:00; count-up value resets after a resume; `remaining_seconds` is `0` in the DB whenever a pause happened past the 80-min mark.

**Phase to address:** Phase: Timer-80+20

---

### Pitfall 3: Count-up phase amplifies client clock skew (the "server-authoritative" claim is only half true)

**What goes wrong:**
Despite the "server-authoritative" design, `computeRemaining` (`useCountdown.ts:24`) computes `new Date(expires_at).getTime() - Date.now()` using the **client's** `Date.now()`. The server only supplies `expires_at`; each client subtracts its own wall clock. In the countdown phases a few seconds of skew is cosmetic. In the **count-up** phase it is not: count-up has no zero floor, so a client whose clock is +3 min fast displays `+3:00` the instant overtime ends and keeps a permanent 3-minute lead over everyone else and over reality. Two phones in the same room visibly disagree on how far over the round has run — exactly the glanceable shared clock the app promises.

**Why it happens:**
Phone clocks drift, especially with manual time set or bad NTP. The countdown direction previously hid the error inside a shrinking number; count-up exposes and accumulates it. Nobody noticed in v2.0 because overtime was a minor edge and skew partially cancels in a shrinking countdown.

**How to avoid:**
Measure a server-time offset once and apply it everywhere. On load, fetch server time (e.g. a lightweight `select now()` RPC, or read the `Date` response header from a Supabase request) and compute `offset = serverNow - Date.now()`; use `Date.now() + offset` instead of bare `Date.now()` in `computeRemaining`. Re-sync the offset on reconnect/visibility-refocus (you already have `useVisibilityRefetch`). Cap acceptable skew and surface a subtle "clock out of sync" hint if `|offset|` is large. Add a test that injects a skewed clock and asserts count-up matches server-derived elapsed within tolerance.

**Warning signs:**
Two devices show different count-up values for the same round; count-up starts at a non-zero `+M:SS` the moment overtime ends; QA on a device with a deliberately wrong clock shows a large offset.

**Phase to address:** Phase: Timer-80+20

---

### Pitfall 4: Notification double-firing (or wrong-boundary firing) at the two phase transitions

**What goes wrong:**
`useTimerNotification.ts:46` fires a single "Time's Up!" notification when `remainingSeconds <= 0 && isOvertime`, deduped by `timer.id`. The 80+20 format introduces **two** meaningful zero-crossings: end of main (80:00 → overtime begins) and end of overtime (100:00 → count-up begins). Three failure modes: (a) you keep the single trigger and it fires at the wrong moment (the main→overtime boundary, when the round is *not* actually over); (b) you add a second trigger but reuse the `timer.id` dedup key, so only the first boundary ever notifies; (c) you fire on every tick because the dedup ref resets when the Realtime row update replaces the `timer` object identity, re-running the effect with `remaining <= 0` still true.

**Why it happens:**
The dedup is keyed by `timer.id` for a world with one zero-crossing per timer. Two boundaries per timer breaks that 1:1 assumption. The effect depends on `[countdown, timer, permission]`, and `countdown` changes every second — only the ref guards re-firing, so any ref-reset path re-arms it.

**How to avoid:**
Decide deliberately which boundaries notify (likely: a gentle "Overtime started" at main→overtime, and the firm "Round over / sudden death" at overtime→count-up — or only the latter). Use **per-boundary dedup keys**: e.g. a `Set` ref holding `"${timer.id}:overtime-start"` and `"${timer.id}:countup-start"`, not a single string. Drive notifications off a **phase-transition detection** (previous phase ≠ current phase) rather than `remaining <= 0`, so it is impossible to fire mid-phase. Guard against object-identity resets by keying dedup on `timer.id` + boundary name only, never on the `timer` reference.

**Warning signs:**
Notification fires when overtime *begins* but labels it "round over"; only one of the two boundaries ever notifies; repeated notifications every second after a Realtime update; the dedup `Set` is empty after a pause/resume cycle.

**Phase to address:** Phase: Timer-80+20

---

### Pitfall 5: Reconnect / refresh during count-up loses or misreports phase

**What goes wrong:**
`useCountdown` re-derives everything from the `timer` row on mount and on `[timer]` change, which is correct *if* the row carries enough state to reconstruct all three phases. If the 80+20 state is partly held client-side (e.g. a local "we entered count-up" flag, or a local interval that incremented an in-memory counter), then a page refresh, a tab backgrounded on a phone, or a Realtime reconnect drops that client state and the timer reconstructs the wrong phase — e.g. shows main countdown again, or restarts count-up from +0:00. The existing app already has a "Realtime reconnect not user-visible" gap (CONCERNS.md) and relies on `useVisibilityRefetch` as the only backstop.

**Why it happens:**
Count-up has no natural anchor in a single `expires_at`; developers are tempted to track elapsed in component state. Phones aggressively suspend backgrounded tabs, freezing `setInterval`; on resume the interval is stale and the only truth is the server row — which must be self-sufficient.

**How to avoid:**
Keep **all** phase state derivable from server columns (the two boundary timestamps + status + paused_at), never from client-only counters. The render must be a pure function of `(timer row, server-corrected now)`. Re-sync server-time offset and refetch the timer row on `visibilitychange` and on Realtime `SUBSCRIBED`/reconnect. Add an E2E (or component) test that reloads mid-count-up and asserts the displayed value continues correctly rather than resetting.

**Warning signs:**
Backgrounding the phone then returning shows a frozen or reset count-up; refresh during overtime restarts at 20:00; the only place count-up elapsed lives is a `useState`/`useRef` counter.

**Phase to address:** Phase: Timer-80+20

---

### Pitfall 6: Mis-detecting "mid-event join" by join timestamp instead of round participation

**What goes wrong:**
The intuitive detection is `player.created_at > round1.created_at`. This is wrong for the exact case called out in the milestone: a player who joined **before round 1 but after other players** is *not* a mid-event joiner — they were simply late to register before the first pairing, and the algorithm already gave them a fair empty history. Timestamp comparison also mislabels: reactivated drop-outs (joined early, dropped, came back — they have history), players added by an admin before round 1, and clock-skewed `created_at` values. The flag should mean "this player has not yet played a round," not "this player's row is newer than round 1's row."

**Why it happens:**
`created_at` is the obvious available field, and "joined late" intuitively maps to a timestamp. But the *semantic* condition is participation, and CONCERNS.md/FUTURE-02 confirms the algorithm already handles mid-joiners "by accident" via empty opponent history + 0 byes — so the only real work is a correct **derived flag**, and the derivation is where the bug lives.

**How to avoid:**
Derive the indicator from **pod participation**, not timestamps: a player is "joined mid-event" iff at least one round exists **and** the player appears in **no** `pod_players` row of any existing round. This naturally: (a) excludes pre-round-1 late registrants (once round 1 includes them they have a pod row); (b) correctly clears the flag the moment the player is assigned to their first round; (c) handles reactivated players correctly (they *do* have prior pod rows → not flagged). Do **not** persist a boolean column you have to keep in sync — compute it from `rounds` + `pod_players` data already fetched for the player list.

**Warning signs:**
A player who registered 30 seconds before round 1 (after their friends) is flagged "new mid-event"; a reactivated drop-out is flagged as a fresh joiner; the flag persists after the player has been paired into a round; the implementation reads `created_at` anywhere in the detection.

**Phase to address:** Phase: Mid-Event-Join

---

### Pitfall 7: Mid-event join flag stales out due to Realtime invalidation race

**What goes wrong:**
The flag is derived from `rounds` + `pod_players`. When the admin generates the next round, multiple Realtime events land asynchronously (new `rounds` row, new `pods`, new `pod_players`) and trigger separate `invalidateQueries` (and per CONCERNS.md, the `pods`/`pod_players` subscriptions are *unfiltered by event_id*). For a brief window the player list has refetched but the new `pod_players` for the just-generated round have not, so a player who was just paired still computes as "mid-event join." Conversely a new joiner mid-round can briefly flash the flag on/off as queries settle. The existing `justJoinedRef` race (CONCERNS.md, EventPage) shows this class of bug already bites here.

**Why it happens:**
Multiple independent query keys feed one derived boolean, and Realtime delivers their invalidations out of order with no transactional grouping on the client. The unfiltered `pods`/`pod_players` subscriptions add cross-event noise.

**How to avoid:**
Compute the flag from a **single coherent snapshot** — ideally the same query that already returns the player's pod assignments for the current round, so "has a pod this round" and "is flagged new" come from one fetch and can't disagree. Treat the flag as derived UI state with a clear default (when uncertain, prefer *not* flagging to avoid flicker). Debounce/settle the derived value across the invalidation burst, or gate it on "current round's pods finished loading." Add a test that generates a round and asserts the flag clears for the newly-paired player without an intermediate flicker.

**Warning signs:**
The "new" badge flickers on a player right after a round generates; a just-paired player keeps the badge until a manual refetch; the badge appears on players in unrelated concurrent events (cross-event invalidation leak).

**Phase to address:** Phase: Mid-Event-Join

---

### Pitfall 8: Timer RPC `ORDER BY created_at DESC LIMIT 1` picks the wrong timer under rapid admin actions / multi-admin

**What goes wrong:**
Every timer RPC (`pause`/`resume`/`extend`/`cancel`) selects the target timer via `WHERE event_id = … AND status IN (…) ORDER BY created_at DESC LIMIT 1`. `created_at DEFAULT now()` has at best millisecond resolution and `now()` is the **transaction** timestamp. If two timers are created in quick succession (admin double-clicks "Generate Next Round," or — per FUTURE-01 — two simultaneous admins both generate), two `round_timers` rows can share the same `created_at`, making "the latest timer" nondeterministic. The 80+20 work touches this code; adding columns or a second insert path raises the odds of two near-simultaneous active timers.

**Why it happens:**
`created_at` is being used as a uniqueness/ordering key it doesn't guarantee. The system has no admin concurrency control (FUTURE-01 deferred). `generate_round` cancels existing active timers then inserts a new one, but two concurrent `generate_round` transactions can interleave so both see "no active timer to cancel" and both insert.

**How to avoid:**
Pick the active timer **deterministically**: tie-break by `id`, or better, enforce "at most one active timer per event" with a partial unique index (`CREATE UNIQUE INDEX … ON round_timers(event_id) WHERE status IN ('running','paused')`) so a concurrent insert fails loudly instead of creating a duplicate. Make `generate_round`'s cancel+insert atomic with `SELECT … FOR UPDATE` on existing active timers. This also hardens the count-up phase, where a stray second "active" timer would make pause/extend operate on the wrong row.

**Warning signs:**
Pause/extend appears to do nothing (it hit a different timer row); two `running` timers exist for one event; double-clicking Generate creates two timers; intermittent "No running timer found" errors right after generation.

**Phase to address:** Phase: Timer-80+20 (harden the RPCs while they're being modified)

---

## Moderate Pitfalls

### Pitfall 9: `computeUrgency` thresholds don't cover overtime — styling goes wrong at phase boundaries

**What goes wrong:** `computeUrgency` (`useCountdown.ts:27`) returns `'expired'` for any `remaining <= 0`. In 80+20, the 20-min overtime is a meaningful "danger but not over" phase and count-up is "definitely over." Reusing the function paints overtime with expired styling (or vice versa).
**How to avoid:** Make urgency a function of **phase**, not just a signed remaining value: main→normal/warning/danger by threshold; overtime→its own urgency; count-up→expired. Unit-test each phase boundary's class. **Phase:** Timer-80+20.

### Pitfall 10: `extend_timer` semantics undefined for overtime/count-up

**What goes wrong:** `extend_timer` adds minutes to `expires_at` (running) or `remaining_seconds` (paused). With phase boundaries, "+5 min" is ambiguous — does it extend the main phase, the overtime, or push the count-up start later? The current code adds to the single `expires_at` and may silently shift the wrong boundary.
**How to avoid:** Define extend explicitly for the format: most likely it should push the **overtime boundary** (more play time) by shifting `overtime_expires_at` and re-deriving phase. Document and test extend in each phase. **Phase:** Timer-80+20.

### Pitfall 11: Off-by-one / skipped-second at the zero crossing

**What goes wrong:** The 1s `setInterval` plus `Math.floor` can skip displaying exactly `0:00` or display it twice depending on when the tick lands, which matters when a phase transition and a notification key off the crossing.
**How to avoid:** Drive transitions off the derived phase comparison (prev vs current phase), which is robust to which exact second renders, rather than off `remaining === 0`. Align ticks or accept that `0:00` may not render — never gate logic on it. **Phase:** Timer-80+20.

### Pitfall 12: Global `uncaught:exception` suppression hides genuine fault-injection failures (false negatives)

**What goes wrong:** `cypress/support/e2e.js` suppresses all WebSocket/Realtime `uncaught:exception`s. A fault that breaks behavior by throwing an error caught by that blanket handler can let the spec pass — recording the fault as **SURVIVED** (test looks weak) or masking that the app actually crashed. With `retries: 0`, a real render crash from an injected fault might be swallowed.
**How to avoid:** During the campaign, narrow the suppressor to only the known Realtime websocket message (match on the specific error text), so unexpected exceptions still fail the test. Verify each fault is actually *loaded* in the browser (see Pitfall 13) before trusting a result. **Phase:** Fault-Injection-E2E.

### Pitfall 13: Vite HMR / dev-server caching means the injected fault isn't actually running

**What goes wrong:** The campaign edits source files while Cypress runs against the Vite dev server. If HMR hasn't applied the edit (or applied a partial hot update that preserved state), the browser runs the *unmodified* code. You then record a result for code that was never faulted — a false KILLED or false SURVIVED, invalidating the campaign's signal.
**How to avoid:** After each edit, confirm the fault is live before running (hard-reload, or assert the visible symptom manually once), or run against a fresh `vite build`/preview per fault rather than HMR. Treat "test result with unverified fault application" as no data. **Phase:** Fault-Injection-E2E.

### Pitfall 14: Mocked-only E2E cannot catch DB/RPC-level faults (over-mocking blind spot)

**What goes wrong:** All 14 specs use `cy.intercept` stubs (TESTING.md; `createRealEvent` command is unused). Fault-injection on frontend source proves the assertions catch *frontend* regressions but says nothing about the real `app → PostgREST → RPC → Realtime` path. The known `allowPodsOf3` vs DB-minimum-4 mismatch (CONCERNS.md) is exactly a fault mocked tests structurally cannot see.
**How to avoid:** Scope the campaign's conclusions honestly: it validates frontend behavior coverage only. Flag DB-level invariants (passphrase gating, min-player checks, timer RPC correctness) as needing a small real-Supabase integration suite — the unused `createRealEvent` command is the seed. Do **not** claim "E2E coverage verified" for RPC logic. **Phase:** Fault-Injection-E2E.

### Pitfall 15: Attributing flaky-test failures to the injected fault (false KILLED)

**What goes wrong:** With `retries: 0` and Realtime/`cy.wait` timing, a spec can fail for flake reasons unrelated to the fault. The campaign records it as KILLED (fault detected) when the test is actually just flaky — overstating test strength.
**How to avoid:** Before injecting, confirm each spec passes green on unmodified code (baseline). After injecting, confirm the failure mode matches the fault's expected symptom (right assertion failed, not a timeout). Re-run suspicious KILLs on clean code to rule out flake. Prefer `cy.intercept`-aliased waits over time-based waits (already the standard per CLAUDE.md). **Phase:** Fault-Injection-E2E.

### Pitfall 16: Incomplete revert between faults contaminates later results

**What goes wrong:** 21 sequential edits across 7+ source files. A missed revert leaves a prior fault active, so a later spec fails for the wrong reason (cross-contamination), corrupting the results table.
**How to avoid:** Revert via `git checkout -- <file>` (not manual re-editing) after each fault, and run `git status`/`git diff` to confirm a clean tree before the next injection. Inject exactly one fault at a time. **Phase:** Fault-Injection-E2E.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Set `duration_minutes = 100` and reuse single-phase overtime for 80+20 | No schema/RPC change | No real overtime-countdown phase; feature is wrong; later rewrite | Never — it doesn't implement the spec |
| Track count-up elapsed in client `useState`/`useRef` | Simple, no DB columns | Resets on refresh/reconnect/background; clients disagree | Never — violates server-authoritative + reconnect safety |
| Keep `GREATEST(0, …)` clamp in `pause_timer` | Untouched RPC | Pausing in overtime/count-up loses position | Never for 80+20; fine only for legacy single-phase timers |
| Detect mid-join via `created_at > round1.created_at` | One field, trivial | Mislabels late pre-round-1 joiners & reactivated players | Never — use pod participation |
| Persist a `joined_mid_event` boolean column | Cheap read | Must be kept in sync; goes stale | Only if derived value is too expensive (it isn't here) |
| Keep blanket `uncaught:exception` suppression during campaign | No spec edits | Hides real crashes → false fault results | Only outside the fault-injection campaign |
| Conclude "E2E verified" from mocked-only faults | Fast sign-off | DB/RPC faults remain uncaught (allowPodsOf3 bug class) | Only with an explicit "frontend-only" caveat |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Postgres `now()` for timer math | Mixing `now()` (txn time) with `clock_timestamp()`, or comparing against client `Date.now()` without offset | Keep all boundary timestamps server-computed with `now()`; client subtracts a measured server-time offset, never bare `Date.now()` |
| Supabase Realtime on `round_timers` | Assuming the local interval and the Realtime row are always consistent during a pause/extend | Treat the server row as sole truth; on every timer Realtime event, recompute phase from the row; re-sync time offset on `SUBSCRIBED`/reconnect |
| Realtime `pods`/`pod_players` (unfiltered by event_id, per CONCERNS) | Deriving the mid-join flag from these and trusting per-key invalidation order | Derive from a single coherent query; settle the value across the invalidation burst; ignore cross-event noise |
| Timer RPC target selection | `ORDER BY created_at DESC LIMIT 1` assumes a unique latest timer | Add a partial unique index for one active timer per event; deterministic tie-break; `FOR UPDATE` in generate_round |
| PostgREST timestamp serialization | Parsing `expires_at` as naive/local time | TIMESTAMPTZ serializes as ISO-8601 with offset; always parse via `new Date(...)` and keep everything UTC end-to-end |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-syncing server-time offset every tick | Extra RPC per second; jittery display | Sync once on load + on reconnect/visibility, cache offset | Any multi-client event |
| Mid-join flag recomputed from full `allRoundsPods` each render | Re-derivation cost grows with rounds | Derive from current-round pod query already fetched; memoize | Long events (8+ rounds) — same class as existing eager `allPods` fetch (CONCERNS) |
| Count-up `setInterval` running while tab backgrounded on phones | Frozen/stale timer on resume | Recompute from server row + offset on `visibilitychange`, don't trust the interval | Mobile (primary platform) every backgrounding |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New 80+20 timer-format RPC path skips passphrase validation | Anyone could start/alter timers (mirrors the existing add-player RLS bypass in CONCERNS) | Every new/modified timer RPC must `crypt(p_passphrase, hash)`-validate exactly like the existing four |
| Trusting client-sent phase/elapsed for the timer | Client could fake "round over" or extend indefinitely | Phase and elapsed are derived **server-side** from boundary timestamps; client sends only the action + passphrase |
| Mid-join flag driving an admin action without re-auth | Unprivileged user triggers admin confirmation flow | Any admin confirmation for mid-join joiners must go through the same passphrase-gated RPC pattern, not a client-only toggle |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Overtime and count-up styled identically to "expired" | Players can't tell "5 min sudden-death left" from "round over" | Distinct visual state per phase (main / overtime / count-up), each glanceable at arm's length |
| Count-up grows unbounded with no context | "+47:00" with no reference confuses | Always show alongside which phase / that the round is over; consider capping display verbosity |
| Mid-join badge that never clears | Player looks permanently "new," implies unfair treatment | Clear the badge the instant they're paired into a round (participation-based) |
| Badge flicker during round generation | Looks buggy on a shared screen | Settle derived flag across the Realtime invalidation burst; default to not-flagged when uncertain |
| Notification at main→overtime labeled "round over" | Players pack up early | Phase-correct copy: "Overtime started" vs "Round over" |

## "Looks Done But Isn't" Checklist

- [ ] **80+20 timer:** Often missing the *middle* phase — verify the 20-min overtime visibly counts **down** from 20:00 (not just main→count-up).
- [ ] **80+20 pause/resume:** Often missing overtime/count-up handling — verify pausing during overtime AND during count-up preserves exact position on resume (the `GREATEST(0,…)` clamp removed).
- [ ] **Count-up correctness:** Often missing clock-skew handling — verify two devices with different clocks agree on count-up via server-time offset.
- [ ] **Reconnect/refresh:** Often missing server-derivability — verify refresh and tab-background mid-count-up resume correctly, not reset.
- [ ] **Notifications:** Often missing per-boundary dedup — verify each of the two boundaries notifies exactly once with correct copy and survives a pause/resume.
- [ ] **Mid-join detection:** Often missing the "joined before round 1 but after others" case — verify that player is NOT flagged, and a reactivated drop-out is NOT flagged.
- [ ] **Mid-join clearing:** Verify the flag disappears once the player is assigned a pod.
- [ ] **Timer concurrency:** Verify only one active timer per event under double-click / two-admin generate.
- [ ] **Fault campaign:** Verify each fault was actually loaded (HMR applied) and the tree is clean (`git status`) before recording a result.
- [ ] **Fault campaign scope:** Verify the report states it covers frontend assertions only, not DB/RPC behavior.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Single-phase model shipped for 80+20 (Pitfall 1) | HIGH | Add boundary-timestamp columns via migration; rewrite `useCountdown` phase derivation; backfill existing timers as legacy format |
| Pause clamp destroyed overtime state (Pitfall 2) | MEDIUM | Remove `GREATEST(0,…)`; switch pause/resume to shift boundary timestamps; add regression tests |
| Clock skew in count-up (Pitfall 3) | LOW | Add server-time offset fetch + apply in `computeRemaining`; no schema change |
| Notification mis-fire (Pitfall 4) | LOW | Switch to phase-transition detection + per-boundary dedup `Set` |
| Mid-join mislabeled by timestamp (Pitfall 6) | LOW | Replace timestamp check with "rounds exist AND player in zero pods" derivation |
| Duplicate active timers (Pitfall 8) | MEDIUM | Add partial unique index; backfill-cancel stray timers; make generate_round cancel+insert atomic |
| Campaign results contaminated (Pitfalls 12–16) | MEDIUM | Re-baseline on clean tree; re-run affected faults with verified application and narrowed suppression |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Single-phase model reused for 80+20 | Phase: Timer-80+20 | Test shows three distinct phases incl. 20:00→0:00 overtime countdown |
| 2. Pause clamp destroys overtime/count-up | Phase: Timer-80+20 | RPC tests: pause+resume in overtime and in count-up preserve position |
| 3. Clock skew amplified in count-up | Phase: Timer-80+20 | Skewed-clock test matches server elapsed within tolerance |
| 4. Notification double/wrong-boundary fire | Phase: Timer-80+20 | Each boundary notifies once, correct copy, survives pause/resume |
| 5. Reconnect/refresh loses phase | Phase: Timer-80+20 | Reload + background mid-count-up resumes correctly |
| 6. Mid-join detection by timestamp | Phase: Mid-Event-Join | Late pre-round-1 & reactivated players NOT flagged; flag clears on pairing |
| 7. Mid-join flag Realtime race | Phase: Mid-Event-Join | No badge flicker after round generation; single-snapshot derivation |
| 8. Duplicate/ambiguous active timers | Phase: Timer-80+20 | Partial unique index; double-click/two-admin generate yields one timer |
| 9. Urgency thresholds miss overtime | Phase: Timer-80+20 | Per-phase urgency class asserted at each boundary |
| 10. Extend semantics undefined | Phase: Timer-80+20 | Extend tested + documented per phase |
| 11. Zero-crossing off-by-one | Phase: Timer-80+20 | Transitions keyed on phase change, not `remaining === 0` |
| 12. Global exception suppression hides faults | Phase: Fault-Injection-E2E | Suppressor narrowed; unexpected exceptions fail specs |
| 13. HMR/cache → fault not running | Phase: Fault-Injection-E2E | Each fault confirmed live before recording |
| 14. Mocked-only blind to DB faults | Phase: Fault-Injection-E2E | Report scoped "frontend-only"; DB integration flagged |
| 15. Flake misattributed as KILLED | Phase: Fault-Injection-E2E | Green baseline + symptom-matched failure per fault |
| 16. Incomplete revert contaminates | Phase: Fault-Injection-E2E | `git checkout` revert + clean `git status` between faults |

## Sources

- Repo code (HIGH): `src/hooks/useCountdown.ts`, `src/hooks/useTimerNotification.ts`, `src/hooks/useEventChannel.ts`, `supabase/migrations/00004_timer_system.sql`
- Repo planning docs (HIGH): `.planning/codebase/CONCERNS.md` (FUTURE-01/02, Realtime reconnect gap, unfiltered pods subscription, justJoinedRef race, timer overtime E2E gap), `.planning/codebase/TESTING.md` (mocked-only E2E, unused `createRealEvent`, `retries: 0`), `.planning/debug/fault-injection-batch1.md` (21 pending faults)
- Postgres / Supabase semantics (HIGH, well-established): `now()` = transaction timestamp (TIMESTAMPTZ, UTC); `GREATEST(0,…)` clamp behavior; partial unique indexes; `SELECT … FOR UPDATE`; PostgREST ISO-8601 timestamp serialization
- Established real-time clock patterns (MEDIUM-HIGH): server-authoritative time with client-measured offset is the standard fix for multi-client countdown skew

---
*Pitfalls research for: real-time MTG pod-pairing app — v5.0 (mid-event join, 80+20 timer, fault-injection E2E)*
*Researched: 2026-06-27*
