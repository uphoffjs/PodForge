# Project Research Summary

**Project:** PodForge — Commander Pod Pairer v4.0 Pod Algorithm Improvements
**Domain:** Casual MTG Commander event pod-pairing web app — algorithm milestone
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

PodForge v4.0 is a focused algorithm improvement milestone on an already-shipped, production React/Supabase SPA. The three features — better repeat-opponent reduction, seat randomization verification, and a pods-of-3 toggle — all route through a single choke point: `src/lib/pod-algorithm.ts` and `AdminControls.tsx`. No new dependencies are needed. No database migrations are required. The entire milestone is pure TypeScript logic changes and one small UI addition.

The recommended implementation approach is sequential and algorithm-first. The highest-impact change is replacing the linear penalty scoring with quadratic penalty scoring in `getOpponentScore` (one-line change: `score += count * count`). This is followed by the pods-of-3 partition algorithm, which requires extracting a testable `computePodSizes()` helper and handling the edge case where n=5 cannot avoid a bye regardless of the toggle. The UI toggle is a simple `<input type="checkbox">` using Tailwind peer-modifier patterns, wired in only after the algorithm is solid. Seat randomization is investigation-first: run an empirical seat-frequency simulation before writing any code, because the current `shuffleArray([1,2,3,4])` per pod may already be correct.

The key risk is the hardcoded assumption that pods always contain 4 players. This implicit invariant appears in literal `4`s, `shuffleArray([1,2,3,4])`, integration test assertions, and variable names throughout `pod-algorithm.ts` and its test files. A greedy audit of every literal `4` before writing pods-of-3 code is mandatory. Secondary risk: Stryker CI gates at 80% mutation score, and the new `computePodSizes` branch logic is high-mutant-density territory — exhaustive parameterized unit tests for all player counts 4-20 in both toggle states (34 test cases minimum) are non-negotiable.

---

## Key Findings

### Recommended Stack

No new dependencies. The existing stack (React 19, Vite, TypeScript, Tailwind CSS v4, Supabase, Vitest, Cypress, Stryker) is validated and sufficient for all three v4.0 features. Every considered external library was rejected: `socialgolfer.js` is CoffeeScript and 100x slower than reference implementations; LP solvers and genetic algorithm libraries target problems with 100+ variables; Headless UI is 30KB for a single toggle. The Tailwind `peer-checked:` pattern provides a fully accessible custom toggle with zero bundle cost.

**Core technologies (unchanged from v3.0):**
- `src/lib/pod-algorithm.ts`: All algorithm changes isolated here — pure TypeScript, no I/O, no new deps
- `AdminControls.tsx`: One new `useState` boolean and a toggle checkbox; passes options to algorithm
- `PodCard.tsx`: Verify-only — `getOrdinal` already handles 1st/2nd/3rd; `sortedPlayers.sort` works for any pod size

**Algorithm approach (no new libraries):**
- Quadratic penalty scoring: `score += count * count` replaces `score += count` — penalizes repeat pairings exponentially
- Multi-start greedy (5 iterations, keep best): cheap O(n²) improvement with no algorithm complexity increase
- `computePodSizes(n, allowPodsOf3)`: pure function finding minimum k pods-of-3 such that `(n - 3k) % 4 === 0`

### Expected Features

**Must have (table stakes — all P1, all-or-nothing milestone):**
- Quadratic penalty scoring for fewer repeat opponents — users expect "you shouldn't play the same people twice"
- Pods-of-3 toggle eliminates unnecessary byes — 13 players should all play, not sit one out
- Per-round toggle only (not event-wide) — player count changes round to round; event-wide gets this wrong
- Pods of 3 visually distinct in PodCard — 3-player pod shows seats 1-3 only, no seat 4 badge
- Algorithm warnings preserved — keep existing warning surface; add warning when diversity is impossible

**Should have (differentiators):**
- Seat history tracking with avoidance — no casual Commander tool tracks seat position cross-round
- Contextual hint when pods-of-3 toggle would eliminate a bye (show when n % 4 != 0)
- "(3-player pod)" subtitle on PodCard so players do not mistake missing seat 4 for a display bug

**Defer (not in v4.0 scope):**
- Globally optimal algorithm (ILP/constraint solver) — NP-hard, impractical for browser TypeScript, no user-visible improvement at n<20
- Event-wide "always use pods of 3" persistent setting — per-round is the correct UX
- Fairness score display — adds UI complexity players do not need
- Hard seat-repetition constraint ("never same seat back to back") — makes the problem unsolvable for small groups

### Architecture Approach

