# Architecture Research

**Domain:** Pod algorithm improvements — repeat opponent reduction, seat randomization, pods of 3 toggle
**Researched:** 2026-03-02
**Confidence:** HIGH (based on direct codebase inspection — all findings are from source files, no speculation)

---

## Context: What v4.0 Is Adding to Existing Architecture

This is a subsequent milestone, not a greenfield project. The existing architecture is fully understood from direct source inspection. The three v4.0 features all route through a single choke point:

```
AdminControls.tsx
  └── generatePods()          ← pod-algorithm.ts (pure function)
        └── PodAssignment[]
              └── useGenerateRound.mutate()
                    └── supabase.rpc('generate_round')
                          └── rounds + pods + pod_players (DB)
```

All three features (better opponent avoidance, seat randomization verification, pods of 3) touch only `pod-algorithm.ts` and `AdminControls.tsx`. The Supabase RPC, database schema, and all other components remain unchanged.

---

## System Overview (With v4.0 Touch Points)

```
+------------------------------------------------------------------+
|                     React SPA (EventPage.tsx)                    |
|                                                                  |
|  AdminControls.tsx  [MODIFIED]                                   |
|  +------------------------------------------------------------+  |
|  | [NEW] allowPodsOf3 toggle  (boolean useState)              |  |
|  | handleGenerateRound()                                      |  |
|  |   → generatePods(activePlayers, history, { allowPodsOf3 }) |  |
|  +----------------------------+-------------------------------+  |
|                               | PodAssignment[]                  |
|  pod-algorithm.ts  [MODIFIED] |                                  |
|  +----------------------------v-------------------------------+  |
|  | generatePods(players, history, options?)   [MODIFIED]      |  |
|  |   buildOpponentHistory()                  [IMPROVED]       |  |
|  |   buildByeCounts()                        [unchanged]      |  |
|  |   selectByePlayers OR podOf3Sizing()      [NEW branch]     |  |
|  |   greedy assignment (multi-start)         [IMPROVED]       |  |
|  |   shuffleArray([1,2,3,4]) for seats       [already correct]|  |
|  +----------------------------+-------------------------------+  |
|                               | PodAssignment[]                  |
|  useGenerateRound.ts  [UNCHANGED]                                |
|  +----------------------------v-------------------------------+  |
|  | mutate({ passphrase, podAssignments, timerDuration? })     |  |
|  | supabase.rpc('generate_round', { p_pod_assignments: JSONB })|  |
|  +----------------------------+-------------------------------+  |
|                               |                                  |
+-------------------------------|----------------------------------+
                                | Supabase RPC  [UNCHANGED]
+-------------------------------|----------------------------------+
|  generate_round()             |                                  |
|  +----------------------------v-------------------------------+  |
|  | validate passphrase                                        |  |
|  | INSERT rounds                                              |  |
|  | FOR pod IN jsonb_array_elements(p_pod_assignments)         |  |
|  |   INSERT pods (pod_number, is_bye)                         |  |
|  |   INSERT pod_players (player_id, seat_number)              |  |
|  | RETURN round_number                                        |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  DB: rounds, pods, pod_players  [NO SCHEMA CHANGES NEEDED]       |
+------------------------------------------------------------------+

  PodCard.tsx  [VERIFY ONLY — likely no change needed]
  +------------------------------------------------------------+
  | getOrdinal(n) already has fallback: case 1/2/3/4 + ${n}th  |
  | sort by seat_number: works for any pod size                 |
  | POD_COLORS: cycles, works for any pod count                 |
  +------------------------------------------------------------+
```

---

## Component Responsibilities

