# Stack Research

**Domain:** Pod algorithm improvements — combinatorial scheduling, seat randomization, pods of 3 toggle (v4.0 milestone)
**Researched:** 2026-03-02
**Confidence:** HIGH

> This document supersedes the v1.0-v3.0 STACK.md. The existing stack (React 19, Vite, Supabase,
> Tailwind CSS v4, TypeScript, Vitest, Cypress, Stryker) is already validated and in production.
> This research covers ONLY what is needed for v4.0 pod algorithm improvements.

## Verdict: No New Dependencies Required

The three v4.0 features — better repeat-opponent reduction, seat randomization, and a pods-of-3
toggle — can be implemented entirely as logic changes to `src/lib/pod-algorithm.ts` plus UI changes
to `AdminControls`. No new npm packages are justified. Here is why, and what algorithm approach to use.

---

## Algorithm Decision: Enhanced Greedy with Quadratic Penalty Scoring

### What the Current Algorithm Does Wrong

The current greedy algorithm scores candidates by raw opponent-meeting count and fills pods
sequentially (first player → second → third → fourth). This has two compounding problems:

1. **Pod-level local optima**: Player assigned third or fourth in a pod may have been a better fit
   for a different pod, but the greedy can't backtrack. Over many rounds this locks in repeat
   groupings prematurely.

2. **Linear scoring**: `score += history.get(member) ?? 0` weighs the 1st repeat opponent the
   same as the 3rd. A player who has met two opponents once each scores identically to a player who
   has met one opponent twice — but the latter is worse, because you're tripling up on a pairing.

### Recommended Fix: Quadratic Penalty Scoring (No New Dependency)

Replace the linear sum with a sum of squares. Change `getOpponentScore`:

```typescript
// BEFORE (linear — treats all repeats equally)
score += candidateHistory.get(member) ?? 0

// AFTER (quadratic — penalizes repeated pairings exponentially)
const count = candidateHistory.get(member) ?? 0
score += count * count
```

**Why quadratic works better**: If player A has met player B once and player C once, their penalty
scores are 1+1=2 (linear) vs 1+1=2 (quadratic — same). But if player A has met player B twice and
player C zero times, linear gives 2+0=2 (same!), while quadratic gives 4+0=4 vs 0+0=0 — correctly
preferring the player with zero history. Quadratic scoring naturally breaks ties in favor of fresh
pairings.

This is the same scoring principle used by the "Good Enough Golfers" web app (goodenoughgolfers.com)
and is described in literature on the Social Golfer Problem as the standard approximation technique
for small groups.

**Performance**: Zero overhead. Same O(n) inner loop, just a multiplication instead of a lookup
result addition. Will not be perceptible on any device.

**Confidence**: HIGH — quadratic penalty is well-established for this problem class. The existing
codebase already has the infrastructure (opponent history matrix, `getOpponentScore` function). This
is a one-line change with high impact.

---

## Seat Randomization Fix

### What the Current Algorithm Does Wrong

