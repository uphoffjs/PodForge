# Phase 7: Pods of 3 - Research

**Researched:** 2026-03-02
**Domain:** Pod partitioning algorithm, React UI toggle, Cypress E2E
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- user granted full discretion on all implementation choices.

### Claude's Discretion
User granted full discretion on all implementation choices. The following areas are all open for Claude to decide based on best practices and the existing codebase patterns:

- **Toggle placement and behavior** -- where the "allow pods of 3" toggle appears in AdminControls, whether it persists across rounds or resets, when it's visible vs hidden
- **Pod size partitioning logic** -- how to split players into mixed 4/3-player pods to minimize byes, the `computePodSizes()` function design
- **3-player pod display** -- how PodCard renders 3-player pods (seat labels, card sizing, visual indicators)
- **Edge case warnings** -- how to handle 5 players with toggle on, 4 players (toggle meaningless), and other edge cases. Whether to show warnings, silently fall back, or disable the toggle

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POD3-01 | Admin can enable a per-round "allow pods of 3" checkbox before generating a round | Toggle UI pattern from timer duration picker in AdminControls; `useState<boolean>` with checkbox element; reset after generation |
| POD3-02 | When enabled, algorithm produces pods of 3 instead of byes where mathematically possible | `computePodSizes()` pure function determines partition; `generatePods` accepts `allowPodsOf3` parameter; `greedyAssign` generalized to variable pod sizes |
| POD3-03 | `computePodSizes()` pure function handles all player counts 4-20 with correct partition math | Partition formula based on `n % 4` remainder; exhaustive table verified for all counts 3-20 |
| POD3-04 | For n=5 with toggle enabled, algorithm falls back to 1x4 + 1 bye with admin warning | n=5 is the only value in [3,20] that cannot be expressed as 4a + 3b; special-case with warning via `result.warnings` |
| POD3-05 | Minimum player threshold relaxes from 4 to 3 when toggle is active | Change validation from `< 4` to `< 3` (or conditional on toggle); n=3 yields one pod of 3 |
| POD3-06 | PodCard component renders 3-player pods correctly (seats 1st-3rd) | PodCard already renders dynamically based on players array length; `getOrdinal()` handles 3rd; seat shuffle changes from `[1,2,3,4]` to `[1,2,3]` for 3-player pods |
| POD3-07 | E2E tests cover toggle interaction, round generation with pods of 3, and edge cases | New Cypress spec following generate-round.cy.js pattern; mock RPC + fixture data for 3-player pods |
| TEST-02 | Cypress E2E tests cover pods-of-3 toggle, 3-player pod display, and opponent diversity scenarios | Covered by POD3-07 implementation |
| TEST-03 | Integration tests validate pod generation with parameterized player counts (4-20) for both toggle states | Extend existing `pod-algorithm.integration.test.ts` parameterized test with `allowPodsOf3: true` variant |
</phase_requirements>

## Summary

Phase 7 adds a per-round "allow pods of 3" toggle to the admin controls. When enabled, the pod algorithm produces a mix of 4-player and 3-player pods to eliminate or reduce byes. The core challenge is a mathematical partitioning function (`computePodSizes()`) that determines how many pods of each size to create for a given player count, plus generalizing the existing `greedyAssign()` function to handle variable-sized pods.

The existing codebase is well-structured for this change. The algorithm in `pod-algorithm.ts` is a pure function with no side effects, making it straightforward to add an `allowPodsOf3` parameter. PodCard already renders dynamically based on the players array length and `getOrdinal()` handles "3rd" correctly. The `generate_round` RPC already accepts arbitrary JSONB pod assignments, so no database or backend changes are needed. The main work is: (1) the `computePodSizes()` partition logic, (2) generalizing `greedyAssign` from fixed 4-player pods to variable sizes, (3) adding the toggle UI, and (4) comprehensive test coverage.

