# Pitfalls Research

**Domain:** Pod algorithm improvements — reduce repeat opponents, seat randomization, pods of 3 toggle (v4.0 milestone)
**Researched:** 2026-03-02
**Confidence:** HIGH (pitfalls derived from direct codebase inspection + algorithm analysis + verified external patterns)

> Note: This document supersedes the original PITFALLS.md (v1-v3 pitfalls). That earlier document covered Supabase Realtime, RLS, timer drift, and iOS notifications — all of which are already solved in the shipped v3.0 codebase. This document focuses exclusively on pitfalls when ADDING algorithm improvements to the existing system.

---

## Critical Pitfalls

### Pitfall 1: Greedy Local-Optimum Trap Worsens Repeat Opponents at Small Player Counts

**What goes wrong:**
The current greedy algorithm fills pods one at a time: pick first player from shuffled pool, then greedily fill remaining 3 slots by lowest opponent-overlap score. This means the first pod gets first pick of low-overlap players. The pool shrinks. By the last pod, remaining players have higher pairwise overlap with each other than with already-placed players. The repeat-opponent burden systematically falls on the final pod each round — not because the algorithm fails, but because it succeeds locally at the cost of global quality.

Tightening the opponent-score penalty alone does not fix this. It shifts which pod absorbs the worst pairings, not whether the problem occurs. This is a structural property of greedy order-dependency.

**Why it happens:**
Greedy assignment is path-dependent. There is no look-ahead. Early pods consume "easy" players; late pods are forced to accept whatever remains. At 8-12 players over 3+ rounds, this produces one consistently worse pod regardless of how the scoring is tuned.

**How to avoid:**
Two approaches in order of complexity:

1. **Shuffle pod-fill order** — instead of always filling pod 1 → pod 2 → pod 3, shuffle the order each round. This distributes the bias across pods rather than eliminating it, but is a fast win.

2. **Post-greedy swap pass** — after initial greedy assignment, iterate over all pairs of players in different pods; swap any pair that reduces the total global repeat-opponent score. Accept swaps that improve global score. At n=20, O(n^2) is 400 comparisons — negligible. This is the correct fix for stricter repeat-opponent reduction.

The swap pass is the target state. Start with shuffle-fill-order if time is constrained; the swap pass should be implemented in the same milestone.

**Warning signs:**
- Integration tests show pod N (last filled) consistently has higher repeat counts than pod 1 across 10+ simulation runs
- After 4+ rounds with 8-12 players, one specific player pair appears together 3+ times while others appear 0-1 times
- The current integration test threshold `expect(maxPairCount).toBeLessThanOrEqual(3)` was set to accommodate this bias — if it is tightened to `<= 2` for the v4.0 milestone and that test fails, this pitfall has been activated

**Phase to address:**
Algorithm core phase. Changes only to `src/lib/pod-algorithm.ts` and its tests. Must be solved before any UI or DB changes — the algorithm is a pure function with no external dependencies.

---

### Pitfall 2: Pods of 3 Toggle Invalidates All Existing Four-Player Invariants

**What goes wrong:**
Adding pods-of-3 support is not a configuration flag — it requires auditing every hardcoded assumption about pod size. In the current codebase:

- `generatePods` hardcodes `numByes = activePlayers.length % 4`
- `generatePods` hardcodes `numPods = podPlayers.length / 4`
- The inner fill loop hardcodes `slot < 4` (fills exactly 4 slots)
- Seat generation: `shuffleArray([1, 2, 3, 4])` — produces seat 4 even for 3-player pods
- Integration tests assert `expect(pod.players).toHaveLength(4)` for all non-bye pods
- The `PodCard` `getOrdinal` function handles n=3 correctly ("3rd"), but `sortedPlayers` is never tested with only 3 elements

The danger: fix only `generatePods`, run tests, see green. Tests pass because test mocks return 4-player pods. The algorithm produces 3-player pods; the tests never exercise them.