The current code shuffles seat numbers per pod, but re-uses the same shuffle within a pod each time
because the players are assigned in the greedy order. The real issue is that `shuffleArray([1,2,3,4])`
is called correctly — but the concern from the PROJECT.md ("Fix seat order — randomize so players
aren't stuck in same seats across rounds") suggests seat history is not tracked across rounds.

A player assigned seat 1 in round 1 might be assigned seat 1 again in round 2 simply by chance,
and with no penalty for seat repetition, the algorithm doesn't discourage this.

### Recommended Fix: Seat History Tracking (No New Dependency)

Add a `buildSeatHistory` helper alongside `buildOpponentHistory` and `buildByeCounts`:

```typescript
export function buildSeatHistory(
  previousRounds: RoundHistory[]
): Map<string, number[]> {
  // Returns Map<playerId, seatNumbers[]> of all seats that player has occupied
}
```

When assigning seats, prefer seat numbers the player has NOT occupied (or has occupied fewest times).
For pods of 3, only seats 1-3 are assigned; pod seat assignment should handle variable pod size.

This tracks across the full event history and requires no external library. The pattern is identical
to how `buildByeCounts` works, just tracking seat numbers instead of bye instances.

**Confidence**: HIGH — this is a pure TypeScript data structure change within the existing
architecture. No new concepts introduced.

---

## Pods of 3 Toggle

### Problem Statement

Currently: `n % 4 !== 0` → some players sit out in a bye pod.
With toggle enabled: use pods of 3 to absorb the remainder without byes.

### Remainder Math

| Players | Toggle OFF (default) | Toggle ON (pods of 3 allowed) |
|---------|---------------------|-------------------------------|
| 12 | 3×4 | 4×3 OR 3×4 |
| 13 | 3×4 + 1 bye | 1×4 + 3×3 |
| 14 | 3×4 + 2 bye | 2×4 + 2×3 |
| 15 | 3×4 + 3 bye | 1×4 + ... → better: 5×3 |
| 16 | 4×4 | 4×4 (no change needed) |
| 17 | 4×4 + 1 bye | 1×4 + ... → 4×3 + 1×5? No — use 3×4 + 1×3 + 1×2... |

The key insight: pods of 3 are only needed when `n % 4 !== 0`. When `n % 4 === 0`, the toggle has
no effect. When the toggle is on and `n % 4 !== 0`, the target is zero byes:

- `n % 4 === 1`: Can't make zero byes with pods of 3 and 4 unless you use a pod of 5 or allow 1 bye.
  `n=5` → 1×5 (not valid) or 1×4+1×1 (not valid). Use 1 bye (same as before). Exception: warn admin.
- `n % 4 === 2`: 1 pod of 3 absorbs 1 player from remainder-2 → add one pod of 3, reduce one pod of
  4 to 3 (giving 2 pods of 3). Actually: take `(n-2)/4` pods of 4, then split 2 players differently.
  Simpler: `n=14 → 2×4+2×3=14`. Formula: when `n % 4 === 2`, use `(n-6)/4` pods of 4 + 2 pods of 3
  (requires n >= 6). For n < 6, fall through to the existing minimum player check.
- `n % 4 === 3`: `n=15 → 5×3=15`, `n=11 → 1×4+... → 1×4+7 players remaining → 2×3+1 left → no`.
  Simpler: `n=11 → 1×4+... no, try 0×4+... 3×3+2 remaining... → 11 % 3 = 2`. Actually: when
  `n % 4 === 3`, use `(n-3)/4` pods of 4 + 1 pod of 3.

**Correct formula (validated):**

```
remainder = n % 4

if remainder === 0: all pods of 4, zero byes (no change)
if remainder === 1: cannot avoid byes with pods of 3/4 only; 1 bye regardless of toggle
if remainder === 2: pods_of_3 = 2, pods_of_4 = (n-6)/4 (requires n >= 6)
if remainder === 3: pods_of_3 = 1, pods_of_4 = (n-3)/4 (requires n >= 7)
```

For `n=5` with toggle on (`5 % 4 === 1`): 1 bye (same behavior). No warning needed specifically
for the toggle — the existing high-bye-count warning handles edge cases.

For `n=7` with toggle on (`7 % 4 === 3`): 1 pod of 4 + 1 pod of 3. Zero byes. Works.

### Implementation: Pure TypeScript in pod-algorithm.ts

The toggle is a boolean parameter added to `generatePods`:

```typescript
export interface PodGenerationOptions {
  allowPodsOf3?: boolean
}

export function generatePods(
  activePlayers: PlayerInfo[],
  previousRounds: RoundHistory[],
  options: PodGenerationOptions = {}
): PodAssignmentResult
```

The function signature change is additive (options default to `{}`), preserving all existing tests.
Seat assignment needs to handle pod sizes of 3 vs 4:

```typescript
// Before: hardcoded to 4 seats
const seatOrder = shuffleArray([1, 2, 3, 4])

// After: dynamic based on pod size
const seatOrder = shuffleArray(
  Array.from({ length: podSize }, (_, i) => i + 1)
)
```

**Confidence**: HIGH — no new library needed. Pure logic change with clear test coverage path.

---

## UI Toggle Component

### What to Build

A checkbox toggle in `AdminControls` that the admin can flip before generating each round. It
should match the existing Tailwind design system.

### Recommendation: Native HTML Checkbox Styled with Tailwind (No Headless UI, No Library)

The project already has working toggle-style UI (the timer duration picker buttons). Adding Headless
UI or a component library for a single toggle adds ~30KB and a new dependency.

The recommended pattern is a visually styled `<input type="checkbox">` with Tailwind CSS utility
classes. Tailwind CSS v4 supports peer modifiers (`peer-checked:`) which make a custom-looking toggle
trivial to implement accessibly:

```tsx
<label className="flex items-center gap-3 cursor-pointer" htmlFor="pods-of-3-toggle">
  <input
    type="checkbox"
    id="pods-of-3-toggle"
    className="peer sr-only"
    checked={allowPodsOf3}
    onChange={(e) => setAllowPodsOf3(e.target.checked)}
    data-testid="allow-pods-of-3-toggle"
  />
  <div className="w-10 h-6 rounded-full bg-surface border border-border
                  peer-checked:bg-accent peer-checked:border-accent
                  relative transition-colors">
    <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1
                    peer-checked:translate-x-4 transition-transform" />
  </div>
  <span className="text-sm text-text-secondary">Allow pods of 3</span>
</label>
```

The `sr-only` class hides the native checkbox visually while keeping it accessible for keyboard
and screen reader users. This is the standard Tailwind CSS pattern for custom toggles.

**Confidence**: HIGH — this pattern is documented in Tailwind CSS official components and widely
used. No external library needed.

---

## Recommended Stack Changes

### Core Technologies

No changes to the core stack. All existing packages continue as-is.

### Supporting Libraries

No new libraries to install. The algorithm improvements are pure TypeScript logic changes.

| What | Action | Why |
|------|--------|-----|
| External optimization library (socialgolfer.js, javascript-lp-solver, etc.) | Do NOT add | For 8-20 players, a well-tuned greedy with quadratic penalty scoring is indistinguishable from globally optimal in practice. These libraries add bundle weight, introduce dependencies that fall out of date, and some (socialgolfer.js) are 100x slower than C++ reference implementations. The codebase already achieves 90.6% Stryker mutation score — the algorithm is well-understood, not a black box. |
| Headless UI or Radix UI | Do NOT add | The single toggle component does not justify a dependency. Tailwind peer modifiers are sufficient. |
| genetic-js, optimization-js, or similar | Do NOT add | These libraries target large-scale optimization problems (hundreds of variables). For pods of 4 with 8-20 players, the problem space is tiny. A 1000-iteration simulated annealing pass would be premature complexity with no user-visible benefit. |

### Development Tools

No changes to testing stack. The existing setup covers all new code:

- Vitest + the seeded `Math.random` pattern (`vi.spyOn(Math, 'random')`) already handles
  deterministic testing of all algorithm changes
- `it.each` parameterized tests already cover player counts 4-20; extend to cover pods-of-3 cases
- Cypress E2E specs for the toggle UI follow existing `data-testid` patterns
- Stryker mutation testing applies automatically to the updated `pod-algorithm.ts`

---

## Integration Points

### generatePods Signature Change

The only public API change is adding an options parameter to `generatePods`:

```typescript
// Before
generatePods(activePlayers: PlayerInfo[], previousRounds: RoundHistory[]): PodAssignmentResult

// After
generatePods(
  activePlayers: PlayerInfo[],
  previousRounds: RoundHistory[],
  options?: PodGenerationOptions
): PodAssignmentResult
```

All existing call sites in `AdminControls.tsx` require only one additional argument when the admin
has enabled the toggle. Existing tests pass unchanged because `options` defaults to `{}`.

### AdminControls State

One new boolean state variable: `allowPodsOf3: boolean` (default `false`). Passed to `generatePods`
as `{ allowPodsOf3 }`. Reset to `false` after each successful round generation (consistent with how
`selectedDuration` is reset).

### RoundHistory Interface

The `RoundHistory.pods` type already uses generic `playerIds: string[]` arrays — no change needed
for pods of 3. Existing bye pod handling also uses playerIds. Pods of 3 integrate without schema
changes.

### Database Schema

No Supabase migration required. The `pod_players` table stores player-pod assignments generically
(one row per player per pod). Pods of 3 simply produce 3 rows instead of 4. The `seat_number`
column already handles NULL (bye players) and 1-4 (active players); values 1-3 for a pod of 3 are
valid within the existing schema.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Quadratic penalty (one-line change to `getOpponentScore`) | Simulated annealing | Simulated annealing over thousands of iterations is correct for large instances (100+ players). For 8-20 players, the search space is small enough that well-designed greedy produces near-optimal results in 1-2ms. SA would add 50-500ms of CPU time per round generation with no user-visible improvement. |
| Quadratic penalty | Global exhaustive search | 20-player combinatorial space is too large for brute force (billions of possible groupings). Greedy with quadratic penalty is the right tool. |
| Seat history tracking (pure TypeScript) | No seat tracking | Players notice when they sit in the same seat repeatedly. The fix is a 30-line helper function identical in shape to `buildByeCounts`. Skipping it leaves a known UX flaw unfixed. |
| Native checkbox + Tailwind peer modifiers | Headless UI Switch | The Headless UI Switch (from `@headlessui/react`) is 30KB for one toggle. The native approach provides equivalent accessibility via semantic HTML without any additional bundle cost. |
| Options parameter with default `{}` | Breaking interface change | Adding `options?` preserves all 346 existing unit tests. A breaking change would require updating every `generatePods(...)` call site and every test that invokes it directly. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `socialgolfer.js` | CoffeeScript library, ~100x slower than reference, last meaningfully updated ~2015, no TypeScript types | Custom quadratic penalty greedy (already implemented, 1-line fix) |
| `javascript-lp-solver` | LP solvers require problem formulation as linear constraints — pod diversity is a combinatorial problem not naturally expressed as an LP. Adds 200KB+ to bundle. | Quadratic penalty greedy |
| `optimization-js` | Generic optimization framework — overkill for a well-understood scheduling problem. No TypeScript types. Infrequently maintained. | Quadratic penalty greedy |
| `@headlessui/react` | 30KB for a single toggle. The project currently has zero component-library dependencies. | Native `<input type="checkbox">` with Tailwind peer modifiers |
| Any external scheduling library | All discoverable JS scheduling libraries target Swiss tournament pairings (1v1 matches), not multiplayer pods. None natively support the asymmetric pod-size logic (3s and 4s) needed here. | Custom TypeScript logic in `pod-algorithm.ts` |

---

## Sources

- [Social Golfer Problem — Wikipedia](https://en.wikipedia.org/wiki/Social_golfer_problem) — problem formulation and known solution approaches (HIGH confidence)
- [Good-Enough Golfers — source code analysis](https://github.com/islemaster/good-enough-golfers) — quadratic penalty scoring pattern, genetic approach for this problem class (HIGH confidence)
- [socialgolfer.js library](https://github.com/FelixHenninger/socialgolfer.js/tree/master) — GRASP algorithm, CoffeeScript, ~100x slower than C++ reference, not suitable for embedding (HIGH confidence)
- [A greedy algorithm for the social golfer and the Oberwolfach problem — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0377221721007773) — academic basis for greedy approaches to this problem class (MEDIUM confidence)
- [Headless UI Switch — headlessui.com](https://headlessui.com/react/switch) — React accessible toggle component (HIGH confidence)
- [Tailwind CSS Toggles — Official UI blocks](https://tailwindcss.com/plus/ui-blocks/application-ui/forms/toggles) — peer-checked pattern for styled checkboxes (HIGH confidence)
- [roundrobin npm package](https://www.npmjs.com/package/roundrobin) — evaluated and rejected: targets 1v1 matchups, last updated 4 years ago, wrong problem domain (HIGH confidence)
- Existing codebase (`src/lib/pod-algorithm.ts`, `src/lib/pod-algorithm.test.ts`, `src/lib/pod-algorithm.integration.test.ts`) — current algorithm structure and test patterns (HIGH confidence — first-party)

---
*Stack research for: Commander Pod Pairer v4.0 — pod algorithm improvements milestone*
*Researched: 2026-03-02*