| Component | Responsibility | v4.0 Change |
|-----------|---------------|-------------|
| `pod-algorithm.ts` | Pure pairing logic — opponent history, bye rotation, seat assignment | MODIFIED: multi-start greedy for better avoidance, pods-of-3 sizing branch, options param |
| `AdminControls.tsx` | Builds algorithm inputs, calls generatePods, fires mutation | MODIFIED: add allowPodsOf3 toggle UI, pass options to generatePods |
| `useGenerateRound.ts` | TanStack mutation — calls Supabase RPC, invalidates queries | UNCHANGED |
| `generate_round` RPC | Atomic DB write of round + pods + pod_players | UNCHANGED — already accepts pods of any size via JSONB iteration |
| `PodCard.tsx` | Renders a pod with players and seat labels | VERIFY ONLY — getOrdinal already handles 1st/2nd/3rd; confirm 3-player pods render correctly |
| `RoundDisplay.tsx` | Renders current round's pods | UNCHANGED — iterates pods without size assumption |
| `PreviousRounds.tsx` | Lazy-loads and renders previous rounds | UNCHANGED |
| `src/types/database.ts` | TypeScript types for DB shapes | UNCHANGED — no new columns |

---

## What Is New vs Modified vs Unchanged

### NEW (net new code)
- `GeneratePodsOptions` interface in `pod-algorithm.ts`
- `allowPodsOf3` toggle button in `AdminControls.tsx`
- Pod-of-3 sizing logic branch inside `generatePods()`
- `scoreAssignment()` helper for multi-start greedy scoring

### MODIFIED (surgical changes, no rewrites)
- `pod-algorithm.ts` — add options param (backwards compatible), add pod-of-3 branch, wrap greedy in multi-start loop
- `AdminControls.tsx` — add `useState` for toggle, pass options object to `generatePods()`
- `pod-algorithm.test.ts` — add test cases for pods-of-3 scenarios
- `pod-algorithm.integration.test.ts` — add multi-round pods-of-3 tests, tighten opponent avoidance thresholds
- `AdminControls.test.tsx` — add toggle render + state tests

### UNCHANGED (confirmed from source inspection)
- `useGenerateRound.ts` — the `p_pod_assignments: JSONB` RPC param accepts any pod size today
- `supabase/migrations/00002_rounds_pods_admin.sql` — the RPC iterates `jsonb_array_elements` without assuming pod size = 4
- `PodCard.tsx` — `getOrdinal()` already has explicit cases for 1/2/3/4 and a `${n}th` fallback; sort by seat works for any count; POD_COLORS cycles
- All timer hooks and components
- All player management hooks and components
- `EventPage.tsx`
- `src/types/database.ts`
- All Supabase migrations

---

## Architectural Patterns for v4.0

### Pattern 1: Options Object for generatePods (backwards compatible extension)

**What:** Add a third parameter as an options object, not a positional boolean. All existing call sites remain valid.

**Why:** Positional booleans (`generatePods(players, history, true, false)`) are unreadable and brittle. An options object scales cleanly.

```typescript
// ADD to pod-algorithm.ts
export interface GeneratePodsOptions {
  allowPodsOf3?: boolean
}

// MODIFIED signature
export function generatePods(
  activePlayers: PlayerInfo[],
  previousRounds: RoundHistory[],
  options: GeneratePodsOptions = {}
): PodAssignmentResult {
  const { allowPodsOf3 = false } = options
  // ... existing validation, buildOpponentHistory, buildByeCounts ...
}

// All existing test calls (generatePods(players, [])) remain valid — no updates needed
```

### Pattern 2: Pods-of-3 Sizing Algorithm

**What:** When `allowPodsOf3 = true`, replace the "remainder goes to bye" logic with a hybrid pod-sizing algorithm that finds the minimum number of 3-player pods to eliminate the remainder.

**The math:** Find the minimum `k` (count of 3-player pods) such that `(n - 3k) % 4 === 0`. The rest become 4-player pods.

**Player count lookup (n=4 to n=20):**

| n | allowPodsOf3=false | allowPodsOf3=true |
|---|-------------------|-------------------|
| 4 | 1×4 | 1×4 |
| 5 | 1×4 + 1 bye | 1×3 + 1 bye* |
| 6 | 1×4 + 2 bye | 2×3 |
| 7 | 1×4 + 3 bye | 1×4 + 1×3 |
| 8 | 2×4 | 2×4 |
| 9 | 2×4 + 1 bye | 3×3 |
| 10 | 2×4 + 2 bye | 1×4 + 2×3 |
| 11 | 2×4 + 3 bye | 2×4 + 1×3 |
| 12 | 3×4 | 3×4 |
| 13 | 3×4 + 1 bye | 1×4 + 3×3 |
| 14 | 3×4 + 2 bye | 2×4 + 2×3 |
| 15 | 3×4 + 3 bye | 3×4 + 1×3 |
| 16 | 4×4 | 4×4 |
| 17 | 4×4 + 1 bye | 2×4 + 3×3 |
| 18 | 4×4 + 2 bye | 3×4 + 2×3 |
| 19 | 4×4 + 3 bye | 4×4 + 1×3 |
| 20 | 5×4 | 5×4 |