**Why it happens:**
The number 4 is an implicit invariant baked into comments, variable names, magic numbers, and test assertions throughout the codebase. Each instance is locally obvious, but the full audit requires grepping the entire algorithm + test surface before writing any code.

**How to avoid:**
Before writing pods-of-3 code:
1. `grep -n '4\|\.length.*4\|< 4\|!= 4\|=== 4' src/lib/pod-algorithm.ts` — audit every literal `4`
2. Update integration tests to assert `pod.players.length >= 3 && pod.players.length <= 4` for non-bye pods when toggle is on
3. Change seat generation from `shuffleArray([1, 2, 3, 4])` to `shuffleArray(Array.from({ length: podSize }, (_, i) => i + 1))` where `podSize` is 3 or 4
4. Write a `PodCard` component test with exactly 3 players — verify no layout breakage, no seat badge showing "4th"

**Warning signs:**
- Any test that asserts `.toHaveLength(4)` for non-bye pods without a toggle-off qualifier
- Any pod_players row with `seat_number = 4` where the pod has only 3 players
- The existing warning check `if (numByes >= 3)` — this condition changes meaning when pods-of-3 eliminates byes

**Phase to address:**
Pods of 3 implementation phase. Requires coordinated changes to algorithm, tests, and UI in a single PR. Partial changes produce inconsistent states where some code paths assume 4 and others assume 3.

---

### Pitfall 3: Pod Partition Math Has Ambiguous Solutions Without a Defined Policy

**What goes wrong:**
For some player counts, multiple valid mixed-size arrangements exist:

| Players | One valid arrangement | Another valid arrangement |
|---------|-----------------------|--------------------------|
| 15 | 3×4 + 1×3 | 5×3 |
| 12 | 3×4 (no pods of 3 needed) | 4×3 |
| 7 | 1×4 + 1×3 | only this one |
| 11 | 1×4 + 2×3 | only this one |

Without a policy, the algorithm will produce different pod distributions depending on how the loop terminates. Different developers or future changes will produce equally valid but surprising results.

Additionally, the toggle changes which player counts require how many pods of 3. The function that computes pod sizes must be:
- Deterministic (same input always produces same distribution)
- Policy-documented ("minimize pods of 3 — maximize pods of 4")
- Tested exhaustively for all counts 4-20 in both toggle states

**Why it happens:**
The mathematical problem of partitioning N into 3s and 4s has multiple solutions for many values of N. Without making a policy choice explicit, the implementation choice is arbitrary and can change silently with refactoring.

**How to avoid:**
Extract a standalone pure function `computePodSizes(playerCount: number, allowPodsOf3: boolean): number[]` with documented policy: "find the minimum k >= 0 such that (playerCount - 3k) is divisible by 4 and (playerCount - 3k) >= 0."

This gives a unique, deterministic, minimized-pods-of-3 result for every valid N:
- k=0: `playerCount % 4 === 0` → all pods of 4
- k=1: `(playerCount - 3) % 4 === 0` → 1 pod of 3, rest are 4s
- k=2: `(playerCount - 6) % 4 === 0` → 2 pods of 3, rest are 4s
- k=3: `(playerCount - 9) % 4 === 0` → 3 pods of 3, rest are 4s

Unit-test this function for all counts 4-20 before wiring it into `generatePods`. Edge cases: N=3 is invalid, N=6 with toggle-on produces 2×3 (no byes — this is the win), N=7 with toggle-on produces 1×4 + 1×3.

**Warning signs:**
- The algorithm producing different pod distributions for the same player count across runs (beyond random assignment of which players go where)
- Test failures at player counts 11, 13, 14, 15 showing unexpected pod counts
- The partition logic inline in `generatePods` rather than in a dedicated testable function

**Phase to address:**
Pods of 3 implementation phase — implement `computePodSizes` first, test it exhaustively, then wire into `generatePods`.

