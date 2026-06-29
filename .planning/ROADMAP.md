# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer is a web app for casual MTG Commander playgroups. Players join via QR code, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions are gated behind a per-event passphrase.

## Milestones

- ✅ **v1.0 Foundation & Player Flow** — Phases 1-1.4 (shipped 2026-02-24) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Complete App** — Phases 2-3 (shipped 2026-02-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Event Polish & CI/CD** — Phases 4-5 (shipped 2026-02-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Pod Algorithm Improvements** — Phases 6-7 (shipped 2026-03-02)
- 🚧 **v5.0 Mid-Event Flow & Round Formats** — Phases 8-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation & Player Flow (Phases 1-1.4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Foundation and Player Flow (4/5 plans) — completed 2026-02-23
- [x] Phase 1.1: Cypress E2E Tests (2/3 plans) — completed 2026-02-23
- [x] Phase 1.2: Audit Bug Fixes (3/3 plans) — completed 2026-02-23
- [x] Phase 1.3: Missing Coverage + Verification (2/2 plans) — completed 2026-02-23
- [x] Phase 1.4: Sync Unit Tests (1/1 plan) — completed 2026-02-24

</details>

<details>
<summary>✅ v2.0 Complete App (Phases 2-3) — SHIPPED 2026-02-25</summary>

- [x] Phase 2: Pod Generation and Admin Controls (5/5 plans) — completed 2026-02-24
- [x] Phase 2.1: Phase 2 E2E and Integration Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Timer System (3/3 plans) — completed 2026-02-25

</details>

<details>
<summary>✅ v3.0 Event Polish & CI/CD (Phases 4-5) — SHIPPED 2026-02-27</summary>

- [x] Phase 4: Event Polish, Testing, and Deployment (3/3 plans) — completed 2026-02-25
- [x] Phase 5: Bulletproof CI/CD Pipeline (3/3 plans) — completed 2026-02-27

</details>

<details>
<summary>✅ v4.0 Pod Algorithm Improvements (Phases 6-7) — SHIPPED 2026-03-02</summary>

- [x] Phase 6: Opponent Diversity and Seat Verification (2/2 plans) — completed 2026-03-02
- [x] Phase 7: Pods of 3 (3/3 plans) — completed 2026-03-02

</details>

### 🚧 v5.0 Mid-Event Flow & Round Formats (In Progress)

**Milestone Goal:** Support players joining mid-event with clear UX, add an 80+20 minute round-timer format (80-min main → 20-min overtime → unbounded count-up), and close out E2E coverage gaps by finishing the batch-1 fault-injection campaign.

**Branch:** `feature/v5.0-mid-event-flow` (create before starting Phase 8)

**Build tracks:** The timer track (Phases 8→9) is strictly ordered — the `00005` migration must land before any client work. The mid-event-join track (Phase 10) and the fault-injection track (Phase 11) carry zero migration dependency and parallelize with the timer track.

- [x] **Phase 8: Timer Migration & Core Engine** - Additive `00005` migration (overtime column, `generate_round` param, `pause_timer` clamp removal), three-phase `useCountdown` engine, dual-boundary notification dedup, server-authoritative pause/reconnect — 100% Stryker (completed 2026-06-28)
- [ ] **Phase 9: Timer UI & Admin Controls** - 80+20 preset picker, explicit start action, phase-distinct `TimerDisplay` styling, pause/resume/+5/cancel across all phases, full timer E2E
- [ ] **Phase 10: Mid-Event Join UX** - Pod-participation detection, persistent "Joined R{N}" badge, auto-flow into next round with no approval gate
- [ ] **Phase 11: Fault-Injection Campaign Completion** - Run remaining 21 batch-1 faults with revert discipline, narrow the `uncaught:exception` suppressor, close every SURVIVED gap

## Phase Details

### Phase 6: Opponent Diversity and Seat Verification
**Goal**: Players experience meaningfully fewer repeat opponents across rounds, and seat assignment fairness is empirically verified
**Depends on**: Phase 5 (v3.0 shipped)
**Requirements**: OPPO-01, OPPO-02, OPPO-03, OPPO-04, SEAT-01, SEAT-02, TEST-01
**Success Criteria** (what must be TRUE):
  1. Running 4 rounds with 8 players, no pair of players is assigned to the same pod more than twice (maxPairCount <= 2)
  2. Multi-start greedy produces measurably better assignments than single-pass greedy (lower total repeat-opponent score)
  3. The last pod filled in a round does not consistently get the worst repeat-opponent pairings (swap pass fixes structural bias)
  4. Empirical seat-frequency simulation across 20+ rounds shows roughly uniform distribution (each seat within 5% of expected frequency)
  5. All new algorithm code passes Stryker mutation testing at >=80% score
**Plans**: TBD

Plans:
- [x] 06-01: Opponent Diversity Algorithm (quadratic scoring, multi-start greedy, swap pass)
- [x] 06-02: Seat Randomization Verification (empirical chi-squared distribution test, unit coverage)

### Phase 7: Pods of 3
**Goal**: Admins can toggle pods of 3 per-round to eliminate unnecessary byes, and the full feature works end-to-end through the real Supabase RPC
**Depends on**: Phase 6
**Requirements**: POD3-01, POD3-02, POD3-03, POD3-04, POD3-05, POD3-06, POD3-07, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Admin sees a "allow pods of 3" checkbox before generating a round; toggling it on with 13 players produces 1x4 + 3x3 pods (zero byes)
  2. `computePodSizes()` returns correct pod partitions for all player counts 4-20 in both toggle states
  3. PodCard renders 3-player pods correctly (seats 1st-3rd only, no phantom 4th seat)
  4. With 5 players and toggle enabled, admin sees a warning and the algorithm falls back to 1x4 + 1 bye (no 5-player pod or broken partition)
  5. Cypress E2E test generates a round through the real Supabase RPC with pods-of-3 toggle ON and verifies 3-player pod cards appear
**Plans**: 3 plans in 3 waves

Plans:
- [x] 07-01-PLAN.md -- computePodSizes + Algorithm Generalization (TDD)
- [x] 07-02-PLAN.md -- Admin Toggle UI + PodCard Rendering
- [x] 07-03-PLAN.md -- E2E Tests + Stryker Mutation Testing

### Phase 8: Timer Migration & Core Engine
**Goal**: The 80+20 three-phase timer is correct and server-authoritative at the engine level — phases derive purely on the client, and pause/resume/reconnect preserve signed position
**Depends on**: Phase 7 (v4.0 shipped)
**Requirements**: TIMER-03, TIMER-05, TIMER-06
**Success Criteria** (what must be TRUE):
  1. Generating a round with 80+20 selected persists `overtime_seconds = 1200` on `round_timers`, while plain timers persist `overtime_seconds = 0` (backward compatible — existing single-phase timers behave unchanged)
  2. Unit tests confirm the phase derivation: main counts 80:00→0:00, overtime counts 20:00→0:00, then count-up increments past zero indefinitely until an admin acts
  3. Pausing during overtime or count-up and resuming restores the exact signed remaining position (the `GREATEST(0,…)` clamp is removed; no reset to 0:00), and a mid-overtime page refresh re-renders the correct phase and position from server state
  4. A browser notification fires exactly once at each phase boundary (main→overtime, overtime→count-up), deduplicated per boundary even across Realtime row updates
  5. All new timer-engine branches pass Stryker mutation testing at 100%
**Plans**: 4 plans in 3 waves

Plans:
- [x] 08-01-PLAN.md -- Migration 00005 (overtime_seconds column, generate_round overload DROP + p_overtime_minutes, pause_timer clamp removal) + schema push + SQL verify
- [x] 08-02-PLAN.md -- RoundTimer.overtime_seconds type contract (repo-wide factory compat) + thread overtimeMinutes through useGenerateRound
- [x] 08-03-PLAN.md -- useCountdown three-phase derivation (main/overtime/countup) + phase field, 100% Stryker
- [x] 08-04-PLAN.md -- useTimerNotification dual-boundary dedup (phase-transition + Set), 100% Stryker

### Phase 9: Timer UI & Admin Controls
**Goal**: Admins can select and explicitly start the 80+20 format, and every player sees a glanceable, phase-distinct timer with working controls
**Depends on**: Phase 8
**Requirements**: TIMER-01, TIMER-02, TIMER-04, TIMER-07, TEST-05
**Success Criteria** (what must be TRUE):
  1. Admin sees an "80+20" option alongside the existing 60/90/120 presets in the duration picker
  2. The 80-minute main countdown begins only when the admin presses an explicit "Start timer" action — it does not auto-start at round generation
  3. Each phase is visually distinct (labeled ROUND TIMER / OVERTIME / OVERRUN, its own per-phase styling — main keeps the existing urgency progression, overtime flat amber, count-up red-pulse with `+mm:ss` prefix) and updates in real time across all clients
  4. Pause, resume, +5 min, and cancel all operate correctly during the main, overtime, and count-up phases
  5. Cypress E2E covers selecting and starting 80+20 and walking through all three phase transitions; timer logic meets the 100% Stryker target
**Plans**: 4 plans in 4 waves
**UI hint**: yes

Plans:
- [x] 09-01-PLAN.md — Migration 00006 (pending status + start_timer RPC + cancel-pending) applied to live DB; SQL human-verify checkpoint approved
- [x] 09-02-PLAN.md — Client data layer: status union, useTimer filter, useCountdown not-started branch, useStartTimer hook (both 100% Stryker; suite green)
- [x] 09-03-PLAN.md — UI: TimerDisplay phase bands + not-started card, TimerControls Start/Cancel, AdminControls 80+20 preset (TimerDisplay + TimerControls 100% Stryker; suite green)
- [x] 09-04-PLAN.md — E2E timer-80-20 + timer.cy.js ROUND TIMER label/controls + Stryker gate (hooks 100%, components 95.35%)

### Phase 10: Mid-Event Join UX
**Goal**: Players who join after pairing has begun are clearly flagged and automatically flow into the next round with no admin friction
**Depends on**: Phase 7 (v4.0 shipped) — parallelizable with Phases 8-9 (zero migration dependency)
**Requirements**: JOIN-01, JOIN-02, JOIN-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. A player not yet placed in any pod (once at least one round exists) shows a persistent "Joined R{N}" badge, visually distinct from the transient new-player highlight
  2. Mid-event status derives from pod participation — correctly flagging players who joined before round 1 but after others, and reactivated dropouts — and clears the moment the player is assigned to a pod
  3. Mid-event joiners automatically enter the next round's pool with empty opponent history and 0 bye count, with no admin approval step
  4. Unit + Cypress E2E tests cover the badge and detection edge cases (joined-before-round-1, reactivated dropout) at >=80% Stryker
**Plans**: TBD
**UI hint**: yes

### Phase 11: Fault-Injection Campaign Completion
**Goal**: The batch-1 fault-injection campaign is finished with trustworthy KILLED/SURVIVED results and every coverage gap closed
**Depends on**: Phase 7 (v4.0 shipped) — parallelizable with Phases 8-10 (independent of timer and mid-event code)
**Requirements**: FAULT-01, FAULT-02, FAULT-03, FAULT-04
**Success Criteria** (what must be TRUE):
  1. All 21 remaining batch-1 faults (2.2–5.6) are executed, each recorded KILLED or SURVIVED with verified symptom evidence in `.planning/debug/fault-injection-batch1.md`
  2. Each fault is fully reverted via `git checkout` (verified clean tree) before the next is injected, preventing cross-fault contamination
  3. The Cypress `uncaught:exception` suppressor is narrowed so injected faults can no longer be silently swallowed and falsely marked KILLED
  4. Every SURVIVED fault yields a new or strengthened E2E test that kills it (or a documented equivalent-fault justification)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10 → 11. Within v5.0, Phase 9 depends on Phase 8; Phases 10 and 11 are independent and may run in parallel with the timer track.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Player Flow | v1.0 | 4/5 | Complete | 2026-02-23 |
| 1.1 Cypress E2E Tests | v1.0 | 2/3 | Complete | 2026-02-23 |
| 1.2 Audit Bug Fixes | v1.0 | 3/3 | Complete | 2026-02-23 |
| 1.3 Missing Coverage + Verification | v1.0 | 2/2 | Complete | 2026-02-23 |
| 1.4 Sync Unit Tests | v1.0 | 1/1 | Complete | 2026-02-24 |
| 2. Pod Generation and Admin Controls | v2.0 | 5/5 | Complete | 2026-02-24 |
| 2.1 Phase 2 E2E and Integration Tests | v2.0 | 3/3 | Complete | 2026-02-25 |
| 3. Timer System | v2.0 | 3/3 | Complete | 2026-02-25 |
| 4. Event Polish, Testing, and Deployment | v3.0 | 3/3 | Complete | 2026-02-25 |
| 5. Bulletproof CI/CD Pipeline | v3.0 | 3/3 | Complete | 2026-02-27 |
| 6. Opponent Diversity and Seat Verification | v4.0 | 2/2 | Complete | 2026-03-02 |
| 7. Pods of 3 | v4.0 | 3/3 | Complete | 2026-03-02 |

### v5.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. Timer Migration & Core Engine | v5.0 | 4/4 | Complete   | 2026-06-28 |
| 9. Timer UI & Admin Controls | v5.0 | 3/4 | In Progress|  |
| 10. Mid-Event Join UX | v5.0 | 0/0 | Not started | - |
| 11. Fault-Injection Campaign Completion | v5.0 | 0/0 | Not started | - |
</content>
</invoke>
