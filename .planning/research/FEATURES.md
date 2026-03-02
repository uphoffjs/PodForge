# Feature Research

**Domain:** Casual MTG Commander event pod-pairing web app — v4.0 Pod Algorithm Improvements
**Researched:** 2026-03-02
**Confidence:** HIGH (algorithm theory), MEDIUM (UX patterns for toggles)

---

## Context: Subsequent Milestone

This file covers only the **new features** for v4.0. The original FEATURES.md (2026-02-20) covered the full v1-v3 feature landscape. This update narrows to three specific improvements being added to an already-shipped app:

1. Reduce repeat opponents (stricter algorithm diversity)
2. Fix seat randomization (avoid same seat across rounds)
3. Per-round admin toggle for pods of 3

Existing system: greedy opponent-avoidance with history matrix, bye rotation, Fisher-Yates seat shuffle per pod, 100% mutation score on algorithm tests.

---

## Background: What the Existing Algorithm Does

The current `generatePods` in `src/lib/pod-algorithm.ts`:
- Shuffles players randomly (Fisher-Yates) for initial pool ordering
- Fills pods greedily: first player picked randomly, seats 2-4 pick the candidate with the lowest cumulative prior-opponent score against current pod members
- Score = sum of how many times each pair has met in prior non-bye pods (linear count)
- Seat assignment: shuffles [1,2,3,4] with Fisher-Yates, assigns to pod members by index
- Pod size: always 4; remainder players go to bye pod
- Minimum 4 players enforced (throws otherwise)

Known limitation from PROJECT.md: "reduce repeat opponents — stricter pairing diversity across rounds" and "fix seat order — randomize so players aren't stuck in same seats across rounds." The greedy approach achieves 90.6% Stryker mutation score and is "good enough for <20 players" per key decisions, but produces suboptimal diversity when the pool is small (e.g., 8 players, 4+ rounds).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the admin/players will consider non-negotiable for the improved algorithm.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **No repeated pod group** | With 8 players and 2+ rounds, the greedy algo can repeat the exact same 4-player group if it happens to be locally optimal each time. Users expect "you shouldn't play the same people twice." | MEDIUM | Squared-penalty scoring (cost = encounters²) discourages second meetings exponentially more than linear scoring. Proven pattern from Good-Enough Golfers tool and tournament literature. |
| **No player stuck in same seat every round** | Seat 1 (first player, biggest political disadvantage in Commander) should rotate. With the current implementation, a player could draw seat 1 two rounds in a row. Players notice and complain. | LOW | Seat history tracking per player. When assigning seats, prefer seats not recently assigned. Seat history stored in `RoundHistory` or computed from previous assignments. |
| **Pods of 3 as an alternative to byes** | 13 players currently produces 3×4 + 1×bye-pod (1 person sits out). With toggle enabled: 1×4 + 3×3 (all 13 play). Users expect this option exists once they know it's possible. | MEDIUM | Requires new partition logic: determine how many pods of 3 vs 4 to form. For n players: maximize pods of 4 first, use pods of 3 to absorb remainder without byes. |
| **Toggle is per-round, not event-wide** | If round 1 had 12 players (clean 3×4), and a 13th joins for round 2, the admin needs to decide round-by-round. An event-wide setting gets this wrong. | LOW | Checkbox/toggle in AdminControls, applied only when the admin clicks "Generate Next Round." Does not persist across rounds. |
| **Algorithm warnings still shown** | Existing behavior: algorithm returns warnings array surfaced via `toast.warning`. The improved algorithm should still warn on edge cases (e.g., "No new opponent combinations possible — some repeats required."). | LOW | Keep existing warning surface. Add new warning when perfect diversity is impossible (small group, many rounds). |
| **Pods of 3 visually distinct** | Bye pods already use a visually distinct card. A 3-player pod is not a bye — it's an active game. But the UI needs to make clear it's a 3-player game (no seat 4). | LOW | 3-player pods show seats 1-3 only. Pod card adapts to `players.length`. PodCard component already maps by seat_number, so null seat_4 is handled. |

### Differentiators (Competitive Advantage)

