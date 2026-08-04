---
phase: 07-pods-of-3
plan: 01
subsystem: algorithm
tags: [pod-algorithm, variable-pod-sizes, computePodSizes, greedy-assign, tdd]

# Dependency graph
requires:
  - phase: 06-opponent-diversity-and-seat-verification
    provides: "Multi-start greedy algorithm with quadratic scoring and swap pass"
provides:
  - "computePodSizes() pure function for optimal 3/4 pod partitioning"
  - "greedyAssign() generalized to accept variable podSizes array"
  - "generatePods() with allowPodsOf3 parameter (backward-compatible default=false)"
  - "Dynamic seat assignment based on pod size (3-player pods get [1,2,3])"
affects: [07-02-PLAN, 07-03-PLAN, ui-components, e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [remainder-formula-partitioning, variable-pod-sizes, offset-based-chunk-slicing]

key-files:
  created: []
  modified:
    - src/lib/pod-algorithm.ts
    - src/lib/pod-algorithm.test.ts
    - src/lib/pod-algorithm.integration.test.ts

key-decisions:
  - "computePodSizes uses remainder-formula approach: remainder 0=all 4s, 1=(n/4-2) 4s + 3 3s, 2=(n/4-1) 4s + 2 3s, 3=n/4 4s + 1 3"
  - "n=5 is the only unsolvable case with allowPodsOf3=true (1 pod of 4 + 1 bye)"
  - "allowPodsOf3 parameter defaults to false for full backward compatibility"
  - "greedyAssign accepts podSizes:number[] instead of numPods:number, enabling variable-size pod filling"

patterns-established:
  - "Variable pod sizes: all pod-aware code uses podSizes array, never hardcoded 4"
  - "Offset-based chunk slicing: random chunk assignment uses cumulative offset instead of i*4"
  - "Dynamic seat generation: Array.from({length: pod.length}, (_, j) => j + 1) instead of [1,2,3,4]"

requirements-completed: [POD3-02, POD3-03, POD3-04, POD3-05, TEST-03]

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 7 Plan 1: computePodSizes + Algorithm Generalization Summary

**computePodSizes pure function with remainder-formula partitioning and generalized greedyAssign/generatePods for variable 3/4 pod sizes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T18:14:19Z
- **Completed:** 2026-03-02T18:20:48Z
- **Tasks:** 3 (TDD RED/GREEN/REFACTOR)
- **Files modified:** 3

## Accomplishments
- computePodSizes() correctly partitions all player counts 3-20 into optimal mix of 3s and 4s (only n=5 unsolvable)
- greedyAssign() generalized from fixed 4-player pods to variable podSizes array
- generatePods() accepts allowPodsOf3 parameter with full backward compatibility (default=false)
- 3-player pods correctly get seats [1,2,3], 4-player pods get [1,2,3,4]
- 188 unit tests + 68 integration tests pass (818 total across codebase)

## Task Commits

Each task was committed atomically (TDD flow):

1. **RED: Failing tests** - `72b9a94` (test)
2. **GREEN: Implementation** - `caef5a6` (feat)
3. **REFACTOR: Comment cleanup** - `022730e` (refactor)

## Files Created/Modified
- `src/lib/pod-algorithm.ts` - Added computePodSizes(), generalized greedyAssign() and generatePods() for variable pod sizes
- `src/lib/pod-algorithm.test.ts` - Added 75 new tests: computePodSizes exhaustive, greedyAssign variable sizes, generatePods allowPodsOf3
- `src/lib/pod-algorithm.integration.test.ts` - Added 36 new tests: parameterized structural correctness for both toggle states, opponent diversity with variable pods

## Decisions Made
- computePodSizes uses remainder-formula approach rather than lookup table -- scales to any player count
- n=5 with allowPodsOf3=true produces a specific warning message and falls back to 1x4 + 1 bye
- Minimum player threshold is 3 when allowPodsOf3=true (was always 4 before)
- Existing greedyAssign callers in integration tests updated to pass [4, 4] instead of 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core algorithm complete with computePodSizes, greedyAssign, and generatePods all supporting variable pod sizes
- Ready for Plan 07-02: UI toggle and database schema for allowPodsOf3 setting
- Ready for Plan 07-03: E2E tests for pods-of-3 user flows

## Self-Check: PASSED

- All 3 source/test files exist on disk
- All 3 task commits verified (72b9a94, caef5a6, 022730e)
- SUMMARY.md created at expected path

---
*Phase: 07-pods-of-3*
*Completed: 2026-03-02*