*n=5 special case: `(5-3)=2` is not divisible by 4. No combination of 3-pods eliminates the need for a remainder when n=5. Best option: 1×3 + 2-person bye, or just 1×4 + 1 bye. Recommend: for n=5 with `allowPodsOf3=true`, fall through to 1×4 + 1 bye with a warning. This is the only player count where the toggle doesn't help.

**Implementation approach:**

```typescript
function computePodSizes(n: number, allowPodsOf3: boolean): { pods4: number; pods3: number; byeCount: number } {
  // n=0 handled upstream (validation throws)
  if (n % 4 === 0 || !allowPodsOf3) {
    return { pods4: Math.floor(n / 4), pods3: 0, byeCount: n % 4 }
  }
  // Find minimum k (3-pods) such that (n - 3k) % 4 === 0
  for (let k = 1; k <= Math.floor(n / 3); k++) {
    const remainder = n - 3 * k
    if (remainder >= 0 && remainder % 4 === 0) {
      return { pods4: remainder / 4, pods3: k, byeCount: 0 }
    }
  }
  // Fallback: no valid split (only n=5 reaches here)
  return { pods4: Math.floor(n / 4), pods3: 0, byeCount: n % 4 }
}
```

The output `PodAssignment[]` shape is identical for pods of 3 — they just have 3 players and `seat_number` values 1, 2, 3. The RPC handles this without any change.

### Pattern 3: Seat Randomization — Verification, Not Fix

**What:** Seats are ALREADY randomized correctly via `shuffleArray([1, 2, 3, 4])` on line 222 of `pod-algorithm.ts`. The integration test `seat assignments are randomized` asserts `uniqueOrders.size > 1`. This feature is already shipped in v2.0 per `PROJECT.md`.

**Investigation required:** The v4.0 requirement "fix seat order" needs clarification before implementation. The algorithm is correct. The question is whether there is a user-visible bug, and if so, where it originates:

1. Is `PodCard.tsx`'s `sortedPlayers.sort((a,b) => seatNumber)` causing confusion? (No — displaying in seat order is intentional and correct.)
2. Is the test for randomization loose enough to miss an actual bug? (Check: `uniqueOrders.size > 1` over 10 rounds is not very strict.)
3. Is this actually a complaint about player order within a pod being similar round over round, even with different seat numbers? (Possible — e.g., if player A is always listed first because seat 1 is assigned to the first player added to the pod.)

**Recommendation:** Run the integration test with higher round counts (50+) and track seat position distribution per player. If the distribution is even, the feature is working. If not, the bug is in the `shuffleArray` call or how it's seeded. Add a statistical assertion.

### Pattern 4: Improved Opponent Avoidance — Multi-Start Greedy

**What:** Run the greedy algorithm N times (5 iterations is sufficient), keep the assignment with the lowest total repeat-opponent score.

**Why not a more complex algorithm:** This app targets 4–20 players. The greedy algorithm runs in O(n²) per iteration. 5 iterations of O(n²) for n=20 is trivially fast. Simulated annealing or ILP solvers are unnecessary complexity for this scale.

**Current algorithm quality from integration tests:**
- 8 players, 4 rounds: `maxPairCount <= 3` (current threshold)
- 12 players, 6 rounds: `maxPairCount <= 4` (current threshold)

**Expected improvement with multi-start:** These thresholds can likely tighten to `<= 2` and `<= 3` respectively. Update integration test assertions after verifying empirically.