Features that meaningfully improve over existing casual pod tools and the current algorithm.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Squared-penalty scoring for repeat opponents** | Current linear scoring: playing A twice costs 2. Squared: playing A twice costs 4, playing A three times costs 9. Exponential discouragement of repeat pairings makes the algorithm strongly prefer any new opponent over a repeated one, even if the "new" option involves two players who've met once before. Proven pattern from Good-Enough Golfers (goodenoughgolfers.com). | LOW | Change `getOpponentScore` to square the encounter count: `score += (count * count)`. One-line change. Test impact on 8-16 player scenarios across 4+ rounds. |
| **Seat history tracking with avoidance** | No existing casual tool tracks seat position history. Players in Commander care deeply about turn order (seat 1 = last player in round 1 of each round). Providing cross-round seat rotation is a concrete fairness improvement competitors don't offer. | MEDIUM | Track which seat each player had in each previous round. When shuffling seats for a new pod, sort candidates so players who haven't had seat 1 recently are preferred. Or: assign seat 1 to player with fewest prior seat-1 assignments. Store seat history as part of RoundHistory or derive from existing pod_players data. |
| **Pods-of-3 toggle eliminates unnecessary byes** | Current: 13 players = 1 person sits out every round. With toggle: everyone plays. For small casual groups, sitting out is frustrating. No casual Commander tool offers this — TopDeck supports it but it's buried in competitive tournament settings and requires accounts. | MEDIUM | Mixed partition algorithm: given n players with allow3PlayerPods=true, determine optimal mix. For n % 4 == 1: one pod of 3 + (n-3)/4 pods of 4 is impossible since (n-3) must be divisible by 4. Correct formula: solve 3a + 4b = n to minimize a (pods of 3). For n=13: a=1, b=2.5 — doesn't work cleanly. Actual: a=3, b=1 (3+3+3+4=13). See partition notes below. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Globally optimal algorithm (exact solver)** | "Why not just find the best pairing?" | The Social Golfer Problem is NP-hard in general. For 16 players in groups of 4, exact solvers require constraint programming (Prolog/Z3) or ILP — not appropriate for a browser-side TypeScript function generating results in <10ms. The greedy approach with squared penalties achieves near-optimal results for the n<20 player counts this app targets. | Squared-penalty greedy. Good-Enough Golfers (the most widely used casual group pairing tool) uses the same approach and is empirically well-regarded. |
| **Genetic algorithm / simulated annealing** | "Use ML/AI to find better pairings" | Multiple-iteration stochastic search is computationally expensive, non-deterministic in ways that complicate testing, and over-engineered for 8-16 players. A greedy algorithm with squared penalties finds near-optimal solutions for small n without any of this complexity. | Keep greedy, improve scoring function. |
| **Event-wide "always use pods of 3" setting** | "Set it once, forget it" | Player count changes round to round as players join/drop. An event-wide setting silently applies the wrong behavior when count changes make byes unnecessary or change the optimal partition. | Per-round toggle, shown only when pods of 3 would actually eliminate a bye (i.e., when n % 4 != 0). Hide the toggle when n % 4 == 0 (byes aren't needed anyway). |
| **Seat 1 can never repeat for same player in consecutive rounds** | "Hard constraint: never same seat back to back" | Hard constraints make the problem significantly harder to solve and can make it unsolvable for small groups (e.g., 4 players, 5+ rounds — someone must repeat seat 1 since there are only 4 seats). | Soft preference: penalize/avoid same-seat repetition when alternatives exist, but don't enforce it as a hard constraint that can block pod generation. |
| **Show "fairness score" to players** | "Display how well opponents were distributed" | Adds UI complexity players don't need. Players just want to know who they're playing with. Admins don't need a score to trust the algorithm is fair. | Algorithm produces results silently. Warnings surface edge cases (e.g., "some players will face a repeat opponent this round"). |

---

## Feature Dependencies

```
[Squared-Penalty Scoring]
    -- modifies --> [getOpponentScore function]
    -- requires --> [Existing opponent history matrix] (already built)
    -- no new DB schema needed

[Seat History Tracking]
    -- derives from --> [existing pod_players.seat_number + round data]
    -- requires --> [RoundHistory shape expanded or seat history computed at call site]
    -- feeds into --> [seat assignment step in generatePods]

[Pods-of-3 Toggle (UI)]
    -- requires --> [AdminControls component]
    -- passes --> [allowPodsOf3: boolean] to generatePods call
    -- shown only when --> [n % 4 != 0 AND n >= 7]

[Pods-of-3 Partition Logic (Algorithm)]
    -- requires --> [Mixed partition solver: 3a + 4b = n]
    -- replaces --> [current: numByes = n % 4, numPods = floor(n/4)]
    -- requires --> [Updated PodAssignment type or same type with 3-player pods]
    -- no new DB schema needed (pod_players supports variable player count per pod)
    -- seat shuffle --> [assign [1,2,3] for 3-player pods, [1,2,3,4] for 4-player pods]

[Full test coverage]
    -- requires --> [All three features above]
    -- tests: --> [Vitest unit tests for all algorithm branches]
    -- tests: --> [E2E for toggle visibility, toggle effect on pod count, seat display]
    -- Stryker: --> [Must maintain >=80% mutation score, critical paths 100%]
```

### Dependency Notes

- **Squared-penalty scoring has no external dependencies.** It modifies one internal function. It is the lowest-risk change and should be implemented and tested first.
- **Seat history tracking derives from existing data.** `pod_players` already stores `seat_number` per player per pod. The algorithm already has access to `previousRounds` which includes player IDs. The gap is: `RoundHistory` shape currently does not carry seat assignments — only player IDs and `isBye`. Must either extend `RoundHistory.pods[]` to include seat assignments or compute seat history separately from the DB data before calling `generatePods`.
- **Pods-of-3 toggle requires both UI and algorithm changes.** The UI toggle is simple (a checkbox in AdminControls). The algorithm change is more complex — the partition solver must correctly compute the number of 3-player and 4-player pods for any n, and the seating shuffle must handle 3-player pods (seats [1,2,3] not [1,2,3,4]).
- **DB schema is NOT expected to need changes.** The `pods` and `pod_players` tables support variable player counts per pod already. The toggle value does not need to be persisted — it's a per-round input consumed at generation time.

---

## Pod-of-3 Partition Logic: The Math

For n active players with pods-of-3 enabled, solve: `3a + 4b = n` with minimum a (minimize 3-player pods), both a,b >= 0.

| n (active) | a (pods of 3) | b (pods of 4) | Old behavior (byes) |
|------------|---------------|---------------|---------------------|
| 4 | 0 | 1 | 0 byes |
| 5 | — | — | 1 bye (cannot form clean pods of 3) — show toggle? No, 5 players can't cleanly use pods-of-3 (5=3+2 doesn't work, 5=3a+4b: a=1,b=0.5 — not integer). Keep bye for n=5. |
| 6 | — | — | 2 byes. No clean solution: 6=3*2, a=2,b=0. Two pods of 3! |
| 7 | 1 | 1 | 3 byes. 7=3+4: a=1, b=1. One pod of 3, one pod of 4. |
| 8 | 0 | 2 | 0 byes |
| 9 | 3 | 0 | 1 bye. Or: 9=3*3, a=3,b=0. Three pods of 3. |
| 10 | 2 | 1 | 2 byes. 10=3+3+4. |
| 11 | 1 | 2 | 3 byes. 11=3+4+4. |
| 12 | 0 | 3 | 0 byes |
| 13 | 3 | 1 | 1 bye. 13=3+3+3+4. |

