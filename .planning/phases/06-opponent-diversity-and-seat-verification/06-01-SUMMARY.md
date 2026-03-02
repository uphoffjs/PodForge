---
phase: 06-opponent-diversity-and-seat-verification
plan: 01
subsystem: algorithm
tags: [pod-assignment, quadratic-penalty, multi-start-greedy, swap-pass, opponent-diversity]

# Dependency graph
requires:
  - phase: 05-bulletproof-ci-cd-pipeline
    provides: "Stable CI/CD and test infrastructure"
provides:
  - "Quadratic penalty scoring (encounters^2) for opponent overlap"
  - "Multi-start greedy with random chunk diversity (NUM_STARTS=20)"
  - "Pairwise swap pass for post-greedy improvement"
  - "Exported helper functions: podPenalty, totalPenalty, greedyAssign, swapPass, getOpponentScore"
affects: [phase-07-pods-of-3, pod-algorithm-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-start-optimization, quadratic-penalty-scoring, swap-pass-improvement]

key-files:
  created: []
  modified:
    - src/lib/pod-algorithm.ts
    - src/lib/pod-algorithm.test.ts
    - src/lib/pod-algorithm.integration.test.ts

key-decisions:
  - "NUM_STARTS=20 (not 5) required for consistent maxPairCount<=2 with 8 players / 4 rounds"
  - "Half greedy starts + half random chunk starts provides escape from greedy local minima"
  - "Swap pass applied to each multi-start candidate (not just the final winner) for better global optimization"
  - "maxPairCount<=2 test uses 80% pass rate over 20 trials (not 100%) due to inherent randomness"

patterns-established:
  - "Multi-start with mixed strategies: greedy for local optimization, random chunks for diversity"
  - "Swap pass with strict less-than comparison guarantees termination"
  - "Exported pure helper functions for testability (podPenalty, totalPenalty, greedyAssign, swapPass)"

requirements-completed: [OPPO-01, OPPO-02, OPPO-03]

# Metrics
duration: 10min
completed: 2026-03-02
---

# Phase 6 Plan 1: Opponent Diversity Algorithm Summary

**Quadratic penalty scoring + multi-start greedy (20 starts, mixed strategy) + pairwise swap pass reduces maxPairCount from 3+ to <=2 for 8 players / 4 rounds**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-02T16:41:16Z
- **Completed:** 2026-03-02T16:50:44Z
- **Tasks:** 1 (TDD: RED + GREEN + REFACTOR)
- **Files modified:** 3

## Accomplishments
- Quadratic penalty scoring penalizes 2-encounter opponents 4x harder than 1-encounter (not 2x)
- Multi-start with 20 starts (10 greedy + 10 random chunk) escapes greedy local minima
- Swap pass applies pairwise exchanges to improve total penalty after each start
- 8 players / 4 rounds achieves maxPairCount <= 2 at ~98% rate (was consistently 3+ before)
- All helper functions exported and individually unit-tested
- Public API signature of generatePods unchanged -- zero caller impact

## Task Commits

Each task was committed atomically (TDD has 3 commits):

1. **Task 1 RED: Write failing tests** - `d7c5437` (test)
2. **Task 1 GREEN: Implement algorithm improvements** - `59c0712` (feat)
3. **Task 1 REFACTOR: Clean up docstrings** - `7a5d98b` (refactor)

## Files Created/Modified
- `src/lib/pod-algorithm.ts` - Added quadratic scoring, multi-start greedy, swap pass, exported helpers
- `src/lib/pod-algorithm.test.ts` - Added unit tests for getOpponentScore (quadratic), podPenalty, totalPenalty, greedyAssign, swapPass
- `src/lib/pod-algorithm.integration.test.ts` - Added maxPairCount<=2 test, multi-start vs single-start comparison, last pod fairness test

## Decisions Made
- **NUM_STARTS=20 instead of 5**: The plan suggested NUM_STARTS=5 but testing showed that 8 players / 4 rounds requires more starts to consistently find optimal solutions. The greedy algorithm converges to local minima, and with only 5 starts, maxPairCount=3 was common. 20 starts with mixed strategies achieves ~98% success rate.
- **Mixed start strategies**: Half greedy + half random chunk starts. Pure greedy always converges to the same local minimum (all 100 greedy starts produced identical score=20 in testing). Random chunk starts escape this by providing diverse starting configurations for the swap pass to optimize.
- **Swap pass on each candidate**: Rather than applying swap pass only to the final winner, we apply it to each multi-start candidate. This is critical because the swap pass can dramatically improve random chunk starts that have suboptimal initial scores.
- **Statistical maxPairCount test**: The integration test checks that >=80% of 20 trials achieve maxPairCount<=2, rather than requiring 100%. This avoids flaky tests while still verifying the algorithm's effectiveness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NUM_STARTS increased from 5 to 20**
- **Found during:** Task 1 GREEN phase
- **Issue:** NUM_STARTS=5 produced 0% success rate for maxPairCount<=2 with 8 players / 4 rounds. Even NUM_STARTS=20 with pure greedy starts produced 0% success rate.
- **Fix:** Increased to 20 and changed strategy to half greedy / half random chunk starts with swap pass on each candidate.
- **Files modified:** src/lib/pod-algorithm.ts
- **Verification:** 98% success rate over 50 simulations
- **Committed in:** 59c0712

**2. [Rule 1 - Bug] Swap pass applied per-candidate instead of post-selection**
- **Found during:** Task 1 GREEN phase
- **Issue:** Applying swap pass only to the final best greedy result couldn't escape local minima. Greedy consistently converged to score=20 while optimal was 12.
- **Fix:** Apply swap pass to each multi-start candidate, keep best overall result.
- **Files modified:** src/lib/pod-algorithm.ts
- **Verification:** Random chunk starts + swap pass frequently reach score=12 (global optimum)
- **Committed in:** 59c0712

**3. [Rule 1 - Bug] Last pod fairness test adjusted for tied penalties**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test counted last pod as "worst" even when all pods had equal penalty (which is the optimal outcome from swap pass).
- **Fix:** Only count as "unique worst" when exactly one pod has the maximum penalty.
- **Files modified:** src/lib/pod-algorithm.integration.test.ts
- **Verification:** Test passes consistently
- **Committed in:** 59c0712

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes were necessary to achieve the plan's stated truth that maxPairCount <= 2. The core algorithm design (quadratic scoring + multi-start + swap pass) is unchanged; only the tuning parameters and application strategy differ.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Algorithm improvements complete and tested
- Phase 6 Plan 2 (seat verification and mutation testing) can proceed
- Phase 7 (pods of 3) depends on Phase 6 completion
- The hardcoded `4` in greedyAssign's `for (let slot = 1; slot < 4; slot++)` will need parameterization in Phase 7

---
*Phase: 06-opponent-diversity-and-seat-verification*
*Completed: 2026-03-02*