---

### Pitfall 4: Seat Randomization May Already Be Implemented — Investigate Before Building

**What goes wrong:**
The v4.0 goal says "fix seat order — randomize so players aren't stuck in same seats across rounds." But the current algorithm already randomizes seats per round:

```typescript
const seatOrder = shuffleArray([1, 2, 3, 4])
assignments.push({
  pod_number: i + 1,
  is_bye: false,
  players: pods[i].map((playerId, idx) => ({
    player_id: playerId,
    seat_number: seatOrder[idx],  // randomized
  })),
})
```

`seatOrder` is shuffled inside each pod's build, so seat numbers differ between rounds. The existing integration test "seat assignments are randomized (not always 1,2,3,4 in same order)" already passes.

The actual complaint is likely one of two things:
1. **Same opponents** feel like "same seats" because you're always sitting next to the same people — the real problem is repeat opponents, not seat assignment
2. **First-player selection bias** — the greedy algorithm takes `pool[0]` as the first player of each pod after an initial shuffle. The same player can consistently end up in early pool positions (and thus get the same index and thus the same seat) if the shuffle produces similar orderings

**Why it happens:**
Players experience "I always sit next to the same person" as "I always get the same seat." These feel identical from a player's perspective but have different fixes. A developer might implement a second shuffle that has zero effect because the real problem is opponent repetition.

**How to avoid:**
Before coding: run an empirical simulation of 20 rounds with 8 players, track per-player seat frequency. Expected: each seat ~25% of the time (5/20 rounds). If any player gets a specific seat more than 8/20 rounds (40%), there is a real bias worth fixing. If distribution is roughly uniform, the seat "fix" is a no-op and the effort should go entirely into opponent reduction.

If bias exists: shuffle `pool` before selecting the first player for each pod (not just once at the start of all pod assignment). Currently `pool` is shuffled once before the pod-fill loop; pod 2's `pool[0]` is deterministic given that initial shuffle.

**Warning signs:**
- PR implements seat shuffling and the change to `pod-algorithm.ts` is a one-liner with no change to the core greedy loop — this is a sign the real problem was not diagnosed
- The integration test "seat assignments are randomized" still passes after the change (because it was already passing)
- Players continue reporting "same opponents" after the seat fix ships

**Phase to address:**
Algorithm investigation — before any implementation. Run simulation, measure seat frequency, decide empirically whether code changes are needed.

---

### Pitfall 5: generate_round RPC Will Accept Pods of 3 Without Migration — But Future Defensive Code Will Break It

**What goes wrong:**
The current `generate_round` RPC accepts `p_pod_assignments JSONB` without any pod-size validation. Pods of 3 will work on the server today without a migration. The risk is the opposite: if any future developer adds a "safety check" to the RPC function such as:

```sql
IF jsonb_array_length(v_pod->'players') != 4 THEN
  RAISE EXCEPTION 'Invalid pod size';
END IF;
```

...this silently breaks pods-of-3 in production even though unit tests pass (because unit tests mock the RPC call via `useGenerateRound`).

**Why it happens:**
RPC functions are changed in SQL migrations with no TypeScript type safety linking the migration to the calling code. A developer adding a "defensive" size check doesn't see the client-side feature that relies on flexible sizes. Unit tests don't catch it because they mock the RPC. Only E2E tests exercise the real RPC.

**How to avoid:**
1. Add a comment to the `generate_round` function documenting valid pod sizes explicitly:
   ```sql
   -- Pod players arrays may contain 3 or 4 players.
   -- Pods of 3 are valid when admin enables allow_pods_of_3 toggle.
   -- Do NOT add a strict pod-size = 4 validation here.
   ```
2. If adding server-side validation, use `BETWEEN 3 AND 4` not `= 4`
3. Add at least one Cypress E2E test that calls the real RPC with a 3-player pod (e.g., generate a round with 13 players and pods-of-3 enabled, verify the 3-player pod card appears)