Pattern: For n where n%4 == 0: no toggle needed (already clean). For n%4 == 1: a=3, b=(n-9)/4. For n%4 == 2: a=2, b=(n-6)/4. For n%4 == 3: a=1, b=(n-3)/4.

**Critical edge case:** n < 7 with toggle ON. For n=5: 3a+4b=5 has no non-negative integer solution. For n=6: a=2, b=0 (two pods of 3). For n=3: a=1, b=0 but minimum of 4 players rule — should the toggle allow 3-player pods with 3 players? Current behavior throws at n<4. With toggle: minimum becomes 3? The PROJECT.md says the minimum was "fewer than 4 active players blocks round generation." Decision needed: does enabling the toggle lower the minimum to 3? Recommend: yes, lower minimum to 3 when toggle is active and n>=3, since the user explicitly chose to allow 3-player games.

---

## MVP Definition for v4.0

### Launch With (v4.0)

All three features plus full test coverage — this milestone is all-or-nothing per the PROJECT.md requirements.

- [ ] **Squared-penalty scoring** — Change `getOpponentScore` to square encounter counts. Update all affected unit tests. Re-run Stryker.
- [ ] **Seat history avoidance** — Extend `RoundHistory` or compute seat history at call site. Update `generatePods` signature and seat assignment step. Update all seat-related tests.
- [ ] **Pods-of-3 toggle (algorithm)** — Mixed partition solver. Handle edge cases (n=5 has no clean solution). Update `generatePods` signature to accept `allowPodsOf3: boolean`. Update validation to allow n>=3 when toggle active.
- [ ] **Pods-of-3 toggle (UI)** — Checkbox in AdminControls. Show only when toggle would change behavior (n%4 != 0). Pass flag through to algorithm. Display 3-player pods correctly in PodCard.
- [ ] **Full unit tests** — Parameterized tests for new player counts (n=6,7,9,10,11,13 with toggle). Seat avoidance tests across multiple rounds. Squared-penalty tests confirming repeat opponents score higher than novel opponents.
- [ ] **E2E tests** — Toggle visible/hidden at correct player counts. Toggle produces 3-player pods. Seat numbers render correctly on 3-player pods. Algorithm warnings shown when diversity is impossible.

