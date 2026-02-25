---
status: resolved
trigger: "Pod generation algorithm puts the same players into sit out repeatedly across rounds instead of fairly rotating. Test users 1 and 3 sat out 3 consecutive rounds."
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes: (1) stale React Query cache for allRoundsPods, (2) broken sort comparator using Math.random()-0.5
test: All fixes applied and verified
expecting: N/A - resolved
next_action: Archive session

## Symptoms

expected: With 7 players and pod size 4, the 3 players who sit out should rotate fairly each round. Players who sat out recently should be prioritized for inclusion in the next round.
actual: Test 1 and Test 3 sat out rounds 2, 3, and 4 consecutively. Test 5 sat out rounds 2 and 4. Test 7 sat out only round 3. Test User, Test 2, and Test 4 appear to never sit out.
errors: No error messages - the algorithm completes successfully but produces unfair results.
reproduction: Create an event with 7 players (pod size 4), generate 3-4 rounds. Observe that certain players get stuck in sit out while others always play.
started: Logic flaw from the start - not a regression.

## Eliminated

- hypothesis: Pod algorithm sort logic is inverted (picks highest-bye players instead of lowest)
  evidence: Code sorts ascending by bye count and takes first N (lowest counts) for bye -- this correctly picks players who have sat out least. The algorithm logic itself is correct in intent.
  timestamp: 2026-02-25T00:01:00Z

## Evidence

- timestamp: 2026-02-25T00:00:30Z
  checked: pod-algorithm.ts bye selection logic (lines 160-170)
  found: Sort ascending by byeCount, take first numByes. Logic intent is correct -- picks players with fewest byes to sit out next.
  implication: The algorithm design is sound, but implementation has a subtle sort comparator bug.

- timestamp: 2026-02-25T00:00:40Z
  checked: useAllRoundsPods.ts query key (line 7)
  found: queryKey is ['allRoundsPods', eventId] -- does NOT include roundIds. When roundIds changes (new round added), React Query does not know the query inputs changed and serves stale cached data.
  implication: After generating round 2, the allRoundsPods cache still contains only round 1 pod data. buildByeCounts never sees round 2+ byes.

- timestamp: 2026-02-25T00:00:50Z
  checked: useGenerateRound.ts onSuccess invalidation (lines 31-33)
  found: Invalidates ['rounds', eventId], ['currentRound', eventId], and ['pods']. Does NOT invalidate ['allRoundsPods', eventId].
  implication: After round generation, allRoundsPods is never invalidated. Combined with stale query key, the cache permanently shows only old data.

- timestamp: 2026-02-25T00:00:55Z
  checked: Traced full scenario with 7 players across 4 rounds
  found: Because cache only ever shows round 1 bye history, the same subset of "0-bye" players (those who didn't sit out in round 1) keep getting selected for sit-out in all subsequent rounds.
  implication: This is the primary root cause of the reported bug pattern.

- timestamp: 2026-02-25T00:01:10Z
  checked: pod-algorithm.ts sort comparator (Math.random() - 0.5 tie-breaking)
  found: Using Math.random() inside Array.sort violates transitivity requirement. The "selects bye from players with fewest total byes" test was flaky -- failed 1 in 5 runs. This means the sort can occasionally place high-bye players before low-bye players.
  implication: Secondary root cause: even with correct bye data, the sort can produce wrong orderings, allowing high-bye players to be picked for sit-out over low-bye players.

- timestamp: 2026-02-25T00:01:30Z
  checked: useEventChannel.ts realtime listeners (pods and pod_players tables)
  found: Realtime listeners invalidate ['pods'] but not ['allRoundsPods', eventId], so realtime updates would also fail to refresh the allRoundsPods cache.
  implication: Even realtime events wouldn't fix the stale cache issue.

## Resolution

root_cause: Two independent bugs combined to cause unfair sit-out rotation. (1) PRIMARY: The React Query cache for useAllRoundsPods used queryKey ['allRoundsPods', eventId] without including roundIds, and useGenerateRound did not invalidate this cache. This meant the algorithm only ever saw round 1 bye history, causing the same players to repeatedly sit out. (2) SECONDARY: The bye sort comparator used Math.random()-0.5 for tie-breaking, which violates the transitivity requirement of Array.sort and could produce incorrect orderings, occasionally placing high-bye players before low-bye players.

fix: (1) Added roundIds to useAllRoundsPods queryKey so React Query refetches when rounds change. (2) Added allRoundsPods invalidation to useGenerateRound.onSuccess and useEventChannel realtime listeners. (3) Replaced Math.random()-0.5 sort comparator with Fisher-Yates shuffle before stable sort, ensuring correct ordering with random tie-breaking.

verification: All 305 tests pass (26 test files). The previously flaky "selects bye from players with fewest total byes" test now passes 10/10 runs. Two new regression tests added and pass consistently across 10 consecutive runs.

files_changed:
  - src/hooks/useAllRoundsPods.ts (query key fix)
  - src/hooks/useGenerateRound.ts (cache invalidation)
  - src/hooks/useEventChannel.ts (realtime cache invalidation)
  - src/lib/pod-algorithm.ts (sort comparator fix)
  - src/lib/pod-algorithm.test.ts (2 regression tests)
  - src/hooks/useAllRoundsPods.test.ts (query key assertion update)