All three v4.0 features modify only two source files (`pod-algorithm.ts` and `AdminControls.tsx`) and add tests. The Supabase RPC, database schema, all query hooks, and all other React components are confirmed unchanged via direct source inspection. The `generate_round` RPC already accepts JSONB pod assignments of any size via `jsonb_array_elements` — pods of 3 produce 3 rows instead of 4 with no migration. The `allowPodsOf3` toggle lives exclusively in `AdminControls` component state; it is a per-round algorithm input, not a persisted record.

**Major components and v4.0 changes:**
1. `pod-algorithm.ts` — ADD `GeneratePodsOptions` interface, `computePodSizes()`, `scoreAssignment()`, `runGreedy()` extraction; MODIFY `generatePods()` signature (additive, backwards-compatible, all existing tests pass unchanged)
2. `AdminControls.tsx` — ADD `allowPodsOf3` useState, toggle checkbox UI, pass `{ allowPodsOf3 }` to `generatePods()`
3. `PodCard.tsx` — VERIFY ONLY; add component test for 3-player pod; no source changes expected
4. `pod-algorithm.test.ts` / `.integration.test.ts` — ADD parameterized cases for all n=4-20 in both toggle states
5. `AdminControls.test.tsx` — ADD toggle render and state tests
6. `cypress/e2e/` — ADD E2E test generating a round with pods-of-3 enabled (13-player event)

### Critical Pitfalls

1. **Greedy local-optimum trap** — The last pod filled absorbs disproportionate repeat opponents because early pods consume "easy" players. Fix requires a post-greedy swap pass: iterate all cross-pod player pairs, accept swaps that reduce global repeat score. Multi-start greedy alone improves but does not fully resolve this structural bias. The swap pass belongs in Phase 1 to meet the tighter `maxPairCount <= 2` threshold.

2. **Pods of 3 invalidates all hardcoded 4-player invariants** — The literal `4` appears in `shuffleArray([1,2,3,4])`, `slot < 4` fill loop, integration test assertions of `pod.players.toHaveLength(4)`, and variable names. Every instance must be audited before writing any pods-of-3 code. Partial changes leave the codebase in an inconsistent state.

3. **Pod partition math has ambiguous solutions without a defined policy** — For some player counts (e.g., n=15: either `3×4+1×3` or `5×3`), multiple valid arrangements exist. Policy must be explicit and enforced by a standalone `computePodSizes()` function: "find minimum k pods-of-3 such that `(n - 3k) % 4 === 0`." Extract and unit-test exhaustively before wiring into `generatePods`.

4. **Seat randomization may already be implemented** — The current algorithm already calls `shuffleArray([1,2,3,4])` per pod. Before writing any seat-fix code, run an empirical simulation (20 rounds × 8 players, track per-player seat frequency). If distribution is roughly uniform (each seat ~25% of rounds), the fix is a no-op and all effort belongs in opponent reduction.

5. **Future defensive RPC code can silently break pods of 3** — The `generate_round` RPC accepts any pod size today, but adding a `!= 4` validation in a future migration would break pods-of-3 silently (unit tests mock the RPC). Add an explicit comment to the migration SQL documenting that pod sizes 3 and 4 are both valid. Add at least one E2E test that exercises the real RPC with a 3-player pod.

---

## Implications for Roadmap

Based on combined research, the natural phase structure follows data dependency direction: pure algorithm first, UI last, investigation before implementation.

### Phase 1: Algorithm Core — Quadratic Penalty + Multi-Start Greedy

**Rationale:** Highest-impact, lowest-risk change. Self-contained pure function with no React or Supabase dependencies. All existing 678+ unit tests pass unchanged because the public `generatePods` signature is unmodified. Gives a concrete, measurable win before touching UI or data shapes.

**Delivers:** Meaningfully fewer repeat opponents across all player counts. Integration test thresholds tighten from `maxPairCount <= 3` to `<= 2` for 8-player/4-round scenarios. `scoreAssignment()` and `runGreedy()` helpers extracted for multi-start loop.

**Addresses:** Quadratic penalty scoring (table stakes), multi-start greedy (differentiator), repeat-opponent reduction (core milestone goal)

**Avoids:** Greedy local-optimum trap (Pitfall 1) — the swap pass or shuffle-fill-order fix resolves structural bias before the milestone ships

**Research flag:** Standard patterns — quadratic penalty scoring is well-documented in Social Golfer Problem literature and Good-Enough Golfers source code. No additional research needed.

---

### Phase 2: Pods-of-3 Algorithm (Pure Function, No UI)

**Rationale:** Pure function change with zero React or Supabase dependencies. Establish all partition math, handle all n values 4-20, get exhaustive unit tests solid before wiring any UI. Isolating this step keeps Stryker runs focused and ensures algorithm bugs are caught before the UI integration layer obscures them.

