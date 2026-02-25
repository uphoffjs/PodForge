# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer is a web app for casual MTG Commander playgroups. Players join via QR code, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions are gated behind a per-event passphrase.

## Milestones

- ✅ **v1.0 Foundation & Player Flow** — Phases 1-1.4 (shipped 2026-02-24) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Complete App** — Phases 2-3 (shipped 2026-02-25) — [archive](milestones/v2.0-ROADMAP.md)

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

### Phase 4: Event Polish, Testing, and Deployment
**Goal**: Event page shows full info bar with QR code and share link, all critical paths have test coverage, and the app is deployable to Vercel + Supabase
**Depends on**: Phase 3
**Requirements**: EVNT-05, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. Event page displays info bar with event name, expandable QR code, shareable link with copy button, active player count, and current round number
  2. Pod generation algorithm has unit tests covering player counts 4-20 across multiple rounds, including bye rotation edge cases
  3. Integration tests cover major user flows (create event, join, generate round, timer, self-drop)
  4. Deployment instructions exist and the app deploys successfully to Vercel (frontend) + Supabase (backend)
**Plans:** 3 plans

Plans:
- [ ] 04-01-PLAN.md — Event info bar component (EVNT-05)
- [ ] 04-02-PLAN.md — Pod algorithm comprehensive test coverage (INFR-04)
- [ ] 04-03-PLAN.md — Timer E2E tests and deployment documentation (INFR-05)

## Progress

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
| 4. Event Polish, Testing, and Deployment | — | 0/3 | Not started | - |