```typescript
// ADD helper to pod-algorithm.ts
function scoreAssignment(
  assignments: PodAssignment[],
  history: Map<string, Map<string, number>>
): number {
  let total = 0
  for (const pod of assignments) {
    if (pod.is_bye) continue
    const ids = pod.players.map((p) => p.player_id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        total += history.get(ids[i])?.get(ids[j]) ?? 0
      }
    }
  }
  return total
}

// MODIFY the inner greedy body in generatePods to be callable as a function,
// then wrap in multi-start loop:
const ITERATIONS = 5
let bestPods = runGreedy(podPlayers, numPods, numPods3, opponentHistory)
let bestScore = scoreAssignment(buildAssignments(bestPods), opponentHistory)

for (let attempt = 1; attempt < ITERATIONS; attempt++) {
  const candidatePods = runGreedy(podPlayers, numPods, numPods3, opponentHistory)
  const score = scoreAssignment(buildAssignments(candidatePods), opponentHistory)
  if (score < bestScore) {
    bestScore = score
    bestPods = candidatePods
  }
}
```

---

## Data Flow

### Round Generation with v4.0 Changes

```
Admin opens AdminControls
  Admin toggles "Allow pods of 3" (optional)
  Admin clicks "Generate Next Round"
  Admin clicks timer duration (optional)
    ↓
AdminControls.handleGenerateRound()
  reads: allowPodsOf3: boolean  ← [NEW state]
  reads: activePlayers (from props)
  reads: previousRounds (from useAllRoundsPods + useRounds)
    ↓
generatePods(activePlayers, previousRounds, { allowPodsOf3 })  ← [MODIFIED]
  computePodSizes(n, allowPodsOf3)  ← [NEW]
  buildOpponentHistory(previousRounds)  ← unchanged
  buildByeCounts(previousRounds, playerIds)  ← unchanged
  multi-start greedy assignment  ← [IMPROVED]
  shuffleArray seats per pod  ← unchanged
  → PodAssignment[] (pods may have 3 players when toggle is on)
    ↓
useGenerateRound.mutate({ passphrase, podAssignments })  ← UNCHANGED
  supabase.rpc('generate_round', { p_pod_assignments: JSONB })  ← UNCHANGED
    ↓
generate_round() RPC — iterates JSONB, writes rows  ← UNCHANGED
    ↓
queryClient.invalidateQueries(['rounds', 'currentRound', 'pods', 'allRoundsPods', 'timer'])
    ↓
Supabase Realtime → all clients refetch
    ↓
RoundDisplay → PodCard[] renders with 3 or 4 players
```

### Toggle State Flow

The `allowPodsOf3` toggle lives entirely in `AdminControls` component state. It does NOT need to:
- Persist to the database (it is a per-round input, not a stored record)
- Propagate to any other component
- Affect display of historical rounds

After round generation, the toggle may reset to `false` or stay sticky — either UX is acceptable. Sticky is simpler (no explicit reset needed).

---

## File-Level Change Map

```
src/lib/pod-algorithm.ts
  ├── ADD: GeneratePodsOptions interface
  ├── ADD: computePodSizes() helper
  ├── ADD: scoreAssignment() helper
  ├── EXTRACT: inner greedy body to runGreedy()
  ├── MODIFY: generatePods() — accept options, use computePodSizes, multi-start loop
  └── VERIFY: shuffleArray([1,2,3,4]) for seats (already correct)

src/lib/pod-algorithm.test.ts
  ├── ADD: tests for computePodSizes() with allowPodsOf3=true (all n=4–20)
  ├── ADD: tests for generatePods with { allowPodsOf3: true }
  └── KEEP: all existing tests unchanged (no breaking changes to public interface)

src/lib/pod-algorithm.integration.test.ts
  ├── ADD: multi-round scenarios with allowPodsOf3=true
  ├── UPDATE: opponent avoidance thresholds (tighten after empirical verification)
  └── KEEP: all existing tests unchanged

src/components/AdminControls.tsx
  ├── ADD: const [allowPodsOf3, setAllowPodsOf3] = useState(false)
  ├── ADD: toggle button with data-testid="pods-of-3-toggle"
  └── MODIFY: generatePods() call to pass { allowPodsOf3 }

src/components/AdminControls.test.tsx
  ├── ADD: toggle renders when isAdmin=true
  ├── ADD: toggle changes state on click
  ├── ADD: generatePods called with options when toggle is on
  └── KEEP: all existing tests unchanged

src/components/PodCard.tsx
  └── VERIFY ONLY — add unit test for 3-player pod; likely no source change needed
      getOrdinal(1/2/3) already has explicit cases
      sort by seatNumber works for any count
```

