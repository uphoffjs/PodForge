# Feature Research

**Domain:** Live event / tournament management UX — round timers and mid-event participant flow (MTG Commander pod pairer)
**Researched:** 2026-06-27
**Confidence:** MEDIUM (timer conventions HIGH from MTG tournament rules + tabletop timer apps; mid-event-join indicator patterns MEDIUM — no single canonical reference, synthesized from tournament-software behavior and general live-event UX)

> Scope note: This is a v5.0 subsequent-milestone research pass. Only the two new v5.0 features are analyzed: **mid-event join UX** and the **80+20 round-timer format**. Existing shipped features (event creation, join, pod generation, single-period timer with 60/90/120 presets, admin controls) are treated as fixed substrate and referenced only where the new work depends on them.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Persistent "joined mid-event" indicator on player row** | When someone shows up at round 2, every other player/admin glances at the list and expects to see *who is new* — a transient flash isn't enough; it must persist until at least the next round. | LOW | Extend `PlayerItem`/`PlayerList`. App already has a 400ms "new player" CSS flash (`EventPage.tsx` `prevPlayerIdsRef`) — that is presence-change feedback, NOT a join-phase badge. Needs a real persistent badge ("New" / "Joined R3"). Requires knowing the round-at-join (see dependencies). |
| **80-min main period counts down (mm:ss)** | This is the existing countdown behavior at a new duration. Players expect a normal glanceable countdown. | LOW | Reuse `useCountdown` + `TimerDisplay`. New 80-min value is trivial; the format change is the multi-phase chaining below. |
| **Automatic transition main → overtime → count-up with no admin action** | Real MTG rounds flow timed-period → fixed additional turns → "finish the current turn" without anyone restarting a clock. Users expect the single timer to roll through all three phases server-authoritatively. | MEDIUM | Core of the feature. `round_timers` must encode phase boundaries so `expires_at`-style math yields the right phase. Must remain zero-drift / server-authoritative like the existing timer. |
| **Distinct visual treatment per phase (main vs overtime vs overrun)** | A player glancing at the phone must instantly know "are we in normal time, overtime, or already over?" without reading a label. Color/urgency cues are the primary signal. | MEDIUM | Existing urgency ladder (normal/warning/danger/expired) is single-period. Overtime needs its own identity (amber "OVERTIME") separate from main-period danger red, and overrun needs a clearly "past" red + `+` prefix. |
| **Notification at end of main period AND end of overtime** | Time-call moments are the actionable beats in a real round ("time is called, finish this turn cycle" / "round is over"). The existing single 0:00 notification maps to TWO distinct beats now. | MEDIUM | `useTimerNotification` currently fires once at zero. Must fire at two boundaries and not double-fire. De-dupe by phase, not by a single fired-flag. |
| **Count-up overrun display with `+` prefix** | Tabletop timer apps (EventTimer, Shared Board Game Timer) universally show count-up as elapsed-from-zero. A leading `+` (e.g. `+1:23`) is the readable convention for "this much past the deadline." | LOW | App already "counts up past zero" in the expired state per PROJECT.md — formalize the label/prefix and make it unbounded. |
| **Admin pause/resume/extend/cancel still work in every phase** | Admins expect their existing controls to keep working when a round is in overtime or overrun — a control that silently no-ops during overtime feels broken. | MEDIUM | `TimerControls` + RPCs must define what extend/pause mean per phase (see Timer Spec). Most subtle part of the feature. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **80+20 as a selectable preset alongside 60/90/120** | Matches a real tabletop round shape (timed round + fixed overtime) in one click — most generic timers can't express a two-phase round. This is the headline v5.0 timer value. | LOW–MEDIUM | Add to the duration picker in `AdminControls`. Picker currently emits a single minutes value; now must emit a format descriptor (main+overtime) — a small but real data-model change. |
| **"Joined R{N}" round-scoped badge (not just generic "new")** | Tells everyone *when* the player entered, which contextualizes their empty opponent history and 0-bye fairness — players intuitively understand "of course they have no repeats, they joined this round." | LOW | One extra field (round-at-join). Higher signal than a plain "New" pill at near-zero extra cost. |
| **Overtime phase labeled with semantic text, not just color** | "OVERTIME" / "FINAL TURNS" / "OVER BY +1:23" text removes ambiguity for colorblind users and on glance — stronger than color alone and cheap to add. | LOW | Accessibility win; pairs with the per-phase color states. |
| **Mid-event-join "event in progress" notice on the join form** | A player joining late gets a one-line heads-up ("Round 2 is underway — you'll be paired next round") so they aren't confused about why they're not in a pod yet. | LOW | Small conditional in `JoinEventForm`/`EventPage` keyed on whether a round exists. Sets expectations, reduces "why am I not in a pod?" confusion. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Admin must approve every mid-event join before the player appears** | Feels "controlled" / prevents trolls. | Breaks the app's whole "show up and play, no gatekeeping" model; adds a pending-state machine (`pending`/`approved`), a new admin queue UI, and Realtime states — high cost for a casual playgroup that already has admin remove-player. Creates a blocking dependency where none existed. | Keep open join. Surface the join clearly via the persistent badge; rely on existing **admin remove-player** as the corrective tool. (Optional: a *non-blocking* "needs confirm" flag could be a future toggle, but not default.) |
| **Auto-inserting a mid-round joiner into an already-generated pod** | "They're here, put them in a game." | Destabilizes an in-progress round (a pod becomes 5, seats shift, opponent-history is polluted mid-game). The algorithm already cleanly handles them *next* round with empty history + 0 byes. | Do nothing to the current round; badge them and pair them on the next "Generate Round." This is already the algorithm's designed behavior. |
| **Configurable arbitrary N-phase timer builder (custom periods)** | "Let me define any sequence of periods." | Massive UI + data-model surface for a casual tool; 80+20 and the existing flat presets cover real MTG round shapes. YAGNI. | Ship 80+20 as a named preset. If more shapes are ever needed, add named presets, not a builder. |
| **Hard auto-stop / auto-advance when overtime hits zero** | "End the round automatically." | Real tables need to *finish the current turn cycle* past zero — that's exactly why count-up exists. Auto-stopping hides how far over the table is running and removes admin judgment. | Count UP indefinitely after overtime; let the admin decide when to Generate Next Round (which supersedes the timer). |
| **Sound alarm at phase boundaries** | "We won't notice silently." | Explicitly out of scope per PROJECT.md (visual + browser notification only); sound is intrusive in a shared room of multiple pods. | Browser notification + distinct color flip at each boundary (already the established pattern). |