**Primary recommendation:** Implement `computePodSizes()` as a standalone pure function with exhaustive unit tests first, then modify `generatePods` to accept and use it, then add the UI toggle, then E2E tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | UI components | Already in use |
| Vitest | 4.0.18 | Unit + integration tests | Already configured |
| Stryker | 9.5.1 | Mutation testing | Already configured at 80% threshold |
| Cypress | 15.10.0 | E2E tests | Already configured |
| TypeScript | 5.9.3 | Type safety | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Component testing | AdminControls toggle tests |
| @testing-library/user-event | 14.6.1 | User interaction simulation | Toggle click tests |
| sonner | 2.0.7 | Toast notifications | Edge case warnings |

### Alternatives Considered
No new libraries needed. All changes use existing dependencies.

**Installation:**
No new packages required.

## Architecture Patterns

### Recommended Changes to Project Structure
No new files or directories needed beyond tests. Changes are to existing files:
```
src/
  lib/
    pod-algorithm.ts          # Add computePodSizes(), modify generatePods(), generalize greedyAssign()
    pod-algorithm.test.ts     # Add computePodSizes unit tests, allowPodsOf3 tests
    pod-algorithm.integration.test.ts  # Add parameterized tests with allowPodsOf3
  components/
    AdminControls.tsx         # Add toggle checkbox, pass allowPodsOf3 to generatePods()
    AdminControls.test.tsx    # Add toggle interaction tests
  # PodCard.tsx and useGenerateRound.ts: NO changes needed
```

### Pattern 1: computePodSizes() Pure Function
**What:** Standalone pure function that takes player count and toggle state, returns array of pod sizes.
**When to use:** Called by `generatePods()` to determine pod structure before assignment.
**Example:**
```typescript
/**
 * Compute pod sizes for a given player count.
 * When allowPodsOf3 is false: all pods are 4, remainder become byes.
 * When allowPodsOf3 is true: mix of 4s and 3s to minimize byes.
 *
 * Returns { podSizes: number[], byeCount: number }
 */
export function computePodSizes(
  playerCount: number,
  allowPodsOf3: boolean
): { podSizes: number[]; byeCount: number } {
  if (allowPodsOf3) {
    // Special case: n=5 cannot be expressed as 4a + 3b
    if (playerCount === 5) {
      return { podSizes: [4], byeCount: 1 }
    }
    // n=3: one pod of 3
    if (playerCount === 3) {
      return { podSizes: [3], byeCount: 0 }
    }
    // General formula for n >= 6:
    const remainder = playerCount % 4
    if (remainder === 0) {
      return { podSizes: Array(playerCount / 4).fill(4), byeCount: 0 }
    } else if (remainder === 1) {
      // Trade 2 fours for 3 threes: net +1
      const fours = Math.floor(playerCount / 4) - 2
      return { podSizes: [...Array(fours).fill(4), ...Array(3).fill(3)], byeCount: 0 }
    } else if (remainder === 2) {
      // Trade 1 four for 2 threes: net +2
      const fours = Math.floor(playerCount / 4) - 1
      return { podSizes: [...Array(fours).fill(4), ...Array(2).fill(3)], byeCount: 0 }
    } else {
      // remainder === 3: add 1 three
      const fours = Math.floor(playerCount / 4)
      return { podSizes: [...Array(fours).fill(4), 3], byeCount: 0 }
    }
  } else {
    // Original behavior: all pods of 4
    const numPods = Math.floor(playerCount / 4)
    const byeCount = playerCount % 4
    return { podSizes: Array(numPods).fill(4), byeCount }
  }
  // n=4 with toggle: [4], 0 byes (handled by remainder === 0)
}
```

### Pattern 2: Generalized greedyAssign with Variable Pod Sizes
**What:** Modify `greedyAssign()` to accept an array of pod sizes instead of assuming all pods are 4.
**When to use:** When pods can be different sizes (mix of 3s and 4s).
**Example:**
```typescript
export function greedyAssign(
  pool: string[],
  podSizes: number[],  // Changed from numPods: number
  history: Map<string, Map<string, number>>
): string[][] {
  const pods: string[][] = Array.from({ length: podSizes.length }, () => [])
  const remaining = [...pool]

  for (let podIdx = 0; podIdx < podSizes.length; podIdx++) {
    // Pick first player from remaining (already shuffled)
    pods[podIdx].push(remaining[0])
    remaining.splice(0, 1)

    // Fill remaining slots greedily
    for (let slot = 1; slot < podSizes[podIdx]; slot++) {
      let bestIdx = 0
      let bestScore = getOpponentScore(remaining[0], pods[podIdx], history)

      for (let i = 1; i < remaining.length; i++) {
        const score = getOpponentScore(remaining[i], pods[podIdx], history)
        if (score < bestScore) {
          bestScore = score
          bestIdx = i
        }
      }

      pods[podIdx].push(remaining[bestIdx])
      remaining.splice(bestIdx, 1)
    }
  }

  return pods
}
```

