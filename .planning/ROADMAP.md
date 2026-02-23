# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer goes from zero to deployed in four phases following the hard dependency chain: database schema and real-time player flow first, then the pod generation algorithm and admin controls, then the timer system and browser notifications, and finally event info polish, test coverage, and deployment. Each phase delivers a coherent, testable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Player Flow** - Supabase schema, Realtime subscriptions, player join/drop, mobile-first dark theme
- [ ] **Phase 2: Pod Generation and Admin Controls** - Pod algorithm with repeat-opponent avoidance, admin passphrase flow, round display, admin player management
- [ ] **Phase 3: Timer System** - Server-authoritative countdown timer with admin controls, visual alerts, and browser notifications
- [ ] **Phase 4: Event Polish, Testing, and Deployment** - Event info bar with QR/share, full test coverage, Vercel + Supabase deployment

## Phase Details

### Phase 1: Foundation and Player Flow
**Goal**: Players can create and join events, see each other in real time, and self-drop -- all on a mobile-first dark UI backed by Supabase with proper RLS
**Depends on**: Nothing (first phase)
**Requirements**: EVNT-01, EVNT-02, EVNT-03, PLYR-01, PLYR-02, PLYR-05, INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. User can create a new event with a name and passphrase, and receives a shareable event URL
  2. User can join an event by visiting the event link or scanning a QR code and entering their name; duplicate names are rejected with a friendly error
  3. All connected clients see players appear and disappear in real time without refreshing
  4. Player can self-drop and sees their status change; other clients see the update live
  5. The app renders in a mobile-first dark theme that is readable at arm's length on a phone
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md -- Project scaffold + database foundation (Vite, deps, Supabase schema/RLS/RPC, dark theme)
- [ ] 01-02-PLAN.md -- Landing page + event creation (Create Event modal, admin auth, join field)
- [ ] 01-03-PLAN.md -- Event page + player join + player list (join form, player display, QR code)
- [ ] 01-04-PLAN.md -- Real-time subscriptions + self-drop (Realtime channel, visibility refetch, drop confirmation)
- [ ] 01-05-PLAN.md -- End-to-end verification checkpoint (human verification of full player flow)

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
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

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

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Player Flow | 0/5 | Planned | - |
| 2. Pod Generation and Admin Controls | 0/3 | Not started | - |
| 3. Timer System | 0/2 | Not started | - |
| 4. Event Polish, Testing, and Deployment | 0/2 | Not started | - |