**Delivers:** `computePodSizes(n, allowPodsOf3)` tested for all 34 input combinations (n=4-20, both toggle states). `generatePods()` gains the `GeneratePodsOptions` interface and pods-of-3 branch. Seat generation dynamically uses `[1,2,3]` or `[1,2,3,4]` based on pod size. Minimum player threshold adjusted to 3 when toggle is active.

**Addresses:** Pods-of-3 partition algorithm (table stakes), minimum player threshold adjustment, all P1 algorithm requirements

**Avoids:** Pod partition math ambiguity (Pitfall 3) — `computePodSizes` is extracted as a standalone testable function before being wired in; Pods of 3 invalidates 4-player invariants (Pitfall 2) — full audit of hardcoded `4` literals precedes any code write

**Research flag:** Standard patterns — the partition math and `computePodSizes` implementation are fully worked out in ARCHITECTURE.md. No additional research needed.

---

### Phase 3: Seat Randomization Investigation + Fix (If Needed)

**Rationale:** Investigation-first, not implementation-first. The current algorithm already has Fisher-Yates shuffle per pod. Before writing code, run the empirical seat-frequency simulation. If distribution is uniform, this phase produces only a statistical assertion test with no algorithm change. If bias exists, the fix is localized to a specific shuffle call site.

**Delivers:** Either (a) a statistical integration test confirming seat distribution is already uniform, plus a comment marking the feature verified, or (b) a targeted fix at the specific shuffle call site that produced bias, plus the statistical test.

**Addresses:** Seat history avoidance (differentiator), seat randomization verification (milestone goal)

**Avoids:** Seat randomization may already be implemented (Pitfall 4) — the empirical check is the explicit guard against building something that already works

**Research flag:** Standard patterns — investigation approach is defined. The fix, if needed, is a targeted shuffle call change. No external research required.

---

### Phase 4: Admin UI Toggle

**Rationale:** UI depends on Phase 2 algorithm being correct. The component test mocks `generatePods`, so algorithm bugs do not surface through UI, but the toggle needs the algorithm to have a confirmed, tested interface before wiring is meaningful.

**Delivers:** Tailwind `peer-checked:` checkbox toggle in `AdminControls` with `data-testid="pods-of-3-toggle"`. Toggle resets to off after `onSuccess`. Contextual hint shown when pods-of-3 would eliminate a bye. Unit tests for toggle render, state change, and correct options passed to `generatePods`.

**Addresses:** Per-round toggle UI (table stakes), toggle visibility only when n%4!=0 (anti-feature prevention), UX clarity on toggle label

**Avoids:** allRoundsPods query key instability (Pitfall 6) — profile with React Query DevTools after adding toggle state before shipping; Adding allowPodsOf3 to the database (Architecture anti-pattern 1) — toggle stays in component state only

**Research flag:** Standard patterns — Tailwind peer-modifier toggle is documented in official Tailwind UI blocks. Pattern matches existing `selectedDuration` state in the same component.

---

### Phase 5: PodCard Verification + E2E

**Rationale:** Final validation layer. PodCard verification confirms no source changes are needed for 3-player pod rendering. E2E tests validate the full user-visible flow through the real Supabase RPC — the only layer that can catch a future defensive RPC validation bug (Pitfall 5). E2E is last because it is the slowest feedback loop and depends on all prior phases.

**Delivers:** Component test for 3-player PodCard (1st/2nd/3rd badges, no 4th badge, no layout overflow). E2E test generating a round with pods-of-3 toggle ON for a 13-player event, asserting 3-player pod card appears. E2E test confirming toggle OFF reverts to bye behavior. Visual regression baselines updated if pod card layout changes. RPC migration comment added documenting valid pod sizes 3 and 4.

**Addresses:** All E2E requirements from FEATURES.md, PodCard 3-player display (table stakes), RPC comment (Pitfall 5 prevention)

**Avoids:** RPC defensive code breaking pods of 3 (Pitfall 5) — E2E test exercises real RPC; 3-player pod showing seat 4 badge (PITFALLS "looks done but isn't" checklist item)

**Research flag:** Standard patterns — Cypress patterns follow established project conventions. No additional research needed.

---

### Phase Ordering Rationale

- Algorithm phases before UI phases: `generatePods` is a pure function with no React deps — fastest feedback loop, no noise from rendering or async
- Phase 2 (pods-of-3 algorithm) before Phase 4 (UI toggle): the UI is a thin wrapper; wiring it to an untested algorithm produces confusing failures
- Phase 3 (seat investigation) between the two algorithm phases and the UI phase: output is binary — either no code change (fast) or a targeted fix localized to one file already in scope
- Phase 5 last: E2E tests depend on all prior phases, are the slowest feedback loop, and validate user-visible behavior rather than algorithm correctness

---

### Research Flags