### Pattern 3: Toggle UI Following Timer Picker Pattern
**What:** Add a checkbox toggle in AdminControls following the same pattern as the timer duration picker.
**When to use:** Per-round admin control that resets after generation.
**Example:**
```tsx
// In AdminControls, near the timer duration picker:
const [allowPodsOf3, setAllowPodsOf3] = useState(false)

// In JSX, between timer picker and generate button:
{!isEventEnded && (
  <label className="flex items-center gap-2 mb-3 cursor-pointer" data-testid="pods-of-3-toggle">
    <input
      type="checkbox"
      checked={allowPodsOf3}
      onChange={(e) => setAllowPodsOf3(e.target.checked)}
      data-testid="pods-of-3-checkbox"
      className="..."
    />
    <span className="text-sm text-text-secondary">Allow pods of 3</span>
  </label>
)}

// Pass to generatePods:
const result = generatePods(activePlayers, previousRounds, allowPodsOf3)

// Reset after success:
setAllowPodsOf3(false)
```

### Anti-Patterns to Avoid
- **Hardcoding pod size throughout the algorithm:** The current code has `4` literals in 7+ places (line 187: `slot < 4`, line 293: `% 4`, line 324: `/ 4`, line 341: `* 4`, line 361: `[1,2,3,4]`). All must be parameterized via `computePodSizes()` output.
- **Modifying the Supabase RPC or database schema:** The `generate_round` RPC already accepts arbitrary JSONB pod assignments. No backend changes needed.
- **Persisting toggle state across rounds:** The toggle should reset after each round generation (like the timer duration picker), not persist in session storage.
- **Adding a "pod size" column to the database:** The existing `pod_players.seat_number` (nullable integer) and pod structure already support variable-sized pods.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pod partitioning | Ad-hoc conditionals scattered in generatePods | Dedicated `computePodSizes()` pure function | Centralized, testable, exhaustive coverage for all player counts |
| Variable seat shuffles | Manual if/else for [1,2,3] vs [1,2,3,4] | `shuffleArray(Array.from({length: podSize}, (_, i) => i + 1))` | Works for any pod size without branching |
| Edge case detection | Inline checks in UI code | Warnings in `PodAssignmentResult.warnings[]` | Algorithm already returns warnings; keep the pattern consistent |

**Key insight:** The `computePodSizes()` function is the single source of truth for pod structure. All downstream code (greedy assign, seat shuffle, result building) should consume its output rather than independently computing pod sizes.

## Common Pitfalls

### Pitfall 1: greedyAssign Hardcoded to 4 Slots
**What goes wrong:** The inner loop `for (let slot = 1; slot < 4; slot++)` fills exactly 3 more players after the first. For 3-player pods, this would try to fill a 4th player.
**Why it happens:** The original algorithm was designed exclusively for pods of 4.
**How to avoid:** Change the loop bound to use the pod's target size from `podSizes[podIdx]`.
**Warning signs:** Pods with wrong player counts, index-out-of-bounds errors.

### Pitfall 2: Random Chunk Assignment Also Hardcoded to 4
**What goes wrong:** The second half of multi-start uses `pool.slice(i * 4, (i + 1) * 4)` for random chunk assignment. With variable pod sizes, this would create wrong-sized chunks.
**Why it happens:** Same `4` literal assumption as greedy.
**How to avoid:** Compute slice boundaries from the cumulative sum of `podSizes`.
**Warning signs:** Players assigned to wrong pod, total player count mismatch.