### Not in v4.0 Scope

- Changing the algorithm to be globally optimal (ILP/constraint solver) — out of scope
- Swiss-style competitive pairings — out of scope
- Anything requiring DB schema changes — not expected, but confirm during implementation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Risk |
|---------|------------|---------------------|----------|------|
| Squared-penalty scoring | HIGH (fewer repeat opponents) | LOW (one-line change, tests update) | P1 | LOW |
| Seat history avoidance | MEDIUM (fairness improvement players notice) | MEDIUM (extend data shape, add avoidance logic) | P1 | MEDIUM |
| Pods-of-3 toggle (UI) | HIGH (eliminates sitting out) | LOW (checkbox + conditional display) | P1 | LOW |
| Pods-of-3 partition algorithm | HIGH (prerequisite for toggle) | MEDIUM (partition math, edge cases) | P1 | MEDIUM |
| Pods-of-3 minimum player adjustment | HIGH (required for feature correctness) | LOW (change validation threshold) | P1 | LOW |
| Updated unit tests | HIGH (100% coverage required by CI) | MEDIUM (parameterized cases, many branches) | P1 | LOW |
| E2E tests for new UI/behavior | HIGH (required by global CLAUDE.md rules) | MEDIUM (new fixtures, toggle flows) | P1 | LOW |

**Priority key:** All items are P1 — this is a cohesive milestone, not à la carte.

---

## Implementation Order Recommendation

1. **Squared-penalty scoring first.** Lowest risk, self-contained, immediately improves algorithm quality. Gives a concrete win to test against before touching the data shape or UI.

2. **Pods-of-3 partition algorithm second.** Pure function change, no UI yet. Establish the partition math, handle all n values, get the unit tests solid. Then wire up the UI.

3. **Pods-of-3 UI toggle third.** Once algorithm handles it correctly, the UI change is straightforward: add a checkbox, pass the flag, adapt PodCard for seat 1-3.

4. **Seat history avoidance last.** Requires deciding how to pass seat history data into `generatePods` — this touches the `RoundHistory` shape or requires a new parameter. The impact on the existing 678 unit tests will be largest here. Do this last when the other two features are stable.

---

## Sources

- [Good-Enough Golfers — Social Golfer Problem Solver](https://goodenoughgolfers.com/) — HIGH confidence (actively maintained tool, uses squared-penalty approach, confirmed via WebFetch)
- [Good-Enough Golfers — GitHub Source](https://github.com/islemaster/good-enough-golfers) — HIGH confidence (open source, algorithm confirmed)
- [Social Golfer Problem — Wikipedia](https://en.wikipedia.org/wiki/Social_golfer_problem) — HIGH confidence (authoritative reference for problem classification)
- [An effective greedy heuristic for the Social Golfer Problem — Springer](https://link.springer.com/article/10.1007/s10479-011-0866-7) — MEDIUM confidence (academic confirmation that greedy heuristics are practical for small n)
- [TopDeck.gg MTR/IPG Addendum — Pod Size Rules](https://topdeck.gg/mtr-ipg-addendum) — MEDIUM confidence (competitive rules, confirmed priority for 4-player pods, one pod-of-3 max per round)
- [Multiplayer MTG Addendum — Pairing Algorithm](https://juizes-mtg-portugal.github.io/multiplayer-addendum-mtr) — MEDIUM confidence (confirmed: "avoid matching between Players that have already played against each other during previous Rounds")
- [NN/G Toggle Switch Guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/) — HIGH confidence (authoritative UX guidance; updated Jan 2025: toggles for immediate-effect, checkboxes when action requires submit button)
- [Running Commander Tournaments — TopDeck.gg](https://topdeck.gg/help/running-commander-tournament) — MEDIUM confidence (industry practice: maximize pods of 4, allow pods of 3 to eliminate byes)

---
*Feature research for: v4.0 Pod Algorithm Improvements — Casual MTG Commander event pod-pairing web app*
*Researched: 2026-03-02*
