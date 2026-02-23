# Requirements: Commander Pod Pairer

**Defined:** 2026-02-20
**Core Value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone -- who they're playing with, what seat they're in, and how much time they have.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Event Management

- [ ] **EVNT-01**: User can create a new event with a name and admin passphrase
- [x] **EVNT-02**: User can join an event by visiting the event link and entering their name
- [x] **EVNT-03**: User can join an event by scanning a QR code and entering their name
- [ ] **EVNT-04**: Admin can end an event, making it read-only (historical data stays visible)
- [ ] **EVNT-05**: Event page displays info bar with event name, expandable QR code, shareable link with copy button, player count, and current round number

### Player Management

- [x] **PLYR-01**: All connected clients see the real-time player list (active players + collapsed dropped section)
- [ ] **PLYR-02**: Player can self-drop from an event with confirmation (marks inactive, current round assignment stays)
- [ ] **PLYR-03**: Admin can remove a player from the event (passphrase-gated)
- [ ] **PLYR-04**: Admin can re-activate a dropped player (passphrase-gated)
- [x] **PLYR-05**: Duplicate player names within an event are prevented with a friendly error message

### Pod Generation

- [ ] **PODG-01**: Admin can generate the next round of pods (passphrase-gated)
- [ ] **PODG-02**: Pod assignment minimizes repeat opponents using greedy algorithm with opponent history matrix
- [ ] **PODG-03**: Bye players are selected by fewest total byes, ties broken randomly
- [ ] **PODG-04**: Each pod's players receive randomized seat order (1st-4th) displayed clearly
- [ ] **PODG-05**: Bye pod is visually distinct (muted style, labeled "Sitting Out"), no seat order
- [ ] **PODG-06**: Round generation blocked with error when fewer than 4 active players
- [ ] **PODG-07**: Previous rounds visible in collapsible sections, most recent first

### Timer

- [ ] **TIMR-01**: Admin can set an optional timer duration when generating a round (with 60/90/120 min presets)
- [ ] **TIMR-02**: Timer counts down in real time (mm:ss), visible to all connected clients
- [ ] **TIMR-03**: Timer state is server-authoritative (stored in DB, clients calculate independently)
- [ ] **TIMR-04**: Admin can pause, resume, add 5 minutes, or cancel the timer
- [ ] **TIMR-05**: Timer changes color as it winds down (yellow under 10 min, red under 5 min, flashing at 0:00)
- [ ] **TIMR-06**: Browser notification fires when timer reaches zero (with permission flow, iOS PWA caveat handled gracefully)

### Real-Time & Infrastructure

- [x] **INFR-01**: All state changes (player joins/drops, new rounds, timer updates, removals) push to all clients via Supabase Realtime
- [x] **INFR-02**: Admin passphrase validated server-side via Supabase RPC; session-stored after first successful entry
- [x] **INFR-03**: Mobile-first dark theme with glanceable pod cards, minimal chrome, no slow animations
- [ ] **INFR-04**: Unit tests for pod generation algorithm and integration tests for major features
- [ ] **INFR-05**: Deployment setup instructions for Vercel (frontend) and Supabase (backend)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Events

- **EVNT-06**: Multiple simultaneous events managed from a single dashboard
- **EVNT-07**: Event templates (save settings for recurring playgroup nights)

### Social

- **SOCL-01**: Player stats across events (win rate, most frequent opponents)
- **SOCL-02**: Player profile persistence across events

### Competitive

- **COMP-01**: Point tracking and standings per event
- **COMP-02**: Deck registration per player per event

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Unnecessary for casual playgroup use -- passphrase model is simpler |
| Deck registration | Out of scope for a pairing utility |
| Point tracking / standings | Not needed for casual play |
| Spectator chat / messaging | This is a utility, not a social app |
| Sound alerts on timer expiry | Visual + browser notification is sufficient |
| Swiss pairings / tournament brackets | Competitive tournament feature -- this is for casual Commander |
| In-app QR scanner | Camera API is unreliable on mobile. OS camera app handles QR scanning natively |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVNT-01 | Phase 1 | Pending |
| EVNT-02 | Phase 1 | Complete |
| EVNT-03 | Phase 1 | Complete |
| EVNT-04 | Phase 2 | Pending |
| EVNT-05 | Phase 4 | Pending |
| PLYR-01 | Phase 1 | Complete |
| PLYR-02 | Phase 1 | Pending |
| PLYR-03 | Phase 2 | Pending |
| PLYR-04 | Phase 2 | Pending |
| PLYR-05 | Phase 1 | Complete |
| PODG-01 | Phase 2 | Pending |
| PODG-02 | Phase 2 | Pending |
| PODG-03 | Phase 2 | Pending |
| PODG-04 | Phase 2 | Pending |
| PODG-05 | Phase 2 | Pending |
| PODG-06 | Phase 2 | Pending |
| PODG-07 | Phase 2 | Pending |
| TIMR-01 | Phase 3 | Pending |
| TIMR-02 | Phase 3 | Pending |
| TIMR-03 | Phase 3 | Pending |
| TIMR-04 | Phase 3 | Pending |
| TIMR-05 | Phase 3 | Pending |
| TIMR-06 | Phase 3 | Pending |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 4 | Pending |
| INFR-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap creation*