**Warning signs:**
- Unit tests pass but the Cypress E2E test for pods-of-3 fails with a Supabase error message about invalid pod size
- A new migration appears that "strengthens" the RPC with a pod-size assertion

**Phase to address:**
Pods of 3 implementation phase. Add the comment to the migration; add the E2E test.

---

### Pitfall 6: The allRoundsPods Query Key Is Unstable Under Common React Patterns

**What goes wrong:**
`useAllRoundsPods` uses `queryKey: ['allRoundsPods', eventId, roundIds]` where `roundIds` is a `string[]`. Array references are compared by identity in React Query, not by value. If `AdminControls` computes `roundIds = rounds?.map(r => r.id) ?? []` directly in the render body (which it currently does), every render creates a new array reference. React Query sees a new key and re-fetches, even when the underlying round IDs haven't changed.

The current `staleTime: 30_000` mitigates the most obvious symptom (rapid re-fetches become no-ops due to staleness), but does not prevent query key churn. If the staleTime is ever reduced for freshness, the re-fetch storm becomes visible.

After adding the pods-of-3 toggle to `AdminControls`, the component will re-render on toggle state changes. Each toggle flicker triggers a new `roundIds` reference → new query key → potential re-fetch.

**Why it happens:**
JavaScript array equality is reference-based. `['r1', 'r2'] !== ['r1', 'r2']`. React Query uses deep equality for query keys by default in v5 (uses structural equality), so this may not actually be a live bug in v5. But if the project uses v4 or if the staleTime behavior changes, the issue emerges.

**How to avoid:**
Verify via React Query DevTools whether `useAllRoundsPods` actually re-fetches on every render. If it does: stabilize the `roundIds` reference with `useMemo`:

```typescript
const roundIds = useMemo(
  () => rounds?.map(r => r.id) ?? [],
  [rounds]
)
```

Do not add this unless the re-fetch is confirmed — premature memoization adds complexity for no benefit.

**Warning signs:**
- React Query DevTools showing `useAllRoundsPods` in "fetching" state on every `AdminControls` re-render
- Network tab showing repeated requests to `pods?round_id=in.(...)` on every component re-render
- Adding the pods-of-3 toggle causes visible latency before the generate button becomes active

**Phase to address:**
Pods of 3 UI phase — when `AdminControls` gains new state, profile for excessive re-renders before shipping.

---

### Pitfall 7: Mid-Event Player Rejoin Creates History Asymmetry That Confuses Improved Algorithm

**What goes wrong:**
When a player drops and is reactivated, they re-enter with their full history intact. This is correct. But a player who misses 2 rounds (dropped in round 2, rejoined in round 4) has sparse history — they appear as a "fresh" player to a stricter opponent-avoidance algorithm. The algorithm, seeing low opponent scores, prefers to pair this player with high-history players. But those high-history players may have built up significant history with each other in rounds 2-3, and the algorithm is blind to that from the rejoiner's perspective.

This is not a bug in the algorithm logic — it is a correct representation of actual history. The rejoiner genuinely did not play against those players in the missed rounds. But it can produce counterintuitive results: the rejoiner gets paired with their round-1 opponents immediately on rejoin, because the algorithm treats them as the lowest-overlap candidate.

**Why it happens:**
The stricter opponent-avoidance algorithm v4.0 aims to build will weight opponent scores more heavily. Empty history = low score = preferred candidate. The asymmetry between rounds-played and rounds-missed is structurally embedded in how `buildOpponentHistory` works.

**How to avoid:**
Accept this as a documented limitation. The fix (inferring transitively missed history) is over-engineered for a casual app. Document it in `pod-algorithm.ts`:

```typescript
// NOTE: Players who drop and rejoin will have sparse history for rounds they missed.
// This may cause them to be paired with previous opponents sooner than fresh players.
// This is accepted behavior — the alternative (inferring missed-round history)
// adds complexity not justified for casual play.
```