### Pitfall 3: Seat Shuffle Hardcoded to [1,2,3,4]
**What goes wrong:** `shuffleArray([1, 2, 3, 4])` always generates 4 seats. A 3-player pod would get 4 seat numbers but only 3 players.
**Why it happens:** Line 361 hardcodes the seat array.
**How to avoid:** Generate seat array based on actual pod size: `Array.from({length: pod.length}, (_, i) => i + 1)`.
**Warning signs:** Seat numbers not matching player count, extra undefined seats.

### Pitfall 4: Swap Pass Between Differently-Sized Pods
**What goes wrong:** The swap pass swaps individual players between pods. When pods have different sizes, a swap preserves sizes (it's a 1-for-1 exchange), so this works correctly without modification.
**Why it happens:** N/A -- this is actually fine.
**How to avoid:** No changes needed. The swap pass only swaps individual players, never moves them, so pod sizes remain stable.
**Warning signs:** None expected.

### Pitfall 5: n=5 Edge Case Produces Invalid Partition
**What goes wrong:** With 5 players and toggle on, naive math might try to create pods that don't add up (e.g., 3+2, but 2-player pods are not allowed).
**Why it happens:** 5 = 4*a + 3*b has no solution for a,b >= 0 (5-3=2, not divisible by 4; 5-4=1, not divisible by 3).
**How to avoid:** Explicit check in `computePodSizes()` for n=5 returning `{ podSizes: [4], byeCount: 1 }` with a warning.
**Warning signs:** Algorithm crash or pods that don't sum to playerCount.

### Pitfall 6: Integration Tests Assume All Pods Are Size 4
**What goes wrong:** Existing integration tests check `pod.players.toHaveLength(4)` and `seats.toEqual([1,2,3,4])` for all non-bye pods.
**Why it happens:** Tests were written before pods-of-3 existed.
**How to avoid:** Parameterize these assertions: pods should have length matching their target size from `computePodSizes()`, seats should be `[1..podSize]`.
**Warning signs:** Tests failing for valid 3-player pods.

### Pitfall 7: Minimum Player Threshold Error Message
**What goes wrong:** `useGenerateRound.ts` line 43 checks for `'fewer than 4'` in error messages. If the threshold changes to 3, this error handler would need updating.
**Why it happens:** The error message string is coupled to the old threshold.
**How to avoid:** Change the threshold conditionally (3 when toggle is on, 4 when off), and update the error message accordingly. Or use a more generic message like "Not enough players".
**Warning signs:** Wrong error toast displayed.

## Code Examples

### Complete computePodSizes Partition Table (Verified)

For `allowPodsOf3 = true`, player counts 3-20:

| Players | Pods of 4 | Pods of 3 | Byes | Total |
|---------|-----------|-----------|------|-------|
| 3 | 0 | 1 | 0 | 3 |
| 4 | 1 | 0 | 0 | 4 |
| 5 | 1 | 0 | 1 | 5 (edge case) |
| 6 | 0 | 2 | 0 | 6 |
| 7 | 1 | 1 | 0 | 7 |
| 8 | 2 | 0 | 0 | 8 |
| 9 | 0 | 3 | 0 | 9 |
| 10 | 1 | 2 | 0 | 10 |
| 11 | 2 | 1 | 0 | 11 |
| 12 | 3 | 0 | 0 | 12 |
| 13 | 1 | 3 | 0 | 13 |
| 14 | 2 | 2 | 0 | 14 |
| 15 | 3 | 1 | 0 | 15 |
| 16 | 4 | 0 | 0 | 16 |
| 17 | 2 | 3 | 0 | 17 |
| 18 | 3 | 2 | 0 | 18 |
| 19 | 4 | 1 | 0 | 19 |
| 20 | 5 | 0 | 0 | 20 |

**Derivation formula:**
- `remainder = playerCount % 4`
- `remainder == 0`: all 4s, zero 3s
- `remainder == 1`: `floor(n/4) - 2` fours + 3 threes (trade two 4s for three 3s: net +1)
- `remainder == 2`: `floor(n/4) - 1` fours + 2 threes (trade one 4 for two 3s: net +2)
- `remainder == 3`: `floor(n/4)` fours + 1 three

### Modifying generatePods Signature
```typescript
export function generatePods(
  activePlayers: PlayerInfo[],
  previousRounds: RoundHistory[],
  allowPodsOf3: boolean = false  // New optional parameter, backward-compatible
): PodAssignmentResult {
  // 1. Validation -- threshold depends on toggle
  const minPlayers = allowPodsOf3 ? 3 : 4
  if (activePlayers.length < minPlayers) {
    throw new Error(`Fewer than ${minPlayers} active players`)
  }

  // 2. Compute pod sizes
  const { podSizes, byeCount } = computePodSizes(activePlayers.length, allowPodsOf3)

  // Edge case warning for n=5
  if (allowPodsOf3 && activePlayers.length === 5) {
    warnings.push('5 players cannot be split into pods of 3 and 4. Using 1 pod of 4 with 1 bye.')
  }

  // ... rest of algorithm uses podSizes instead of hardcoded 4
}
```

### Generating Seat Array Dynamically
```typescript
// Current (hardcoded):
const seatOrder = shuffleArray([1, 2, 3, 4])

// Updated (dynamic):
const seatOrder = shuffleArray(
  Array.from({ length: finalPods[i].length }, (_, j) => j + 1)
)
```

### Random Chunk Assignment with Variable Sizes
```typescript
// Current (hardcoded):
pods = Array.from({ length: numPods }, (_, i) =>
  pool.slice(i * 4, (i + 1) * 4)
)

// Updated (variable sizes):
let offset = 0
pods = podSizes.map((size) => {
  const chunk = pool.slice(offset, offset + size)
  offset += size
  return chunk
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed pods of 4 only | Variable 3/4 pods via computePodSizes | Phase 7 (this phase) | Eliminates byes for most player counts |
| greedyAssign(pool, numPods, history) | greedyAssign(pool, podSizes, history) | Phase 7 | Supports mixed pod sizes |
| Hardcoded [1,2,3,4] seat shuffle | Dynamic seat array from pod size | Phase 7 | Correct seats for 3-player pods |

**No deprecated/outdated patterns to replace** -- this is new functionality built on the Phase 6 algorithm improvements.

## Open Questions

1. **Should the toggle persist across rounds or reset?**
   - What we know: Timer duration picker resets to null after generation. The toggle is per-round.
   - Recommendation: Reset to false after generation, matching the timer picker pattern. This prevents admins from accidentally generating pods-of-3 when they only wanted it for one round.

2. **Should the toggle be hidden when player count is divisible by 4?**
   - What we know: When count % 4 == 0, there are no byes, so pods-of-3 adds no benefit (it would only reduce pod quality by making smaller pods).
   - Recommendation: Always show the toggle. Let the admin decide. The algorithm already produces all-4s when that's optimal. Hiding it based on current player count creates confusing UX if a player drops between toggle and generation.

3. **How should the checkbox be styled?**
   - What we know: The existing UI uses custom-styled buttons for timer duration, not native checkboxes. The design system uses bg-accent for selected states.
   - Recommendation: Use a simple HTML checkbox with a label, styled consistently with the text-secondary color. A checkbox is more semantically appropriate than a toggle button for a boolean option.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/lib/pod-algorithm.ts` (386 lines), `src/components/AdminControls.tsx` (243 lines), `src/components/PodCard.tsx` (108 lines), `src/hooks/useGenerateRound.ts` (55 lines)
- Existing test suites: `pod-algorithm.test.ts` (~900 lines), `pod-algorithm.integration.test.ts` (633 lines), `AdminControls.test.tsx` (735 lines), `PodCard.test.tsx` (330 lines)
- Cypress E2E tests: `generate-round.cy.js`, `pod-display.cy.js`, `cypress/support/commands.js`
- Fixture data: `cypress/fixtures/pods.json`
- Stryker config: `stryker.config.mjs` (80% break threshold)

### Secondary (MEDIUM confidence)
- Mathematical partition analysis for `4a + 3b = n` -- verified by exhaustive enumeration for n=3 through n=20

### Tertiary (LOW confidence)
None -- all findings are derived from direct codebase analysis and verified mathematics.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- direct codebase analysis, clear modification points identified
- Pitfalls: HIGH -- 7 specific hardcoded-4 locations identified with exact line numbers and fixes
- Partition math: HIGH -- exhaustive table verified for all player counts 3-20

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- no external dependencies, pure algorithm + UI work)