Phases likely needing deeper research during planning:
- None identified. All phases have well-defined implementation approaches from direct codebase inspection and established algorithm literature. The roadmapper can structure all five phases without additional research spikes.

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1:** Algorithm modification of existing well-tested pure function — pattern established in literature and codebase
- **Phase 2:** Partition math fully derived in research; `computePodSizes` implementation provided in ARCHITECTURE.md
- **Phase 3:** Empirical investigation approach defined; fix (if needed) is a targeted shuffle change
- **Phase 4:** Tailwind peer-modifier toggle is documented; component state pattern matches existing `selectedDuration` pattern in same component
- **Phase 5:** Cypress patterns follow existing project conventions; component test pattern matches existing `AdminControls.test.tsx`

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All decisions verified against official docs (Tailwind, Social Golfer Problem literature, Good-Enough Golfers source code). First-party codebase inspection confirms infrastructure compatibility. Existing package versions unchanged. |
| Features | HIGH (algorithm theory), MEDIUM (UX patterns) | Algorithm theory is academically grounded and confirmed via the Good-Enough Golfers tool source code. UX patterns for the toggle label and contextual hints are best-practice recommendations — should be validated with actual admin users before Phase 4 ships. |
| Architecture | HIGH | All findings from direct source inspection of the actual codebase. Zero speculation. Supabase RPC, PodCard, and all unchanged components confirmed by reading source files. File-level change map in ARCHITECTURE.md is based on inspected line numbers and function names. |
| Pitfalls | HIGH | Pitfalls derived from direct codebase inspection plus algorithm analysis. Specific line numbers, existing test thresholds, and exact variable names cited. External sources confirm secondary pitfalls (TanStack Query key stability, Supabase RPC schema changes). |

**Overall confidence:** HIGH

### Gaps to Address

- **Seat randomization bias:** Must run empirical simulation before Phase 3 implementation begins. Whether a real bug exists cannot be determined from static analysis — requires runtime measurement.

- **Multi-start greedy threshold:** Integration test threshold tightening (from `<= 3` to `<= 2`) needs empirical verification after Phase 1 ships. The improvement is expected but the exact achievable threshold depends on measured output.

- **Toggle UX edge cases:** Two UX decisions require resolution during Phase 4: (a) what to show when pods-of-3 is toggled ON with exactly 5 players (toggle has no effect — warn or hide?); (b) whether the toggle resets to off after `onSuccess` or stays sticky. Both are low-stakes decisions that can be made during implementation.

- **Stryker regression risk:** Every new branch in `computePodSizes` and the multi-start loop creates new mutation surface. The 80% CI gate is a hard block. Budget time for Stryker triage after each algorithm phase.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/lib/pod-algorithm.ts`, `AdminControls.tsx`, `PodCard.tsx`, `useGenerateRound.ts`, `supabase/migrations/00002_rounds_pods_admin.sql`, `pod-algorithm.integration.test.ts`, `src/types/database.ts`
- [Social Golfer Problem — Wikipedia](https://en.wikipedia.org/wiki/Social_golfer_problem) — problem classification, known solution approaches
- [Good-Enough Golfers — GitHub source](https://github.com/islemaster/good-enough-golfers) — quadratic penalty scoring pattern confirmed in open-source implementation
- [Tailwind CSS Toggles — Official UI blocks](https://tailwindcss.com/plus/ui-blocks/application-ui/forms/toggles) — peer-checked pattern for custom toggle implementation
- [NN/G Toggle Switch Guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/) — per-round vs. event-wide toggle UX decision basis

### Secondary (MEDIUM confidence)
- [Good-Enough Golfers — live tool](https://goodenoughgolfers.com/) — empirical confirmation that squared-penalty greedy produces acceptable results for small casual groups
- [Multiplayer MTG Addendum to MTR](https://juizes-mtg-portugal.github.io/multiplayer-addendum-mtr) — pod size rules: maximize pods of 4, allow pods of 3 to eliminate byes; repeat-opponent policy
- [Running Commander Tournaments — TopDeck.gg](https://topdeck.gg/help/running-commander-tournament) — industry practice for mixed pod sizes
- [An effective greedy heuristic for the Social Golfer Problem — Springer](https://link.springer.com/article/10.1007/s10479-011-0866-7) — academic confirmation greedy heuristics are practical for small n
- [TanStack Query key stability discussion](https://github.com/TanStack/query/discussions/6953) — array reference equality and query key churn patterns

### Tertiary (evaluated and rejected — LOW confidence not applicable)
- `socialgolfer.js` — CoffeeScript, ~100x slower than C++ reference, not suitable for embedding; rejected
- `javascript-lp-solver` — LP solver, wrong problem domain for combinatorial scheduling; rejected
- `@headlessui/react` Switch — 30KB for one toggle; rejected in favor of Tailwind peer modifiers
- All genetic algorithm / simulated annealing libraries — over-engineered for n<20 player counts; rejected

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