The admin UX note about reactivated players ("they will rejoin with their existing history") covers the user-facing expectation.

**Warning signs:**
- Test case where player A drops after round 1, rejoins in round 3, and gets paired with their round-1 opponents in round 3 — this is expected behavior, not a bug; do not "fix" it
- Integration test failures when simulating drop/rejoin scenarios with the stricter algorithm — distinguish between algorithm failure and expected history behavior

**Phase to address:**
Documentation only. No code change. Add the comment to `pod-algorithm.ts` when the stricter algorithm is implemented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep bye path (`numByes = n % 4`) and pods-of-3 path as separate branches in `generatePods` | Clear separation of behavior | Two partition code paths can diverge in bugs | Acceptable — explicit branching is better than complex unification |
| Pass `allowPodsOf3` as a simple boolean parameter | Simple API | If more toggles appear, becomes unwieldy | Acceptable until ≥3 toggles exist |
| Skip swap-pass optimization; only fix fill-order shuffle | Faster to ship | Greedy local-optimum remains; repeat opponents still occur at small counts | Acceptable only if mutation score confirms the fix is still real improvement; document the gap |
| Keep `computePodSizes` inline in `generatePods` rather than extracting it | Less code | Harder to unit-test the partition math independently | Never — always extract; testability is critical for this logic |
| Rely on `staleTime: 30_000` to mask query key instability | Works now | Any freshness requirement change exposes re-fetch storm | Only if React Query DevTools confirms no actual re-fetches today |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `useAllRoundsPods` + `buildRoundHistoryFromData` | Removing the `if (!rounds \|\| !allPods) return` guard when refactoring `AdminControls` for the toggle | The guard is load-order dependent — `allPods` is undefined during initial fetch. Its removal causes `generatePods` to run with empty history (treating every round as round 1). |
| Supabase `generate_round` parameter naming | Adding a `p_allow_pods_of_3 BOOLEAN` parameter to the RPC without updating the TypeScript call in `useGenerateRound` | Copy parameter names verbatim from the migration SQL into the TypeScript RPC call. The Supabase client uses exact parameter name matching. |
| `AdminControls` toggle state | Storing the pods-of-3 toggle in `EventPage` to share with other components, then threading it back down as a prop | Keep toggle state in `AdminControls` — it is the natural owner; no other component needs it. If it needs to persist across rounds, use `sessionStorage` keyed by `eventId`. |
| Stryker with `Math.random()` in algorithm | Writing new algorithm tests without seeding `Math.random()`, causing flaky mutant results | Use the existing `seedRandom(seed)` helper from `pod-algorithm.test.ts` for all new tests that need deterministic shuffle behavior. |
| PodCard with 3-player pod | Not rendering a 3-player PodCard in any test, so UI breakage in the `sortedPlayers.sort()` or seat badge render is undetected | Add a Vitest component test for `PodCard` with exactly 3 players; verify `[1st, 2nd, 3rd]` seat badges render and no 4th appears. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Swap-pass O(n^2) implementation | Slow round generation | At n=20, O(n^2)=400 comparisons, ~0.1ms. Never a problem at this scale. Do not optimize prematurely. | Never at n≤20. |
| Re-fetching all pods on every toggle change | Network requests on every UI interaction | Profile with React Query DevTools before optimizing. Current staleTime mitigates this. | Not a problem until staleTime is reduced. |
| `buildOpponentHistory` iterating all rounds | Slow history build at many rounds | At 10 rounds × 5 pods × 6 pairs = 300 iterations. Negligible. | Not a problem until 100+ rounds (unrealistic for casual play). |
| `pool.filter()` called on every candidate removal | Quadratic pool shrink | At n=20, 20 filter calls of O(n) each = 400 operations. Negligible. Switch to Set if this ever becomes visible in profiling. | Never at n≤20. |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding a `p_allow_pods_of_3` RPC parameter without passphrase validation | Any user could toggle pods-of-3 behavior without being admin | If the toggle is client-side only (passed as part of pod assignments), no new RPC parameter is needed. If stored server-side as event config, it must be gated by the existing passphrase check pattern. |
| No server-side pod-size validation in the RPC | Malicious client sends pods with 0 or 100 players | Add `IF jsonb_array_length(v_pod->'players') NOT BETWEEN 3 AND 4 THEN RAISE EXCEPTION` to `generate_round` migration once pods-of-3 is implemented. |
| No uniqueness constraint on `pod_players(player_id)` per round | A client bug or race condition sends the same player in two pods | Existing code has no unique constraint on `pod_players` at the pod or round level. Latent gap regardless of this milestone — consider adding `UNIQUE(pod_id, player_id)` at minimum. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Toggle is per-round but label says "allow pods of 3" without time context | Admin assumes it's a permanent setting; next round has no toggle active | Label: "This round: allow pods of 3" and reset to off after `onSuccess` — the toggle applies to the next round being generated, not all future rounds |
| 3-player pod shows seats "1st, 2nd, 3rd" with no explanation | Players expect 4 seats; missing 4th looks like a display bug | Add "(3-player pod)" subtitle on the PodCard when `players.length === 3`, matching the visual treatment of the "Sitting Out" bye pod |
| Generating with 13 players and pods-of-3 OFF shows 3×4 + 1 bye | Admin may not realize they could eliminate the bye | Show a contextual hint: "Enable pods of 3 to eliminate 1 bye (13 players → 1×4 + 3×3)" |
| Current warning toast: "High bye count: 3 of 13 players sitting out" fires when toggle is off | Confusing — admin knows about the bye, they just chose not to toggle | Suppress the high-bye-count warning if `allowPodsOf3` is `false` and the bye count is only because the toggle is off; only warn if enabling pods-of-3 is not an option (e.g., fewer than 7 players total) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Pods of 3 seat numbers:** Verify no `seat_number: 4` appears in a 3-player pod's database row — a `shuffleArray([1,2,3,4])` call in the 3-player path produces invalid seat 4
- [ ] **Seat randomization diagnosis:** Run empirical per-player seat frequency simulation (20 rounds × 8 players) and confirm distribution is roughly uniform before concluding the seat "fix" is needed or complete
- [ ] **Repeat opponent reduction:** Run integration test with tighter threshold (`maxPairCount <= 2`) for 8 players / 4 rounds — this validates the improvement over v3.0 is real and not just noise
- [ ] **Toggle state reset:** Confirm the pods-of-3 toggle resets to off after `onSuccess` in `AdminControls` — check the `setIsGenerating(false)` path vs the `setSelectedDuration(null)` pattern already used for the timer
- [ ] **Stryker score maintained:** Run Stryker after algorithm changes — the project requires 80% threshold on PRs; algorithm code is high-mutant-density and any new branch (allowPodsOf3) doubles the mutation surface
- [ ] **computePodSizes exhaustive tests:** Unit-test for all player counts 4-20 in both toggle states — 34 test cases minimum before wiring the function into `generatePods`
- [ ] **PodCard with 3 players:** Component test renders a PodCard with 3 players — verify "1st/2nd/3rd" badge rendering, no "4th" badge, no layout overflow
- [ ] **E2E test for pods-of-3:** At least one Cypress test generates a round with pods-of-3 enabled and verifies the 3-player pod card appears in the UI
- [ ] **RPC comment added:** The `generate_round` migration has an explicit comment documenting that pod sizes 3 and 4 are both valid

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shipped greedy order bias; repeat opponents still poor | LOW | Algorithm is a pure function with no DB dependency. Fix `pod-algorithm.ts`, update tests, ship as patch. No migration needed. |
| Shipped `seat_number: 4` in a 3-player pod row | MEDIUM | Write a migration to set `seat_number = NULL` for pod_players where the pod has 3 players and seat_number = 4. Fix the algorithm. Re-test. |
| Future migration adds pod-size-4 validation to `generate_round` RPC | LOW | Write a migration updating the check from `= 4` to `BETWEEN 3 AND 4`. Test locally with Supabase CLI. The fix is a one-line migration. |
| Toggle state persists when it should reset | LOW | State lives in `AdminControls` React component — no DB change. Fix `onSuccess` handler and redeploy. |
| Stryker score drops below 80% after algorithm changes | MEDIUM (blocks merge) | Cannot merge PR. Identify surviving mutants via Stryker HTML report. Add targeted test cases for each surviving boundary condition. Typical fix: 2-4 additional assertion lines per surviving mutant in the partition math or score comparison logic. |
| `allRoundsPods` query re-fetches on every render after toggle added | LOW | Add `useMemo` to stabilize `roundIds` in `AdminControls`. Verify with React Query DevTools. Five-minute fix. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Greedy local-optimum trap | Phase 1: Algorithm core (repeat opponent reduction) | Integration test with `maxPairCount <= 2` for 8 players / 4 rounds passes |
| Pods of 3 invalidates 4-player invariants | Phase 2: Pods of 3 algorithm | All hardcoded `4` literals audited; integration tests use `players.length >= 3 && <= 4` |
| Pod partition math ambiguity | Phase 2: Pods of 3 algorithm | `computePodSizes` unit tests cover all 4-20 in both toggle states (34 cases) |
| Seat randomization may already work | Phase 1: Investigation | Empirical seat-frequency test run before any seat code is written |
| RPC accepts pods of 3 but may get defensive check added | Phase 2: Pods of 3 RPC/migration | Comment added to migration; E2E test exercises real RPC with 3-player pod |
| allRoundsPods query key instability | Phase 3: AdminControls UI | React Query DevTools check after adding toggle state — no re-fetches on toggle |
| Mid-event player history asymmetry | No code fix — documentation | Comment added to `pod-algorithm.ts` when stricter algorithm is implemented |
| Stryker score regression | Every phase | CI Stryker gate at 80% — must pass before merge on every PR |

