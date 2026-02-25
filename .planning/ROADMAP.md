# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer goes from zero to deployed in four phases following the hard dependency chain: database schema and real-time player flow first, then the pod generation algorithm and admin controls, then the timer system and browser notifications, and finally event info polish, test coverage, and deployment. Each phase delivers a coherent, testable capability that unblocks the next.

## Milestones

- ✅ **v1.0 Foundation & Player Flow** — Phases 1-1.4 (shipped 2026-02-24) — [archive](milestones/v1.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Foundation & Player Flow (Phases 1-1.4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Foundation and Player Flow (4/5 plans) — completed 2026-02-23
- [x] Phase 1.1: Cypress E2E Tests (2/3 plans) — completed 2026-02-23
- [x] Phase 1.2: Audit Bug Fixes (3/3 plans) — completed 2026-02-23
- [x] Phase 1.3: Missing Coverage + Verification (2/2 plans) — completed 2026-02-23
- [x] Phase 1.4: Sync Unit Tests (1/1 plan) — completed 2026-02-24

</details>

### Phase 2: Pod Generation and Admin Controls
**Goal**: Admin can generate rounds of pods that minimize repeat opponents, manage players, and end events -- all gated behind the event passphrase
**Depends on**: Phase 1
**Requirements**: PODG-01, PODG-02, PODG-03, PODG-04, PODG-05, PODG-06, PODG-07, PLYR-03, PLYR-04, EVNT-04
**Success Criteria** (what must be TRUE):
  1. Admin enters passphrase once and can generate rounds, remove players, reactivate dropped players, and end events without re-entering it
  2. Generated pods minimize repeat opponents across rounds; bye players are selected by fewest total byes
  3. Each pod displays players with randomized seat order (1st-4th); bye pod is visually distinct with no seat order
  4. Round generation is blocked with a clear error when fewer than 4 active players
  5. Previous rounds are visible in collapsible sections (most recent first) and ended events become read-only
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Database schema (rounds/pods/pod_players), types, React Query hooks, Realtime updates
- [x] 02-02-PLAN.md — Pod generation algorithm (TDD): greedy opponent avoidance, bye rotation, seat randomization
- [x] 02-03-PLAN.md — Generate round flow + pod display UI (AdminControls, PodCard, RoundDisplay)
- [x] 02-04-PLAN.md — Admin player management (remove/reactivate), end event, previous rounds history
- [x] 02-05-PLAN.md — Gap closure: fetch all rounds' pods for complete opponent history (PODG-02 fix)

### Phase 2.1: Phase 2 E2E and Integration Tests
**Goal**: Comprehensive Cypress E2E and integration test coverage for all Phase 2 features — pod generation, admin controls, round history, and sit-out fairness
**Depends on**: Phase 2
**Requirements**: PODG-01, PODG-02, PODG-03, PODG-04, PODG-05, PODG-06, PODG-07, PLYR-03, PLYR-04, EVNT-04
**Success Criteria** (what must be TRUE):
  1. E2E tests cover the full admin flow: enter passphrase, generate round, view pods, generate additional rounds, end event
  2. E2E tests verify pod display: seat assignments, bye pod visual distinction, pod border colors
  3. E2E tests verify player management: admin remove player, admin reactivate player
  4. E2E tests verify previous rounds display and collapsible sections
  5. Integration tests verify sit-out fairness rotation across multiple rounds
  6. All existing Phase 1 E2E tests continue to pass
**Plans**: 3 plans

Plans:
- [x] 02.1-01-PLAN.md — Admin passphrase, round generation, and pod display E2E tests
- [x] 02.1-02-PLAN.md — Admin player management, end event, and previous rounds E2E tests
- [x] 02.1-03-PLAN.md — Sit-out fairness integration tests and full regression suite verification

### Phase 3: Timer System
**Goal**: Admin can start, pause, resume, extend, and cancel a round timer that all players see counting down in real time with visual urgency cues and browser notifications at zero
**Depends on**: Phase 2
**Requirements**: TIMR-01, TIMR-02, TIMR-03, TIMR-04, TIMR-05, TIMR-06
**Success Criteria** (what must be TRUE):
  1. Admin can set a timer with preset durations (60/90/120 min) when generating a round, and the timer appears on all connected clients
  2. Timer counts down in mm:ss using server-authoritative timestamps (no drift between clients)
  3. Admin can pause, resume, add 5 minutes, and cancel the timer; changes reflect on all clients in real time
  4. Timer changes color at thresholds (yellow under 10 min, red under 5 min, flashing at 0:00)
  5. Browser notification fires when timer reaches zero, with a graceful permission request flow
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Database schema (round_timers table), timer RPC functions, TypeScript types, query/mutation hooks, Realtime updates
- [ ] 03-02-PLAN.md — Timer display (useCountdown, TimerDisplay, urgency colors, overtime), admin timer controls (TimerControls, duration picker), EventPage integration
- [ ] 03-03-PLAN.md — Browser notifications (useTimerNotification hook, permission flow, iOS PWA handling)

### Phase 4: Event Polish, Testing, and Deployment
**Goal**: Event page shows full info bar with QR code and share link, all critical paths have test coverage, and the app is deployable to Vercel + Supabase
**Depends on**: Phase 3
**Requirements**: EVNT-05, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. Event page displays info bar with event name, expandable QR code, shareable link with copy button, active player count, and current round number
  2. Pod generation algorithm has unit tests covering player counts 4-20 across multiple rounds, including bye rotation edge cases
  3. Integration tests cover major user flows (create event, join, generate round, timer, self-drop)
  4. Deployment instructions exist and the app deploys successfully to Vercel (frontend) + Supabase (backend)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Player Flow | v1.0 | 4/5 | Complete | 2026-02-23 |
| 1.1 Cypress E2E Tests | v1.0 | 2/3 | Complete | 2026-02-23 |
| 1.2 Audit Bug Fixes | v1.0 | 3/3 | Complete | 2026-02-23 |
| 1.3 Missing Coverage + Verification | v1.0 | 2/2 | Complete | 2026-02-23 |
| 1.4 Sync Unit Tests | v1.0 | 1/1 | Complete | 2026-02-24 |
| 2. Pod Generation and Admin Controls | v2.0 | 5/5 | Complete | 2026-02-24 |
| 2.1 Phase 2 E2E and Integration Tests | v2.0 | 2/3 | In Progress | - |
| 3. Timer System | — | 0/3 | Not started | - |
| 4. Event Polish, Testing, and Deployment | — | 0/2 | Not started | - |