---

## Suggested Build Order

The order follows data dependency direction (pure core first, UI last) and ensures each step is independently testable.

### Step 1: Pods-of-3 algorithm (pure function, no dependencies)

**Files:** `src/lib/pod-algorithm.ts`, `src/lib/pod-algorithm.test.ts`, `src/lib/pod-algorithm.integration.test.ts`

- Add `GeneratePodsOptions` interface
- Implement `computePodSizes(n, allowPodsOf3)` with the k-finding loop
- Handle n=5 special case (fall through to bye, emit warning)
- Add seat assignment for pods of 3 (`shuffleArray([1, 2, 3])`)
- Unit test every n=4–20 with both `allowPodsOf3: true` and `false`
- Integration test: generate 5 rounds with pods-of-3 enabled, assert no byes for qualifying n
- Run Stryker — maintain >= 80% mutation score

**Why first:** Pure function with zero React/Supabase deps. Fastest feedback loop. Bugs here are isolated from UI.

### Step 2: Multi-start greedy opponent avoidance (pure function, no dependencies)

**Files:** `src/lib/pod-algorithm.ts`, `src/lib/pod-algorithm.test.ts`, `src/lib/pod-algorithm.integration.test.ts`

- Extract greedy body to `runGreedy()`
- Add `scoreAssignment()` helper
- Wrap `generatePods()` core in multi-start loop (5 iterations)
- Empirically measure improvement: run integration tests, check actual `maxPairCount` values
- Update integration test thresholds to reflect improved quality
- Run Stryker — verify `scoreAssignment` has killed mutants

**Why second:** Independent of pods-of-3. Keeping it as a separate step makes each Stryker run faster and more focused.

### Step 3: Seat randomization audit (verify existing behavior)

**Files:** `src/lib/pod-algorithm.integration.test.ts`

- Add a statistical test: 20 players, 20 rounds, collect seat assignments per player
- Assert each player gets each seat number roughly uniformly (not exact — statistical)
- If the test reveals a bug, fix it in `pod-algorithm.ts`; otherwise document "verified working"
- No UI changes expected from this step

**Why third:** This is verification, not implementation. It either confirms no bug (fast) or reveals one (then fix it before wiring UI).

### Step 4: Admin UI toggle (depends on Step 1)

**Files:** `src/components/AdminControls.tsx`, `src/components/AdminControls.test.tsx`