---

## Sources

- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/lib/pod-algorithm.ts` — greedy structure, hardcoded `4` literals, `shuffleArray([1,2,3,4])` placement, pool fill order
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/lib/pod-algorithm.integration.test.ts` — existing thresholds (`maxPairCount <= 3`), bye fairness assertions, seat randomization test
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/components/AdminControls.tsx` — opponent history build pattern, `allPods` guard, `roundIds` derivation
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/components/PodCard.tsx` — `getOrdinal` function, 4-player assumptions in seat sorting
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/supabase/migrations/00002_rounds_pods_admin.sql` — RPC accepts JSONB with no pod-size validation
- Direct inspection of `/Users/jacobstoragepug/Desktop/PodForge/src/hooks/useAllRoundsPods.ts` — query key structure with `roundIds` array, `staleTime: 30_000`
- Multiplayer Addendum to MTR — mixed pod size rules (minimize pods of 3 = maximize pods of 4), repeat opponent policy: https://juizes-mtg-portugal.github.io/multiplayer-addendum-mtr
- TanStack Query invalidation race conditions and query key stability: https://github.com/TanStack/query/discussions/6953
- Supabase RPC schema-change-breaks-client pitfall: https://github.com/supabase/supabase/issues/20123
- Stryker mutation testing pitfalls for pure function coverage: https://dev.to/wintrover/the-pitfalls-of-test-coverage-introducing-mutation-testing-with-stryker-and-cosmic-ray-1kcg

---

*Pitfalls research for: Pod algorithm improvements — repeat opponents, seat randomization, pods of 3 toggle (v4.0)*
*Researched: 2026-03-02*
