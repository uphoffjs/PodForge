# Requirements: Commander Pod Pairer

**Defined:** 2026-03-02
**Core Value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone -- who they're playing with, what seat they're in, and how much time they have.

## v4.0 Requirements

Requirements for Pod Algorithm Improvements milestone.

### Opponent Diversity

- [x] **OPPO-01**: Pod algorithm uses quadratic penalty scoring (encounters^2) to more aggressively avoid repeat opponents
- [x] **OPPO-02**: Pod algorithm uses multi-start greedy (run N random starting orders, pick best result) to escape local optima
- [x] **OPPO-03**: Pod algorithm applies post-greedy swap pass to fix last-pod-gets-worst-pairings problem
- [x] **OPPO-04**: Unit tests validate improved opponent diversity with Stryker mutation score >=80%

### Pods of 3

- [x] **POD3-01**: Admin can enable a per-round "allow pods of 3" checkbox before generating a round
- [x] **POD3-02**: When enabled, algorithm produces pods of 3 instead of byes where mathematically possible (e.g., 13 players -> 1x4 + 3x3)
- [x] **POD3-03**: `computePodSizes()` pure function handles all player counts 4-20 with correct partition math
- [x] **POD3-04**: For n=5 with toggle enabled, algorithm falls back to 1x4 + 1 bye with admin warning (no clean 3-player solution)
- [x] **POD3-05**: Minimum player threshold relaxes from 4 to 3 when toggle is active
- [x] **POD3-06**: PodCard component renders 3-player pods correctly (seats 1st-3rd)
- [x] **POD3-07**: E2E tests cover toggle interaction, round generation with pods of 3, and edge cases

### Seat Randomization

- [x] **SEAT-01**: Empirical verification that current Fisher-Yates seat shuffle produces uniform distribution across rounds
- [x] **SEAT-02**: If bias detected, add seat history tracking to avoid same-seat-across-rounds (soft preference, not hard constraint)

### Test Coverage

- [x] **TEST-01**: All new algorithm code has unit tests with >=80% Stryker mutation score
- [x] **TEST-02**: Cypress E2E tests cover pods-of-3 toggle, 3-player pod display, and opponent diversity scenarios
- [x] **TEST-03**: Integration tests validate pod generation with parameterized player counts (4-20) for both toggle states

## v5.0 Requirements

Requirements for the Mid-Event Flow & Round Formats milestone.

### Mid-Event Join

- [ ] **JOIN-01**: A player who joins after the first round has started sees a persistent "joined mid-event" indicator (e.g. "Joined R{N}") in the player list, visually distinct from the transient new-player highlight
- [ ] **JOIN-02**: Mid-event status is determined by pod participation (player not yet placed in any pod), correctly covering players who joined before round 1 but after others, and reactivated dropouts
- [ ] **JOIN-03**: Mid-event joiners automatically enter the next round's pool with empty opponent history and 0 bye count — no admin approval gate

### Round Timer (80+20 Format)

- [ ] **TIMER-01**: Admin can select an "80+20" round-timer format (80-minute main period + 20-minute overtime) alongside the existing 60/90/120 presets
- [ ] **TIMER-02**: Admin starts the 80+20 timer with an explicit action; the 80-minute main countdown begins on start rather than auto-starting at round generation
- [ ] **TIMER-03**: When the main period reaches 0:00 the timer transitions to a 20-minute overtime countdown; when overtime reaches 0:00 it counts up (+M:SS) indefinitely until an admin acts
- [ ] **TIMER-04**: Each phase (main / overtime / overrun count-up) is visually distinct with its own label and urgency styling, synced to all clients in real time
- [ ] **TIMER-05**: A browser notification fires once at each phase boundary (main→overtime and overtime→count-up), de-duplicated per boundary
- [ ] **TIMER-06**: The timer stays server-authoritative and renders correctly across refresh/reconnect; pausing during overtime or count-up preserves the signed remaining position on resume
- [ ] **TIMER-07**: Existing admin timer controls (pause, resume, +5 min, cancel) operate correctly in all three phases

### Test Coverage

- [ ] **TEST-04**: Unit + Cypress E2E tests cover the mid-event-join indicator and detection edge cases (joined-before-round-1, reactivated dropout) with >=80% Stryker mutation score
- [ ] **TEST-05**: Unit/integration tests cover the 80+20 three-phase timer engine and dual-boundary notification dedup (target 100% Stryker on timer logic); Cypress E2E covers selecting/starting 80+20 and its phase transitions

### Fault-Injection Campaign

- [ ] **FAULT-01**: All 21 remaining batch-1 faults (2.2–5.6) are executed, each recorded KILLED or SURVIVED with evidence in `.planning/debug/fault-injection-batch1.md`
- [ ] **FAULT-02**: Each fault is fully reverted (e.g. `git checkout`) before the next is injected, preventing cross-fault contamination
- [ ] **FAULT-03**: Cypress `uncaught:exception` handling is narrowed so injected faults cannot be silently swallowed and falsely marked KILLED
- [ ] **FAULT-04**: Every SURVIVED fault yields a new or strengthened E2E test that kills it (or a documented equivalent-fault justification)

## Future Requirements

### Carry-forward (from previous milestones)

- **FUTURE-01**: Multiple simultaneous admins supported per event

*FUTURE-02 (player joining mid-event) promoted into v5.0 — see JOIN-01..03.*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Globally optimal assignment (ILP solver) | Greedy + swap pass is sufficient for <20 players; solver adds dependency and complexity |
| Persistent pods-of-3 setting per event | Per-round checkbox is simpler; admin can toggle each round |
| Pods of 2 | Too small for Commander (4-player format); not requested |
| Sound/haptic alerts for seat assignment | Visual display is sufficient per existing decisions |
| Admin approval gate for mid-event joiners | Passive badge chosen; an approval step adds friction + state (research anti-feature) |
| Configurable / custom multi-phase timer builder | Fixed 80+20 preset only; arbitrary main+overtime lengths add UI and validation complexity |
| Auto-inserting late joiners into the current live round | Joiners wait for the next round; mutating an in-progress round is disruptive |
| Hard auto-stop / auto-cancel after count-up | Count-up runs until the admin acts; no automatic termination |
| Sound alarms at timer phase boundaries | Visual phase styling + browser notifications are sufficient (consistent with existing timer) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPPO-01 | Phase 6 | Complete |
| OPPO-02 | Phase 6 | Complete |
| OPPO-03 | Phase 6 | Complete |
| OPPO-04 | Phase 6 | Complete |
| POD3-01 | Phase 7 | Complete |
| POD3-02 | Phase 7 | Complete |
| POD3-03 | Phase 7 | Complete |
| POD3-04 | Phase 7 | Complete |
| POD3-05 | Phase 7 | Complete |
| POD3-06 | Phase 7 | Complete |
| POD3-07 | Phase 7 | Complete |
| SEAT-01 | Phase 6 | Complete |
| SEAT-02 | Phase 6 | Complete |
| TEST-01 | Phase 6 | Complete |
| TEST-02 | Phase 7 | Complete |
| TEST-03 | Phase 7 | Complete |

**Coverage:**
- v4.0 requirements: 16 total
- Mapped to phases: 16/16
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