- Add `allowPodsOf3` state and toggle button
- Use same visual pattern as timer duration buttons (toggle-style, `data-testid="pods-of-3-toggle"`)
- Pass `{ allowPodsOf3 }` to `generatePods()`
- Show warning in the toggle if n=5 (the one case where toggle doesn't help) — optional UX detail
- Unit test: toggle renders, state changes, `generatePods` receives correct options

**Why fourth:** UI depends on Step 1 algorithm being correct. The component test mocks `generatePods` so algorithm bugs don't surface here.

### Step 5: PodCard verification (depends on Step 4)

**Files:** `src/components/PodCard.tsx`, `src/components/PodCard.test.tsx`

- Add a unit test for a 3-player pod (3 players, seats 1/2/3)
- Confirm `getOrdinal` renders "1st", "2nd", "3rd" correctly
- Confirm sort works correctly
- If any display bug is found, fix it here; otherwise no source changes needed

**Why fifth:** Only verifiable after the full data flow is wired in Step 4.

### Step 6: E2E tests (depends on Steps 4–5)

**Files:** `cypress/e2e/`

- E2E: generate a round with pods-of-3 toggle ON for a 9-player or 13-player event
- Assert a 3-player pod card is visible
- Assert seat labels "1st", "2nd", "3rd" appear in the pod
- E2E: toggle OFF reverts to standard behavior (bye pod visible)
- Update visual regression baselines if pod card layout changes

**Why last:** E2E tests are the slowest layer and depend on all prior steps. They validate user-visible behavior, not algorithm correctness.

---

## Anti-Patterns

### Anti-Pattern 1: Adding allowPodsOf3 to the Database

**What people do:** Add an `allow_pods_of_3` column to `rounds` or create a per-round config table.

**Why it's wrong:** The toggle is an algorithm input, not a persistent record. Historical pods already carry their size in `pod_players` count — no stored flag is needed to display them. Adding a column means a new migration, RPC parameter change, and type update.

**Do this instead:** Keep `allowPodsOf3` as `useState` in `AdminControls`. It resets on page refresh, which is correct UX (admin decides per round, not per event).

### Anti-Pattern 2: Changing the useGenerateRound Hook or RPC Interface

**What people do:** Add `allowPodsOf3` as a parameter to `useGenerateRound` or to the `generate_round` RPC call.

**Why it's wrong:** The RPC receives already-computed pod assignments (`p_pod_assignments: JSONB`). It doesn't need to know how they were generated — it just writes them. The algorithm runs entirely client-side.

**Do this instead:** Keep `allowPodsOf3` inside `generatePods()`. Only the output (`PodAssignment[]`) crosses the boundary to the hook.

### Anti-Pattern 3: Hardcoding Pod Size of 4 in New Tests

**What people do:** Write new integration tests that assert `pod.players.length === 4` everywhere.

**Why it's wrong:** This will fail for pods-of-3 scenarios. The existing test pattern already uses `expectedByes = playerCount % 4` — new tests must handle variable sizes.

**Do this instead:** For `allowPodsOf3=true` tests, compute the expected pod sizes using `computePodSizes(n, true)` and assert against those values.

### Anti-Pattern 4: Using Math.random() Inside Sort for Shuffling

**What people do:** `players.sort(() => Math.random() - 0.5)` to shuffle.

**Why it's wrong:** Already documented in `pod-algorithm.ts` with a comment. Using random inside a sort comparator violates transitivity and produces biased orderings. The codebase already uses Fisher-Yates correctly via `shuffleArray()`.

**Do this instead:** Always use `shuffleArray()` for any randomization in the algorithm. Do not introduce new sort-with-random calls.

### Anti-Pattern 5: Making Seat Randomization "More Random" by Re-Shuffling

**What people do:** Add additional `shuffleArray()` calls across the pipeline, thinking more shuffles = more randomness.

**Why it's wrong:** The existing single `shuffleArray([1, 2, 3, 4])` per pod is already a perfect uniform random permutation. Adding more calls doesn't improve randomness and can introduce bugs if the wrong array is shuffled.

**Do this instead:** Trust the existing `shuffleArray()` call. If the seat randomization test (Step 3) reveals a bug, fix the specific call site — don't add more shuffles.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `AdminControls` → `pod-algorithm.ts` | Direct import, function call | Add `options` as third param; all call sites in `handleGenerateRound` only |
| `pod-algorithm.ts` → `useGenerateRound` | `PodAssignment[]` (unchanged shape) | Pods of 3: `is_bye: false`, 3 players, seats 1–3 — no interface change |
| `useGenerateRound` → Supabase RPC | JSONB payload | RPC iterates `jsonb_array_elements` — already handles any pod size |
| `RoundDisplay` → `PodCard` | `players[]`, `podNumber`, `isBye` props | No prop changes; `PodCard` works for any player count |
| `AdminControls.test.tsx` → component | React Testing Library | Mock `generatePods` at module level; assert it's called with `{ allowPodsOf3: true }` |

### External Boundaries

All external boundaries (Supabase, Realtime, PostgREST) remain unchanged.

---

## Sources

- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/lib/pod-algorithm.ts`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/components/AdminControls.tsx`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/components/PodCard.tsx`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/hooks/useGenerateRound.ts`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/supabase/migrations/00002_rounds_pods_admin.sql`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/lib/pod-algorithm.integration.test.ts`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/types/database.ts`
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/.planning/PROJECT.md`

---
*Architecture research for: Commander Pod Pairer v4.0 — Pod Algorithm Improvements*
*Researched: 2026-03-02*