---

## Timer Specification — 80+20 Count-Down → Count-Down → Count-Up (FULL)

The single round timer progresses through three sequential phases. It remains **server-authoritative** (phase + remaining derived from stored timestamps, not client clocks) exactly like today's timer.

```
PHASE 1  MAIN          PHASE 2  OVERTIME        PHASE 3  OVERRUN
80:00 ───────► 0:00    20:00 ───────► 0:00      0:00 ───────► +∞
counts DOWN            counts DOWN              counts UP
```

| Phase | Range | Direction | Display | Suggested label | Color / urgency cue |
|-------|-------|-----------|---------|-----------------|----------------------|
| **1. Main** | 80:00 → 0:00 | down | `mm:ss` | (none, or "Round") | Reuse existing ladder within this phase: normal (>10m) → warning (~10–5m) → danger (<5m, red). |
| **2. Overtime** | 20:00 → 0:00 | down | `mm:ss` | **"OVERTIME"** (amber/orange `#f59e0b`) | Its OWN identity, visually distinct from Phase-1 danger so a glance distinguishes "almost out of main time" vs "in overtime." Amber matches the app accent; can re-run a mini warning/danger sub-ladder inside OT if desired. |
| **3. Overrun** | 0:00 → unbounded | **up** | `+mm:ss` (leading `+`) | **"OVER BY"** / "FINAL TURN" | Strong "past deadline" red, optionally subtle pulse. No upper bound; never auto-stops. |

