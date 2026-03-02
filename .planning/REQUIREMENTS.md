# Requirements: Commander Pod Pairer

**Defined:** 2026-03-02
**Core Value:** When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone — who they're playing with, what seat they're in, and how much time they have.

## v4.0 Requirements

Requirements for Pod Algorithm Improvements milestone.

### Opponent Diversity

- [ ] **OPPO-01**: Pod algorithm uses quadratic penalty scoring (encounters²) to more aggressively avoid repeat opponents
- [ ] **OPPO-02**: Pod algorithm uses multi-start greedy (run N random starting orders, pick best result) to escape local optima
- [ ] **OPPO-03**: Pod algorithm applies post-greedy swap pass to fix last-pod-gets-worst-pairings problem
- [ ] **OPPO-04**: Unit tests validate improved opponent diversity with Stryker mutation score >=80%

### Pods of 3

- [ ] **POD3-01**: Admin can enable a per-round "allow pods of 3" checkbox before generating a round
- [ ] **POD3-02**: When enabled, algorithm produces pods of 3 instead of byes where mathematically possible (e.g., 13 players → 1×4 + 3×3)
- [ ] **POD3-03**: `computePodSizes()` pure function handles all player counts 4-20 with correct partition math
- [ ] **POD3-04**: For n=5 with toggle enabled, algorithm falls back to 1×4 + 1 bye with admin warning (no clean 3-player solution)
- [ ] **POD3-05**: Minimum player threshold relaxes from 4 to 3 when toggle is active
- [ ] **POD3-06**: PodCard component renders 3-player pods correctly (seats 1st-3rd)
- [ ] **POD3-07**: E2E tests cover toggle interaction, round generation with pods of 3, and edge cases

### Seat Randomization

- [ ] **SEAT-01**: Empirical verification that current Fisher-Yates seat shuffle produces uniform distribution across rounds
- [ ] **SEAT-02**: If bias detected, add seat history tracking to avoid same-seat-across-rounds (soft preference, not hard constraint)

### Test Coverage

- [ ] **TEST-01**: All new algorithm code has unit tests with >=80% Stryker mutation score
- [ ] **TEST-02**: Cypress E2E tests cover pods-of-3 toggle, 3-player pod display, and opponent diversity scenarios
- [ ] **TEST-03**: Integration tests validate pod generation with parameterized player counts (4-20) for both toggle states

## Future Requirements

### Carry-forward (from previous milestones)

- **FUTURE-01**: Multiple simultaneous admins supported per event
- **FUTURE-02**: Player joining mid-event enters pool for next round with empty history and 0 bye count

## Out of Scope

| Feature | Reason |
|---------|--------|
| Globally optimal assignment (ILP solver) | Greedy + swap pass is sufficient for <20 players; solver adds dependency and complexity |
| Persistent pods-of-3 setting per event | Per-round checkbox is simpler; admin can toggle each round |
| Pods of 2 | Too small for Commander (4-player format); not requested |
| Sound/haptic alerts for seat assignment | Visual display is sufficient per existing decisions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPPO-01 | TBD | Pending |
| OPPO-02 | TBD | Pending |
| OPPO-03 | TBD | Pending |
| OPPO-04 | TBD | Pending |
| POD3-01 | TBD | Pending |
| POD3-02 | TBD | Pending |
| POD3-03 | TBD | Pending |
| POD3-04 | TBD | Pending |
| POD3-05 | TBD | Pending |
| POD3-06 | TBD | Pending |
| POD3-07 | TBD | Pending |
| SEAT-01 | TBD | Pending |
| SEAT-02 | TBD | Pending |
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |
| TEST-03 | TBD | Pending |

**Coverage:**
- v4.0 requirements: 16 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
