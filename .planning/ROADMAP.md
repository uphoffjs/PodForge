# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer is a web app for casual MTG Commander playgroups. Players join via QR code, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions are gated behind a per-event passphrase.

## Milestones

- ✅ **v1.0 Foundation & Player Flow** — Phases 1-1.4 (shipped 2026-02-24) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Complete App** — Phases 2-3 (shipped 2026-02-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Event Polish & CI/CD** — Phases 4-5 (shipped 2026-02-27) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v4.0 Pod Algorithm Improvements** — Phases 6-7 (in progress)

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

### 🚧 v4.0 Pod Algorithm Improvements (In Progress)

**Milestone Goal:** Improve pod assignment quality -- reduce repeat opponents, verify seat randomization, and give admins a per-round toggle to allow pods of 3 (eliminating unnecessary byes).

**Branch:** `feature/v4.0-pod-improvements` (create before starting Phase 6)

- [x] **Phase 6: Opponent Diversity and Seat Verification** - Quadratic penalty scoring, multi-start greedy, swap pass, and empirical seat randomization verification (completed 2026-03-02)
- [ ] **Phase 7: Pods of 3** - Algorithm support for 3-player pods, admin toggle UI, PodCard rendering, and full E2E coverage

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
- [ ] 06-02: TBD

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
- [ ] 07-01-PLAN.md -- computePodSizes + Algorithm Generalization (TDD)
- [ ] 07-02-PLAN.md -- Admin Toggle UI + PodCard Rendering
- [ ] 07-03-PLAN.md -- E2E Tests + Stryker Mutation Testing

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7

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
| 6. Opponent Diversity and Seat Verification | v4.0 | Complete    | 2026-03-02 | - |
| 7. Pods of 3 | v4.0 | 0/3 | Not started | - |