**Boundary events (notifications):**
1. **Main → Overtime (main hits 0:00):** browser notification — e.g. *"Time called — overtime (20 min) has begun."* Display flips to the OVERTIME treatment.
2. **Overtime → Overrun (overtime hits 0:00):** browser notification — e.g. *"Round over — finish the current turn."* Display flips to the OVERRUN `+` count-up.
   - Must de-duplicate **per boundary** (each fires once), not via a single global fired-flag. Backgrounded-tab catch-up (`useVisibilityRefetch`) should not re-fire an already-passed boundary.

**Admin controls per phase (all phases unless noted):**
- **Pause / Resume:** freeze/continue the *current* phase's remaining (or elapsed, in overrun). Same server-stored-remaining model as today.
- **Extend (+5 min):** adds time to the **current phase**. In Main → pushes main 0:00 later. In Overtime → extends overtime. In Overrun → semantics decision needed: simplest is "re-enter a 5-min count-down" (effectively more overtime), or disable/relabel extend in overrun. **Recommend:** extend adds to the current phase; in overrun, extend re-opens a 5-min count-down. Document the chosen rule and test it.
- **Cancel:** clears the timer entirely in any phase (existing behavior).
- Generating the next round supersedes/clears the timer (existing behavior) — the normal way an admin ends an overrun.

**Data-model implication (server-authoritative):** `round_timers` must encode enough to compute *which phase and how much remaining/elapsed* from server time alone. Two clean options:
- (A) Store `main_duration`, `overtime_duration`, and a single `phase1_started_at` (+ paused-accumulation) — derive phase by elapsed vs cumulative boundaries. **Preferred** — one source of truth, survives pause/extend with accumulator math.
- (B) Store successive `expires_at` per phase. Simpler per-phase math but more columns and trickier pause semantics.

Either way `useCountdown` must return `{ phase, label, value, direction }` rather than a single signed number. Flat 60/90/120 timers map to "main only, no overtime/overrun phase."

---

## Feature Dependencies

```
80+20 Timer Format
    ├──requires──> round_timers schema: phase model (main + overtime durations)   [DB migration]
    ├──requires──> useCountdown returns {phase, direction, value}                  [hook change]
    ├──requires──> TimerDisplay multi-phase rendering + "+" prefix + labels        [component]
    ├──requires──> useTimerNotification fires at TWO boundaries (per-phase dedupe) [hook change]
    ├──requires──> AdminControls duration picker emits format (not bare minutes)   [component + RPC arg]
    └──affects───> TimerControls extend/pause semantics per phase                  [component + RPCs]

Mid-Event Join Indicator
    ├──requires──> round-at-join knowledge (new players column OR created_at vs round start)  [DB/derivation]
    ├──requires──> PlayerItem/PlayerList persistent badge                          [component]
    ├──enhances──> JoinEventForm "event in progress" notice                        [component]
    └──independent of──> pod algorithm (already handles empty history + 0 byes — NO change)

Mid-Event Join  ─conflicts─  Admin-approval-gated join (anti-feature; do NOT combine)
80+20 Timer     ─builds on─  existing single-period timer (60/90/120) — keep both
```

### Dependency Notes
- **80+20 requires a `round_timers` schema/migration:** today's row models one period; phases need a main+overtime representation. This is the critical-path, highest-risk piece — touches DB, RPCs (`pause/resume/extend_timer`), `useCountdown`, `TimerDisplay`, `useTimerNotification`. Flag for deeper phase-level design.
- **Mid-event badge requires round-at-join:** cheapest reliable approach is a nullable `joined_round_number` (or `joined_at_round_id`) stamped at insert in `useJoinEvent`/`useAddPlayer`; deriving from `created_at` vs round timestamps is possible but fragile around round boundaries. Prefer the explicit column.
- **Mid-event join is independent of the pod algorithm:** PROJECT.md confirms the algorithm already gives mid-joiners empty opponent history + 0 byes. v5.0 work is **display only** for joins — no algorithm change.
- **Two timer formats coexist:** 80+20 is an additional preset, not a replacement. Existing 60/90/120 flat timers must keep working; the data model must represent "no overtime phase" for them.

---

## MVP Definition (this milestone)

### Launch With (v5.0 core)
- [ ] **80+20 three-phase timer** (main count-down → overtime count-down → overrun count-up) with per-phase visuals + two boundary notifications — the headline feature.
- [ ] **80+20 preset** in the admin duration picker.
- [ ] **Persistent mid-event-join badge** on player rows ("New" / "Joined R{N}").
- [ ] **Admin controls (pause/resume/extend/cancel) defined and working across all three phases.**

### Add After Validation (v5.x)
- [ ] **"Event in progress" notice on the join form** for late joiners — set expectations.
- [ ] Sub-urgency ladder *within* overtime (warning at OT <5m).

### Future Consideration (v6+)
- [ ] Optional, admin-toggleable **non-blocking** "confirm new join" flag (NOT default; only if abuse is observed).
- [ ] Named custom presets beyond 80+20 (only if real demand; avoid the period-builder anti-feature).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 80+20 three-phase timer (display + phase engine) | HIGH | MEDIUM–HIGH | P1 |
| Two boundary notifications (per-phase dedupe) | HIGH | MEDIUM | P1 |
| 80+20 preset in admin picker | HIGH | LOW | P1 |
| Persistent mid-event-join badge | HIGH | LOW | P1 |
| Admin controls across all phases (extend semantics) | MEDIUM | MEDIUM | P1 |
| "Joined R{N}" round-scoped wording | MEDIUM | LOW | P2 |
| "Event in progress" join-form notice | MEDIUM | LOW | P2 |
| Sub-urgency ladder inside overtime | LOW | LOW | P3 |
| Admin-approval-gated join | LOW (negative) | HIGH | Anti — do not build |

## Competitor / Convention Analysis

| Concern | Real MTG tournament rules | Tabletop timer apps | Our v5.0 approach |
|---------|---------------------------|---------------------|-------------------|
| Round + overtime shape | Timed round, then a fixed *N additional turns* (5 turns; 3 in team play), then draw | Single configurable count-down or count-up | **Time-based 80+20** (fixed-minute overtime, not turn-counted) — simpler to automate than counting turns, fits a server clock |
| Past-deadline behavior | Players finish the current turn cycle | Count-UP from zero (EventTimer, Shared Board Game Timer) | Count UP with `+mm:ss`, unbounded; admin ends via next round |
| Boundary signaling | Judge calls "time" | Audio alert / presentation mode | Browser notification + distinct color flip (no sound, per scope) |
| Late player | TO adds late registrations manually mid-event | n/a | Open self-join + **persistent badge**; admin remove-player as corrective |

---

## Sources

- [MTR Appendix B — Time Limits (Magic Judges)](https://blogs.magicjudges.org/rules/mtr-appendix-b/) — HIGH (official round/overtime structure)
- [MTR 2.4 End-of-Match Procedure (Magic Judges)](https://blogs.magicjudges.org/rules/mtr2-4/) — HIGH (additional-turns / end-of-round)
- [Multiplayer Addendum to the MTR](https://juizes-mtg-portugal.github.io/multiplayer-addendum-mtr) — MEDIUM (multiplayer/Commander overtime turns)
- [WotC Magic Tournament Rules (Apr 21, 2025 PDF)](https://media.wizards.com/ContentResources/WPN/MTG_MTR_2025_Apr%2021_EN.pdf) — HIGH (current tournament rules)
- [EventTimer — Game Timer (count-up + count-down)](https://www.eventtimer.io/tools/game-timer) — MEDIUM (count-up convention)
- [Shared Board Game Timer (features)](https://sharedgametimer.com/features) — MEDIUM (admin timer, rounds, pause, presentation mode)
- [GoTimer — Board Game Turn Timer](https://gotimer.org/board-games/turn-timer) — LOW (count-down → advance behavior)
- [TopDeck.gg — Tournament Operations](https://topdeck.gg/features/tournament-operations) — MEDIUM (late-player add / drop / re-entry as standard TO function)
- Internal: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` — HIGH (existing timer states, components, join flow)

---
*Feature research for: live-event timer + mid-event participant UX (v5.0)*
*Researched: 2026-06-27*
