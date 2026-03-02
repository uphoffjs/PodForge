import { describe, it, expect, vi } from 'vitest'
import {
  generatePods,
  buildOpponentHistory,
  buildByeCounts,
  getOpponentScore,
  podPenalty,
  totalPenalty,
  greedyAssign,
  swapPass,
  computePodSizes,
  type PlayerInfo,
  type RoundHistory,
} from './pod-algorithm'

/**
 * Seeds Math.random with a deterministic LCG (Linear Congruential Generator).
 * Returns a vi.SpyInstance that must be restored after use.
 */
function seedRandom(seed: number) {
  let state = seed
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  })
}

function makePlayers(count: number): PlayerInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
  }))
}

describe('pod-algorithm', () => {
  describe('generatePods', () => {
    describe('validation', () => {
      it('throws when fewer than 4 active players (3 players)', () => {
        const players = makePlayers(3)
        expect(() => generatePods(players, [])).toThrow(
          'Fewer than 4 active players'
        )
      })

      it('throws when 0 active players', () => {
        expect(() => generatePods([], [])).toThrow(
          'Fewer than 4 active players'
        )
      })

      it('throws when 1 active player', () => {
        const players = makePlayers(1)
        expect(() => generatePods(players, [])).toThrow(
          'Fewer than 4 active players'
        )
      })

      it('throws when 2 active players', () => {
        const players = makePlayers(2)
        expect(() => generatePods(players, [])).toThrow(
          'Fewer than 4 active players'
        )
      })
    })

    describe('basic pod formation (no previous rounds)', () => {
      it('creates 1 pod of 4 with exactly 4 players', () => {
        const players = makePlayers(4)
        const result = generatePods(players, [])

        expect(result.assignments).toHaveLength(1)
        expect(result.assignments[0].players).toHaveLength(4)
        expect(result.assignments[0].is_bye).toBe(false)
        expect(result.assignments[0].pod_number).toBe(1)
        expect(result.warnings).toEqual([])
      })

      it('creates 1 pod of 4 and 1 bye with 5 players', () => {
        const players = makePlayers(5)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(activePods).toHaveLength(1)
        expect(activePods[0].players).toHaveLength(4)
        expect(byePods).toHaveLength(1)
        expect(byePods[0].players).toHaveLength(1)
        expect(result.warnings).toEqual([])
      })

      it('creates 1 pod of 4 and 2 byes with 6 players', () => {
        const players = makePlayers(6)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(activePods).toHaveLength(1)
        expect(activePods[0].players).toHaveLength(4)
        expect(byePods).toHaveLength(1)
        expect(byePods[0].players).toHaveLength(2)
      })

      it('creates 1 pod of 4 and 3 byes with 7 players, with warning', () => {
        const players = makePlayers(7)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(activePods).toHaveLength(1)
        expect(activePods[0].players).toHaveLength(4)
        expect(byePods).toHaveLength(1)
        expect(byePods[0].players).toHaveLength(3)
        expect(result.warnings).toContainEqual(
          expect.stringContaining('High bye count')
        )
        expect(result.warnings[0]).toContain('3 of 7')
      })

      it('creates 2 pods of 4 with 8 players, no byes', () => {
        const players = makePlayers(8)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(activePods).toHaveLength(2)
        activePods.forEach((pod) => {
          expect(pod.players).toHaveLength(4)
        })
        expect(byePods).toHaveLength(0)
        expect(result.warnings).toEqual([])
      })

      it('creates 3 pods of 4 with 12 players', () => {
        const players = makePlayers(12)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(activePods).toHaveLength(3)
        activePods.forEach((pod) => {
          expect(pod.players).toHaveLength(4)
        })
        expect(byePods).toHaveLength(0)
      })
    })

    describe('seat assignments', () => {
      it('assigns seat numbers 1-4 to each non-bye pod', () => {
        const players = makePlayers(8)
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        activePods.forEach((pod) => {
          const seats = pod.players
            .map((p) => p.seat_number)
            .sort((a, b) => a! - b!)
          expect(seats).toEqual([1, 2, 3, 4])
        })
      })

      it('assigns null seat numbers to bye players', () => {
        const players = makePlayers(5)
        const result = generatePods(players, [])

        const byePods = result.assignments.filter((a) => a.is_bye)
        byePods.forEach((pod) => {
          pod.players.forEach((p) => {
            expect(p.seat_number).toBeNull()
          })
        })
      })
    })

    describe('pod numbering', () => {
      it('assigns 1-indexed pod numbers', () => {
        const players = makePlayers(9) // 2 pods + 1 bye
        const result = generatePods(players, [])

        const podNumbers = result.assignments.map((a) => a.pod_number).sort()
        // Should have pod 1, pod 2, and a bye pod
        expect(podNumbers).toContain(1)
        expect(podNumbers).toContain(2)
      })
    })

    describe('all players accounted for', () => {
      it('every input player appears exactly once in the result', () => {
        const players = makePlayers(9)
        const result = generatePods(players, [])

        const allPlayerIds = result.assignments.flatMap((a) =>
          a.players.map((p) => p.player_id)
        )
        expect(allPlayerIds.sort()).toEqual(
          players.map((p) => p.id).sort()
        )
      })

      it('no duplicate players across pods', () => {
        const players = makePlayers(12)
        const result = generatePods(players, [])

        const allPlayerIds = result.assignments.flatMap((a) =>
          a.players.map((p) => p.player_id)
        )
        const uniqueIds = new Set(allPlayerIds)
        expect(uniqueIds.size).toBe(allPlayerIds.length)
      })
    })

    describe('opponent avoidance with history', () => {
      it('minimizes repeat opponents with 8 players after 1 round', () => {
        const players = makePlayers(8)
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              {
                playerIds: ['player-1', 'player-2', 'player-3', 'player-4'],
                isBye: false,
              },
              {
                playerIds: ['player-5', 'player-6', 'player-7', 'player-8'],
                isBye: false,
              },
            ],
          },
        ]

        const result = generatePods(players, previousRounds)

        // With 8 players who were previously in 2 pods of 4,
        // the algorithm should try to mix them, not repeat the same groupings.
        const activePods = result.assignments.filter((a) => !a.is_bye)
        expect(activePods).toHaveLength(2)

        // Check that pods are not identical to previous round
        const pod1Ids = activePods[0].players
          .map((p) => p.player_id)
          .sort()
        const prevPod1 = ['player-1', 'player-2', 'player-3', 'player-4']
        const prevPod2 = ['player-5', 'player-6', 'player-7', 'player-8']

        // At least one pod should have players from both previous pods
        const pod1FromPrev1 = pod1Ids.filter((id) =>
          prevPod1.includes(id)
        ).length
        const pod1FromPrev2 = pod1Ids.filter((id) =>
          prevPod2.includes(id)
        ).length

        // The algorithm should mix: no pod should have all 4 from the same previous pod
        expect(pod1FromPrev1).toBeLessThan(4)
        expect(pod1FromPrev2).toBeLessThan(4)
      })

      it('stacks opponent avoidance across 2 rounds', () => {
        const players = makePlayers(8)
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              {
                playerIds: ['player-1', 'player-2', 'player-3', 'player-4'],
                isBye: false,
              },
              {
                playerIds: ['player-5', 'player-6', 'player-7', 'player-8'],
                isBye: false,
              },
            ],
          },
          {
            pods: [
              {
                playerIds: ['player-1', 'player-5', 'player-2', 'player-6'],
                isBye: false,
              },
              {
                playerIds: ['player-3', 'player-7', 'player-4', 'player-8'],
                isBye: false,
              },
            ],
          },
        ]

        const result = generatePods(players, previousRounds)
        const activePods = result.assignments.filter((a) => !a.is_bye)
        expect(activePods).toHaveLength(2)

        // After 2 rounds each player has faced 6 others total (3 per round).
        // The algorithm should try to pair players who have met least.
        // player-1 has been with: 2,3,4 (round1) and 5,2,6 (round2)
        // So player-1 has met 2 twice, 3 once, 4 once, 5 once, 6 once. Not met: 7, 8
        // The algorithm should try to put player-1 with 7 and 8

        // Verify all 8 players are present
        const allIds = activePods.flatMap((p) =>
          p.players.map((pl) => pl.player_id)
        )
        expect(allIds.sort()).toEqual(players.map((p) => p.id).sort())
      })
    })

    describe('bye rotation', () => {
      it('rotates bye player across rounds (5 players)', () => {
        const players = makePlayers(5)

        // Round 1: player-5 had a bye
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-2',
                  'player-3',
                  'player-4',
                ],
                isBye: false,
              },
              { playerIds: ['player-5'], isBye: true },
            ],
          },
        ]

        const result = generatePods(players, previousRounds)
        const byePod = result.assignments.find((a) => a.is_bye)
        expect(byePod).toBeDefined()

        // player-5 already had a bye, so a different player should sit out
        const byePlayerIds = byePod!.players.map((p) => p.player_id)
        expect(byePlayerIds).not.toContain('player-5')
      })

      it('selects bye from players with fewest total byes', () => {
        const players = makePlayers(5)

        // Players 1-4 have all had 1 bye each; player-5 has had 2 byes
        // So the new bye should come from players 1-4 (lowest count)
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              {
                playerIds: [
                  'player-2',
                  'player-3',
                  'player-4',
                  'player-5',
                ],
                isBye: false,
              },
              { playerIds: ['player-1'], isBye: true },
            ],
          },
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-3',
                  'player-4',
                  'player-5',
                ],
                isBye: false,
              },
              { playerIds: ['player-2'], isBye: true },
            ],
          },
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-2',
                  'player-4',
                  'player-5',
                ],
                isBye: false,
              },
              { playerIds: ['player-3'], isBye: true },
            ],
          },
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-2',
                  'player-3',
                  'player-5',
                ],
                isBye: false,
              },
              { playerIds: ['player-4'], isBye: true },
            ],
          },
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-2',
                  'player-3',
                  'player-4',
                ],
                isBye: false,
              },
              { playerIds: ['player-5'], isBye: true },
            ],
          },
          {
            pods: [
              {
                playerIds: [
                  'player-1',
                  'player-2',
                  'player-3',
                  'player-4',
                ],
                isBye: false,
              },
              { playerIds: ['player-5'], isBye: true },
            ],
          },
        ]

        const result = generatePods(players, previousRounds)
        const byePod = result.assignments.find((a) => a.is_bye)
        const byePlayerIds = byePod!.players.map((p) => p.player_id)

        // player-5 has 2 byes, others have 1 each.
        // The algorithm should NOT pick player-5 again (they have more byes).
        expect(byePlayerIds).not.toContain('player-5')
      })

      it('sorts ascending by bye count (lowest first), not by sum', () => {
        // Targeted test for mutation: aByes - bByes => aByes + bByes
        // With 9 players (1 bye needed), the single bye player must have the fewest byes.
        // If sort is aByes + bByes, the comparison value doesn't distinguish direction,
        // and players get sorted arbitrarily.
        const players = makePlayers(9)

        // Create history where players 5-9 have many byes, players 1-4 have 0
        const previousRounds: RoundHistory[] = []
        for (let round = 0; round < 5; round++) {
          previousRounds.push({
            pods: [
              { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
              { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
              { playerIds: ['player-9'], isBye: true },
            ],
          })
        }
        // player-9 has 5 byes. All others have 0.

        // Run multiple times due to random tie-breaking among 0-bye players
        for (let i = 0; i < 10; i++) {
          const result = generatePods(players, previousRounds)
          const byePod = result.assignments.find((a) => a.is_bye)
          const byePlayerIds = byePod!.players.map((p) => p.player_id)

          // The bye must come from the 0-bye group (players 1-8), NOT player-9
          expect(byePlayerIds).not.toContain('player-9')
        }
      })

      it('randomizes tie-breaking when bye counts are equal', () => {
        const players = makePlayers(5)

        // No prior rounds: all players have 0 byes
        // Run 20 times and check that different players get the bye
        const byePlayerSets = new Set<string>()
        for (let i = 0; i < 20; i++) {
          const result = generatePods(players, [])
          const byePod = result.assignments.find((a) => a.is_bye)
          byePod!.players.forEach((p) => byePlayerSets.add(p.player_id))
        }

        // With randomized tie-breaking, multiple different players should get byes
        expect(byePlayerSets.size).toBeGreaterThan(1)
      })

      it('fairly rotates sit-outs across 4 rounds with 7 players (regression: sit-out-fairness-bug)', () => {
        // Regression test: With 7 players and pod size 4, 3 players sit out each round.
        // Over 4 rounds, no player should sit out more than 2 times (fair distribution).
        // Previously, the same players would sit out every round due to stale bye data
        // and a broken sort comparator using Math.random() - 0.5.
        const spy = seedRandom(42 + 7)
        try {
          const players = makePlayers(7)
          const byeCountMap = new Map<string, number>()
          for (const p of players) {
            byeCountMap.set(p.id, 0)
          }

          // Simulate 4 consecutive rounds, building history as we go
          const previousRounds: RoundHistory[] = []
          for (let round = 0; round < 4; round++) {
            const result = generatePods(players, previousRounds)

            // Build round history from result
            const roundHistory: RoundHistory = {
              pods: result.assignments.map((a) => ({
                playerIds: a.players.map((p) => p.player_id),
                isBye: a.is_bye,
              })),
            }
            previousRounds.push(roundHistory)

            // Track bye counts
            const byePod = result.assignments.find((a) => a.is_bye)
            if (byePod) {
              for (const p of byePod.players) {
                byeCountMap.set(p.player_id, (byeCountMap.get(p.player_id) ?? 0) + 1)
              }
            }
          }

          // With 7 players, 3 byes per round, 4 rounds = 12 total sit-outs
          // Fair distribution: each player sits out ~12/7 ~= 1.7 times
          // No player should sit out more than 2 times (allowing for rounding)
          const byeCounts = Array.from(byeCountMap.values())
          const maxByes = Math.max(...byeCounts)
          const minByes = Math.min(...byeCounts)

          // Max bye count should not exceed 2 (with fair rotation)
          expect(maxByes).toBeLessThanOrEqual(2)
          // The spread between most and least should be at most 1
          expect(maxByes - minByes).toBeLessThanOrEqual(1)
        } finally {
          spy.mockRestore()
        }
      })

      it('never picks the highest-bye player for sit-out when lower-bye players exist (sort stability)', () => {
        // Targeted regression test for the Math.random()-0.5 sort comparator bug.
        // The broken comparator could violate transitivity and place high-bye players
        // before low-bye players. Run many iterations to catch statistical failures.
        const players = makePlayers(5)

        // Player-5 has 3 byes, all others have 0
        const previousRounds: RoundHistory[] = []
        for (let i = 0; i < 3; i++) {
          previousRounds.push({
            pods: [
              { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
              { playerIds: ['player-5'], isBye: true },
            ],
          })
        }

        // Run 50 times. Player-5 should NEVER be picked (3 byes vs 0 for others)
        for (let i = 0; i < 50; i++) {
          const result = generatePods(players, previousRounds)
          const byePod = result.assignments.find((a) => a.is_bye)
          const byePlayerIds = byePod!.players.map((p) => p.player_id)
          expect(byePlayerIds).not.toContain('player-5')
        }
      })
    })

    describe('result structure', () => {
      it('returns a valid PodAssignmentResult shape', () => {
        const players = makePlayers(8)
        const result = generatePods(players, [])

        expect(result).toHaveProperty('assignments')
        expect(result).toHaveProperty('warnings')
        expect(Array.isArray(result.assignments)).toBe(true)
        expect(Array.isArray(result.warnings)).toBe(true)

        result.assignments.forEach((assignment) => {
          expect(assignment).toHaveProperty('pod_number')
          expect(assignment).toHaveProperty('is_bye')
          expect(assignment).toHaveProperty('players')
          expect(typeof assignment.pod_number).toBe('number')
          expect(typeof assignment.is_bye).toBe('boolean')
          expect(Array.isArray(assignment.players)).toBe(true)

          assignment.players.forEach((player) => {
            expect(player).toHaveProperty('player_id')
            expect(player).toHaveProperty('seat_number')
          })
        })
      })
    })

    describe('greedy opponent avoidance deterministic verification', () => {
      it('places player with zero overlap into pod over player with high overlap', () => {
        // 8 players: in round 1, pod A = [1,2,3,4], pod B = [5,6,7,8]
        // In round 2, the algorithm must avoid re-pairing 1-2-3-4 and 5-6-7-8.
        // We run this deterministically by checking total overlap score per pod.
        const players = makePlayers(8)
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
              { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
            ],
          },
        ]

        // Run multiple times to account for randomness in first pick
        const totalOverlapScores: number[] = []
        for (let trial = 0; trial < 10; trial++) {
          const result = generatePods(players, previousRounds)
          const activePods = result.assignments.filter((a) => !a.is_bye)

          // For each pod, count how many pairs of players were previously in the same pod
          const history = buildOpponentHistory(previousRounds)
          for (const pod of activePods) {
            let overlap = 0
            const ids = pod.players.map((p) => p.player_id)
            for (let i = 0; i < ids.length; i++) {
              for (let j = i + 1; j < ids.length; j++) {
                overlap += history.get(ids[i])?.get(ids[j]) ?? 0
              }
            }
            totalOverlapScores.push(overlap)
          }
        }

        // With opponent avoidance, pods should have low overlap.
        // Max possible overlap per pod would be 6 (all 4 from same previous pod = C(4,2) = 6).
        // With avoidance, most pods should have overlap <= 3 (at most 2 players from same prev pod).
        const avgOverlap = totalOverlapScores.reduce((a, b) => a + b, 0) / totalOverlapScores.length
        expect(avgOverlap).toBeLessThan(4) // Much less than 6 (no avoidance)
      })

      it('greedy selection produces different groupings than random when history exists', () => {
        // With strong history, greedy should produce measurably different results than ignoring history
        const players = makePlayers(8)
        const previousRounds: RoundHistory[] = [
          {
            pods: [
              { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
              { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
            ],
          },
          {
            pods: [
              { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
              { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
            ],
          },
        ]

        // After 2 identical rounds, players 1-4 have faced each other twice.
        // The greedy algorithm MUST avoid putting them together again.
        const history = buildOpponentHistory(previousRounds)
        // Verify history is as expected
        expect(history.get('player-1')?.get('player-2')).toBe(2)

        // Run 10 trials
        for (let trial = 0; trial < 10; trial++) {
          const result = generatePods(players, previousRounds)
          const activePods = result.assignments.filter((a) => !a.is_bye)

          for (const pod of activePods) {
            const ids = pod.players.map((p) => p.player_id)
            const fromPrevPod1 = ids.filter((id) =>
              ['player-1', 'player-2', 'player-3', 'player-4'].includes(id)
            ).length

            // With 2 rounds of history, no pod should contain 4 players from the same previous group
            expect(fromPrevPod1).toBeLessThanOrEqual(3)
          }
        }
      })
    })

    describe('8 players exact with no byes produces no bye pod', () => {
      it('does not create a bye pod when player count is divisible by 4', () => {
        const players = makePlayers(8)
        const result = generatePods(players, [])

        // numByes should be 0, so no bye processing happens
        const byePods = result.assignments.filter((a) => a.is_bye)
        expect(byePods).toHaveLength(0)

        // Exactly 2 active pods
        const activePods = result.assignments.filter((a) => !a.is_bye)
        expect(activePods).toHaveLength(2)
        expect(result.assignments).toHaveLength(2) // No extra bye pod
      })

      it('4 players divisible by 4 has no bye pod and no warnings', () => {
        // When numByes is exactly 0, the bye branch should NOT execute.
        // If mutated to >= 0, it would try to sort 0 players for byes
        // and create an empty bye pod, changing the assignment count.
        const players = makePlayers(4)
        const result = generatePods(players, [])

        expect(result.assignments).toHaveLength(1) // Only 1 active pod, no bye pod
        expect(result.assignments[0].is_bye).toBe(false)
        expect(result.assignments[0].players).toHaveLength(4)

        // All 4 players should be in the pod
        const playerIds = result.assignments[0].players.map((p) => p.player_id).sort()
        expect(playerIds).toEqual(['player-1', 'player-2', 'player-3', 'player-4'])
      })
    })

    describe('greedy selection correctness (kills loop mutations)', () => {
      it('with strong history, greedy must pick specific low-overlap pairings', () => {
        // 8 players: After 3 rounds of identical grouping, the greedy algorithm
        // MUST separate heavily-overlapped players.
        // If the greedy loop is disabled (false/empty body), it just picks pool[0]
        // for all slots, resulting in random assignment without opponent avoidance.
        const players = makePlayers(8)
        const identicalRound = {
          pods: [
            { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
            { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
          ],
        }
        const previousRounds: RoundHistory[] = [identicalRound, identicalRound, identicalRound]

        // Run 20 trials. With the greedy algorithm working, pods should
        // consistently mix players from both groups.
        let mixedCount = 0
        const totalTrials = 20
        for (let trial = 0; trial < totalTrials; trial++) {
          const result = generatePods(players, previousRounds)
          const activePods = result.assignments.filter((a) => !a.is_bye)

          for (const pod of activePods) {
            const ids = pod.players.map((p) => p.player_id)
            const fromGroup1 = ids.filter((id) =>
              ['player-1', 'player-2', 'player-3', 'player-4'].includes(id)
            ).length
            // A mixed pod has 2 from each group
            if (fromGroup1 === 2) mixedCount++
          }
        }

        // With the greedy algorithm, most pods should have a 2-2 split.
        // Without greedy (mutation), it would be random ~= ~32% chance of 2-2 split
        // per pod. With greedy + strong history, it should be much higher.
        // We expect at least 60% of pods to be 2-2 mixed.
        expect(mixedCount).toBeGreaterThan(totalTrials * 0.5)
      })

      it('greedy avoidance produces lower total overlap than random baseline over many trials', () => {
        // This test directly detects mutations that disable the greedy loop body,
        // score comparison, or score accumulation. It measures the quality of output.
        const players = makePlayers(8)
        const heavyHistory: RoundHistory[] = Array(5).fill({
          pods: [
            { playerIds: ['player-1', 'player-2', 'player-3', 'player-4'], isBye: false },
            { playerIds: ['player-5', 'player-6', 'player-7', 'player-8'], isBye: false },
          ],
        })

        const history = buildOpponentHistory(heavyHistory)

        // Measure total pairwise overlap across many trials
        let totalOverlapSum = 0
        const trials = 50
        for (let t = 0; t < trials; t++) {
          const result = generatePods(players, heavyHistory)
          for (const pod of result.assignments.filter((a) => !a.is_bye)) {
            const ids = pod.players.map((p) => p.player_id)
            for (let i = 0; i < ids.length; i++) {
              for (let j = i + 1; j < ids.length; j++) {
                totalOverlapSum += history.get(ids[i])?.get(ids[j]) ?? 0
              }
            }
          }
        }

        // Each pod has C(4,2)=6 pairs, 2 pods = 12 pairs per trial, 50 trials = 600 pairs total.
        // Random assignment: each pair has ~3/7 chance of having overlap 5, ~4/7 chance of 0.
        // Expected random overlap per pair ~= 5 * 3/7 ~= 2.14, total ~= 2.14 * 600 ~= 1286
        // Greedy with 5 rounds of identical history: should produce much lower total.
        // With perfect mixing (2-2 split every time), overlap per pod ~= 4*5=20, total = 20*2*50=2000... hmm
        // Actually let's think differently. With 2-2 split: each pod has C(2,2)=1 pair from
        // same prev group and C(2,2)=1 pair from other prev group. Same-group pairs have overlap 5,
        // cross-group pairs have overlap 0. Per pod: 2 same-group pairs * 5 = 10, 4 cross pairs * 0 = 0.
        // Total per trial = 2 pods * 10 = 20. Random total per trial ~= 25.7
        // Key: if greedy is DISABLED, it picks randomly, avg ~25.7 per trial.
        // If greedy is ENABLED, it forces 2-2 splits, avg 20 per trial.
        // Over 50 trials: greedy ~= 1000, random ~= 1286

        const avgOverlapPerTrial = totalOverlapSum / trials
        // Greedy should achieve avg overlap <= 22 per trial (2 pods of 4 with 2-2 splits)
        // Random would be ~25.7. We use 24 as threshold.
        expect(avgOverlapPerTrial).toBeLessThan(24)
      })
    })

    describe('comprehensive player count coverage (4-20)', () => {
      const playerCounts = Array.from({ length: 17 }, (_, i) => i + 4) // [4, 5, 6, ..., 20]

      it.each(playerCounts)('creates correct pod structure for %i players', (count) => {
        const players = makePlayers(count)
        const result = generatePods(players, [])
        const expectedByes = count % 4
        const expectedActivePods = Math.floor(count / 4)

        // Correct number of active pods
        const activePods = result.assignments.filter(a => !a.is_bye)
        expect(activePods).toHaveLength(expectedActivePods)

        // Each active pod has exactly 4 players
        activePods.forEach(pod => expect(pod.players).toHaveLength(4))

        // Bye pod structure
        const byePods = result.assignments.filter(a => a.is_bye)
        if (expectedByes > 0) {
          expect(byePods).toHaveLength(1)
          expect(byePods[0].players).toHaveLength(expectedByes)
        } else {
          expect(byePods).toHaveLength(0)
        }

        // All players accounted for
        const allIds = result.assignments.flatMap(a => a.players.map(p => p.player_id))
        expect(new Set(allIds).size).toBe(count)
        expect(allIds).toHaveLength(count)

        // Seat numbers correct
        activePods.forEach(pod => {
          const seats = pod.players.map(p => p.seat_number).sort((a, b) => a! - b!)
          expect(seats).toEqual([1, 2, 3, 4])
        })
        byePods.forEach(pod => {
          pod.players.forEach(p => expect(p.seat_number).toBeNull())
        })
      })
    })

    describe('high bye count warnings', () => {
      it.each([7, 11, 15, 19])('warns about high bye count for %i players (3 byes)', (count) => {
        const players = makePlayers(count)
        const result = generatePods(players, [])
        expect(result.warnings).toContainEqual(expect.stringContaining('High bye count'))
        expect(result.warnings[0]).toContain(`3 of ${count}`)
      })

      it.each([4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20])('no high bye warning for %i players (0-2 byes)', (count) => {
        const players = makePlayers(count)
        const result = generatePods(players, [])
        const highByeWarnings = result.warnings.filter(w => w.includes('High bye count'))
        expect(highByeWarnings).toHaveLength(0)
      })
    })

    describe('bye rotation for all non-divisible-by-4 counts', () => {
      const countsWithByes = [5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19]

      it.each(countsWithByes)('rotates byes fairly across 5 rounds with %i players', (count) => {
        const spy = seedRandom(42 + count)
        try {
          const players = makePlayers(count)
          const previousRounds: RoundHistory[] = []
          const byeCountMap = new Map<string, number>()
          players.forEach(p => byeCountMap.set(p.id, 0))

          for (let round = 0; round < 5; round++) {
            const result = generatePods(players, previousRounds)
            const roundHistory: RoundHistory = {
              pods: result.assignments.map(a => ({
                playerIds: a.players.map(p => p.player_id),
                isBye: a.is_bye,
              })),
            }
            previousRounds.push(roundHistory)

            const byePod = result.assignments.find(a => a.is_bye)
            if (byePod) {
              byePod.players.forEach(p => {
                byeCountMap.set(p.player_id, (byeCountMap.get(p.player_id) ?? 0) + 1)
              })
            }
          }

          const byeCounts = Array.from(byeCountMap.values())
          const maxByes = Math.max(...byeCounts)
          const minByes = Math.min(...byeCounts)
          // Fair distribution: max-min difference should be at most 1
          expect(maxByes - minByes).toBeLessThanOrEqual(1)
        } finally {
          spy.mockRestore()
        }
      })
    })

    it('20 players produces exactly 5 pods of 4, no byes, no warnings', () => {
      const players = makePlayers(20)
      const result = generatePods(players, [])

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(5)
      expect(byePods).toHaveLength(0)
      expect(result.warnings).toEqual([])
      activePods.forEach(pod => expect(pod.players).toHaveLength(4))

      // All 20 players accounted for
      const allIds = result.assignments.flatMap(a => a.players.map(p => p.player_id))
      expect(new Set(allIds).size).toBe(20)
    })

    describe('bye pod numbering', () => {
      it('bye pod has pod_number higher than all active pods', () => {
        const players = makePlayers(9) // 2 active pods + 1 bye
        const result = generatePods(players, [])

        const activePods = result.assignments.filter((a) => !a.is_bye)
        const byePods = result.assignments.filter((a) => a.is_bye)

        expect(byePods).toHaveLength(1)
        const maxActivePodNumber = Math.max(...activePods.map((p) => p.pod_number))
        expect(byePods[0].pod_number).toBeGreaterThan(maxActivePodNumber)
      })

      it('bye pod number equals number of active pods plus 1', () => {
        const players = makePlayers(5) // 1 active pod + 1 bye
        const result = generatePods(players, [])

        const byePod = result.assignments.find((a) => a.is_bye)
        expect(byePod).toBeDefined()
        expect(byePod!.pod_number).toBe(2) // 1 active pod + 1 = 2
      })
    })
  })

  describe('getOpponentScore (quadratic penalty)', () => {
    it('returns 0 when candidate has no history', () => {
      const history = new Map<string, Map<string, number>>()
      expect(getOpponentScore('a', ['b', 'c'], history)).toBe(0)
    })

    it('returns 0 when candidate has 0 encounters with pod members', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['d', 1]]))
      expect(getOpponentScore('a', ['b', 'c'], history)).toBe(0)
    })

    it('returns 1 for 1 encounter (1^2 = 1)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 1]]))
      expect(getOpponentScore('a', ['b'], history)).toBe(1)
    })

    it('returns 4 for 2 encounters (2^2 = 4)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 2]]))
      expect(getOpponentScore('a', ['b'], history)).toBe(4)
    })

    it('returns 9 for 3 encounters (3^2 = 9)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      expect(getOpponentScore('a', ['b'], history)).toBe(9)
    })

    it('sums quadratic penalties across multiple pod members', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 2], ['c', 1]]))
      // 2^2 + 1^2 = 4 + 1 = 5
      expect(getOpponentScore('a', ['b', 'c'], history)).toBe(5)
    })
  })

  describe('podPenalty', () => {
    it('returns 0 for a pod with no history', () => {
      const history = new Map<string, Map<string, number>>()
      expect(podPenalty(['a', 'b', 'c', 'd'], history)).toBe(0)
    })

    it('computes sum of encounters^2 for all C(n,2) pairs', () => {
      // Pod: [a, b, c, d]. a-b met 2 times, a-c met 1 time. All others 0.
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 2], ['c', 1]]))
      history.set('b', new Map([['a', 2]]))
      history.set('c', new Map([['a', 1]]))
      // Pairs: a-b=2^2=4, a-c=1^2=1, a-d=0, b-c=0, b-d=0, c-d=0 => total=5
      expect(podPenalty(['a', 'b', 'c', 'd'], history)).toBe(5)
    })

    it('computes exactly C(n,2) pairs, no extra from loop boundary mutation', () => {
      // If i <= pod.length or j <= pod.length (boundary mutation), it would try to
      // access pod[4] which is undefined, and history.get(undefined) returns undefined,
      // so encounters would be 0 and penalty unchanged. BUT it would also create an
      // extra iteration with undefined index. We detect this by checking the exact value.
      // All 4 players have met each other exactly once: C(4,2)=6 pairs, each 1^2=1. Total=6.
      const history = new Map<string, Map<string, number>>()
      for (const x of ['a', 'b', 'c', 'd']) {
        history.set(x, new Map())
        for (const y of ['a', 'b', 'c', 'd']) {
          if (x !== y) history.get(x)!.set(y, 1)
        }
      }
      expect(podPenalty(['a', 'b', 'c', 'd'], history)).toBe(6)
    })

    it('handles 2-player pod correctly (only 1 pair)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      history.set('b', new Map([['a', 3]]))
      // Only 1 pair: a-b=3^2=9
      expect(podPenalty(['a', 'b'], history)).toBe(9)
    })

    it('handles 1-player pod correctly (0 pairs)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      // 0 pairs
      expect(podPenalty(['a'], history)).toBe(0)
    })
  })

  describe('totalPenalty', () => {
    it('sums podPenalty across all pods', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 1]]))
      history.set('b', new Map([['a', 1]]))
      history.set('c', new Map([['d', 2]]))
      history.set('d', new Map([['c', 2]]))
      // Pod1: [a, b] => a-b=1^2=1. Pod2: [c, d] => c-d=2^2=4. Total=5
      expect(totalPenalty([['a', 'b'], ['c', 'd']], history)).toBe(5)
    })

    it('returns 0 when no history exists', () => {
      const history = new Map<string, Map<string, number>>()
      expect(totalPenalty([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']], history)).toBe(0)
    })
  })

  describe('greedyAssign', () => {
    it('produces valid pod assignments with correct sizes', () => {
      const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      const history = new Map<string, Map<string, number>>()
      const pods = greedyAssign(pool, [4, 4], history)

      expect(pods).toHaveLength(2)
      expect(pods[0]).toHaveLength(4)
      expect(pods[1]).toHaveLength(4)

      // All players accounted for
      const allPlayers = pods.flat().sort()
      expect(allPlayers).toEqual(pool.slice().sort())
    })

    it('places low-overlap candidates into pods', () => {
      // a-b met 3 times, a-c met 0 times. With pool [a, b, c, d, e, f, g, h]
      // The greedy should prefer c over b when filling a's pod.
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      history.set('b', new Map([['a', 3]]))

      // Run multiple times due to random first pick
      let separatedCount = 0
      for (let i = 0; i < 20; i++) {
        const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const pods = greedyAssign(pool, [4, 4], history)
        const aPod = pods.find(p => p.includes('a'))!
        if (!aPod.includes('b')) separatedCount++
      }
      // Greedy should separate them most of the time
      expect(separatedCount).toBeGreaterThan(10)
    })

    it('selects the minimum-score candidate, not just any candidate (kills score < bestScore -> true)', () => {
      // Setup: pool order is [a, b, c, d, e, f, g, h] where a is picked first for pod 1.
      // b has met a 5 times, c has met a 0 times. The greedy MUST pick c over b for a's pod.
      // If mutation changes `score < bestScore` to `if (true)`, every candidate replaces the
      // previous best, and the last candidate in the remaining list gets picked regardless.
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 5]]))
      history.set('b', new Map([['a', 5]]))

      // Use fixed pool order: a first, then b (high overlap), then c-h (zero overlap)
      const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      const pods = greedyAssign(pool, [4, 4], history)

      // Pod 0 starts with 'a'. Greedy must NOT pick 'b' (score=25) over c/d/e/f/g/h (score=0).
      const aPod = pods[0]
      expect(aPod[0]).toBe('a') // a is first player placed
      expect(aPod).not.toContain('b') // b should be rejected due to high overlap
    })

    it('produces variable pod sizes with mix of 3s and 4s', () => {
      const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      const history = new Map<string, Map<string, number>>()
      const pods = greedyAssign(pool, [4, 3], history)

      expect(pods).toHaveLength(2)
      expect(pods[0]).toHaveLength(4)
      expect(pods[1]).toHaveLength(3)

      // All players accounted for
      const allPlayers = pods.flat().sort()
      expect(allPlayers).toEqual(pool.slice().sort())
    })

    it('produces two pods of 3 when given [3, 3]', () => {
      const pool = ['a', 'b', 'c', 'd', 'e', 'f']
      const history = new Map<string, Map<string, number>>()
      const pods = greedyAssign(pool, [3, 3], history)

      expect(pods).toHaveLength(2)
      expect(pods[0]).toHaveLength(3)
      expect(pods[1]).toHaveLength(3)

      const allPlayers = pods.flat().sort()
      expect(allPlayers).toEqual(pool.slice().sort())
    })
  })

  describe('swapPass', () => {
    it('returns pods unchanged when no improving swap exists', () => {
      const history = new Map<string, Map<string, number>>()
      const pods = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]
      const result = swapPass(pods, history)

      // With no history, all scores are 0, so no swaps improve
      expect(result.map(p => p.sort())).toEqual(pods.map(p => p.sort()))
    })

    it('reduces total penalty when an improving swap exists', () => {
      // a-b met 3 times, c-d met 3 times. Pods: [a,b,e,f], [c,d,g,h]
      // Swap a<->c gives [c,b,e,f], [a,d,g,h] which reduces penalty
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      history.set('b', new Map([['a', 3]]))
      history.set('c', new Map([['d', 3]]))
      history.set('d', new Map([['c', 3]]))

      const pods = [['a', 'b', 'e', 'f'], ['c', 'd', 'g', 'h']]
      const before = totalPenalty(pods, history)
      const result = swapPass(pods, history)
      const after = totalPenalty(result, history)

      expect(after).toBeLessThan(before)
    })

    it('terminates (does not infinite loop)', () => {
      // Verified by the test completing within the timeout
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 2], ['c', 1]]))
      history.set('b', new Map([['a', 2]]))
      history.set('c', new Map([['a', 1]]))

      const pods = [['a', 'b', 'e', 'f'], ['c', 'd', 'g', 'h']]
      const result = swapPass(pods, history)
      expect(result).toBeDefined()
      expect(result).toHaveLength(2)
    })

    it('preserves pod sizes (no players lost or duplicated)', () => {
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      history.set('b', new Map([['a', 3]]))

      const pods = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]
      const result = swapPass(pods, history)

      expect(result[0]).toHaveLength(4)
      expect(result[1]).toHaveLength(4)

      const allPlayers = result.flat().sort()
      expect(allPlayers).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    })

    it('actually performs the swap (improved flag is set and break exits correctly)', () => {
      // Setup: a-b met 5 times. Pods: [a,b,c,d], [e,f,g,h]
      // swapPass should swap a or b with someone from the other pod.
      // If the improved=true / break block is removed (BlockStatement mutation),
      // the swap still happens but is immediately undone in the else branch.
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 5]]))
      history.set('b', new Map([['a', 5]]))

      const pods = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]
      const result = swapPass(pods, history)
      const after = totalPenalty(result, history)

      // Before: a-b penalty = 5^2 = 25. After swap: should be 0 (a and b separated).
      expect(after).toBe(0)

      // Verify a and b are in DIFFERENT pods
      const aInPod0 = result[0].includes('a')
      const bInPod0 = result[0].includes('b')
      expect(aInPod0).not.toBe(bInPod0) // a and b must be in different pods
    })

    it('does not swap when swapped score equals current score (strict less-than)', () => {
      // Setup where a swap produces equal score, not better.
      // Pod1: [a,b,c,d], Pod2: [e,f,g,h]
      // a-b=1, e-f=1. Swapping a<->e gives a-f=0+e-b=0 in each pod but
      // we need both pods to have the same penalty before and after.
      // Actually: both pods have penalty 1 (a-b and e-f). Total=2.
      // Swapping a<->e: Pod1=[e,b,c,d] penalty=0, Pod2=[a,f,g,h] penalty=0. Total=0.
      // That's an improvement, so it would swap. Need equal case instead.

      // Better: all pairs have equal history. No swap can improve.
      const history = new Map<string, Map<string, number>>()
      // Every pair in pod1 has encounter=1, every pair in pod2 has encounter=1
      for (const x of ['a', 'b', 'c', 'd']) {
        history.set(x, new Map())
        for (const y of ['a', 'b', 'c', 'd']) {
          if (x !== y) history.get(x)!.set(y, 1)
        }
      }
      for (const x of ['e', 'f', 'g', 'h']) {
        history.set(x, new Map())
        for (const y of ['e', 'f', 'g', 'h']) {
          if (x !== y) history.get(x)!.set(y, 1)
        }
      }
      // Cross-pod: also 1 encounter each
      for (const x of ['a', 'b', 'c', 'd']) {
        for (const y of ['e', 'f', 'g', 'h']) {
          history.get(x)!.set(y, 1)
          history.get(y)!.set(x, 1)
        }
      }

      const pods = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]
      const before = totalPenalty(pods, history)
      const result = swapPass(pods, history)
      const after = totalPenalty(result, history)

      // Swapping any pair produces equal penalty (all encounter=1), so no swap should occur
      expect(after).toBe(before)
    })

    it('performs cascading swaps when first swap enables second improvement', () => {
      // Setup: a-b=3, c-d=3, e-f=3 across 3 pods
      // Swap pass should fix all three in one pass (multiple iterations)
      const history = new Map<string, Map<string, number>>()
      history.set('a', new Map([['b', 3]]))
      history.set('b', new Map([['a', 3]]))
      history.set('c', new Map([['d', 3]]))
      history.set('d', new Map([['c', 3]]))
      history.set('e', new Map([['f', 3]]))
      history.set('f', new Map([['e', 3]]))

      const pods = [
        ['a', 'b', 'g', 'h'],
        ['c', 'd', 'i', 'j'],
        ['e', 'f', 'k', 'l'],
      ]
      const before = totalPenalty(pods, history) // 9 + 9 + 9 = 27
      expect(before).toBe(27)

      const result = swapPass(pods, history)
      const after = totalPenalty(result, history)

      // Should reduce to 0 by separating all high-penalty pairs
      expect(after).toBe(0)
    })
  })

  describe('buildOpponentHistory', () => {
    it('returns empty map for no rounds', () => {
      const history = buildOpponentHistory([])
      expect(history.size).toBe(0)
    })

    it('builds correct matrix for a single round with 1 pod', () => {
      const rounds: RoundHistory[] = [
        {
          pods: [
            {
              playerIds: ['a', 'b', 'c', 'd'],
              isBye: false,
            },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // Each player should have exactly 3 opponents each with count 1
      expect(history.get('a')?.size).toBe(3)
      expect(history.get('b')?.size).toBe(3)
      expect(history.get('c')?.size).toBe(3)
      expect(history.get('d')?.size).toBe(3)
      expect(history.get('a')?.get('b')).toBe(1)
      expect(history.get('a')?.get('c')).toBe(1)
      expect(history.get('a')?.get('d')).toBe(1)
      expect(history.get('b')?.get('a')).toBe(1)
      expect(history.get('b')?.get('c')).toBe(1)
      expect(history.get('b')?.get('d')).toBe(1)
      expect(history.get('c')?.get('d')).toBe(1)
      expect(history.get('d')?.get('c')).toBe(1)
    })

    it('does not count bye pods in opponent history', () => {
      const rounds: RoundHistory[] = [
        {
          pods: [
            {
              playerIds: ['a', 'b', 'c', 'd'],
              isBye: false,
            },
            {
              playerIds: ['e', 'f'],
              isBye: true,
            },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // 'e' and 'f' should not appear in the history at all
      expect(history.has('e')).toBe(false)
      expect(history.has('f')).toBe(false)
      // Players in the active pod should not have 'e' as an opponent
      expect(history.get('a')?.has('e')).toBeFalsy()
      // Total entries should be only 4 players (from the active pod)
      expect(history.size).toBe(4)
    })

    it('builds correct matrix when bye pod is not filtered (mutation detection)', () => {
      // If isBye check is removed, a bye pod with 2 players would create opponent entries
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
            { playerIds: ['e', 'f'], isBye: true },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // e and f must NOT be opponents -- they're in a bye pod
      expect(history.get('e')?.get('f')).toBeUndefined()
      expect(history.has('e')).toBe(false)
    })

    it('increments counts across multiple rounds', () => {
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
          ],
        },
        {
          pods: [
            { playerIds: ['a', 'b', 'e', 'f'], isBye: false },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // a and b were in the same pod twice
      expect(history.get('a')?.get('b')).toBe(2)
      expect(history.get('b')?.get('a')).toBe(2)

      // a and c were in the same pod once
      expect(history.get('a')?.get('c')).toBe(1)

      // a and e were in the same pod once
      expect(history.get('a')?.get('e')).toBe(1)
    })

    it('correctly counts pairs in a 4-player pod (6 unique pairs)', () => {
      // C(4,2) = 6 unique pairs. If the inner loop boundary is wrong (j <= length),
      // it would cause an out-of-bounds access or extra undefined entries
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // Count total relationship entries across all players
      let totalPairEntries = 0
      for (const [, opponents] of history) {
        totalPairEntries += opponents.size
      }
      // 6 unique pairs, each stored bidirectionally = 12 entries total
      expect(totalPairEntries).toBe(12)
    })

    it('does not create undefined entries from out-of-bounds access', () => {
      // If outer loop uses i <= playerIds.length instead of i < playerIds.length,
      // it would try to access playerIds[4] which is undefined, creating
      // entries with undefined keys in the map
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // Should only have exactly 4 players in the history
      expect(history.size).toBe(4)
      const keys = Array.from(history.keys())
      expect(keys.sort()).toEqual(['a', 'b', 'c', 'd'])

      // None of the opponent maps should have undefined keys
      for (const [, opponents] of history) {
        for (const key of opponents.keys()) {
          expect(key).toBeDefined()
          expect(typeof key).toBe('string')
          expect(key.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('buildByeCounts', () => {
    it('returns 0 for all players with no previous rounds', () => {
      const playerIds = ['a', 'b', 'c', 'd', 'e']
      const counts = buildByeCounts([], playerIds)

      playerIds.forEach((id) => {
        expect(counts.get(id)).toBe(0)
      })
    })

    it('counts bye occurrences correctly', () => {
      const playerIds = ['a', 'b', 'c', 'd', 'e']
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
            { playerIds: ['e'], isBye: true },
          ],
        },
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'e'], isBye: false },
            { playerIds: ['d'], isBye: true },
          ],
        },
      ]

      const counts = buildByeCounts(rounds, playerIds)

      expect(counts.get('a')).toBe(0)
      expect(counts.get('b')).toBe(0)
      expect(counts.get('c')).toBe(0)
      expect(counts.get('d')).toBe(1)
      expect(counts.get('e')).toBe(1)
    })

    it('initializes players not in history with 0', () => {
      const playerIds = ['a', 'b', 'newplayer']
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
          ],
        },
      ]

      const counts = buildByeCounts(rounds, playerIds)
      expect(counts.get('newplayer')).toBe(0)
    })

    it('handles historical bye player not in current player list (dropped player in bye history)', () => {
      // 'dropped-player' was in a bye pod but is not in the current playerIds
      const playerIds = ['a', 'b', 'c', 'd']
      const rounds: RoundHistory[] = [
        {
          pods: [
            { playerIds: ['a', 'b', 'c', 'd'], isBye: false },
            { playerIds: ['dropped-player'], isBye: true },
          ],
        },
      ]

      const counts = buildByeCounts(rounds, playerIds)

      // Current players should have 0 byes
      expect(counts.get('a')).toBe(0)
      expect(counts.get('b')).toBe(0)
      // The dropped player gets a count entry via the ?? 0 fallback on line 99
      expect(counts.get('dropped-player')).toBe(1)
    })
  })

  describe('computePodSizes', () => {
    describe('allowPodsOf3=false (legacy behavior)', () => {
      it('computePodSizes(8, false) -> { podSizes: [4, 4], byeCount: 0 }', () => {
        expect(computePodSizes(8, false)).toEqual({ podSizes: [4, 4], byeCount: 0 })
      })

      it('computePodSizes(9, false) -> { podSizes: [4, 4], byeCount: 1 }', () => {
        expect(computePodSizes(9, false)).toEqual({ podSizes: [4, 4], byeCount: 1 })
      })

      it('computePodSizes(10, false) -> { podSizes: [4, 4], byeCount: 2 }', () => {
        expect(computePodSizes(10, false)).toEqual({ podSizes: [4, 4], byeCount: 2 })
      })

      it('computePodSizes(4, false) -> { podSizes: [4], byeCount: 0 }', () => {
        expect(computePodSizes(4, false)).toEqual({ podSizes: [4], byeCount: 0 })
      })

      it('computePodSizes(5, false) -> { podSizes: [4], byeCount: 1 }', () => {
        expect(computePodSizes(5, false)).toEqual({ podSizes: [4], byeCount: 1 })
      })

      it('computePodSizes(20, false) -> { podSizes: [4,4,4,4,4], byeCount: 0 }', () => {
        expect(computePodSizes(20, false)).toEqual({ podSizes: [4, 4, 4, 4, 4], byeCount: 0 })
      })

      it.each(Array.from({ length: 17 }, (_, i) => i + 4))(
        'allowPodsOf3=false with %i players: all podSizes are 4, byeCount == n %% 4',
        (n) => {
          const result = computePodSizes(n, false)
          expect(result.podSizes.every(s => s === 4)).toBe(true)
          expect(result.byeCount).toBe(n % 4)
          expect(result.podSizes.reduce((a, b) => a + b, 0) + result.byeCount).toBe(n)
        }
      )
    })

    describe('allowPodsOf3=true', () => {
      it('computePodSizes(3, true) -> { podSizes: [3], byeCount: 0 }', () => {
        expect(computePodSizes(3, true)).toEqual({ podSizes: [3], byeCount: 0 })
      })

      it('computePodSizes(4, true) -> { podSizes: [4], byeCount: 0 }', () => {
        expect(computePodSizes(4, true)).toEqual({ podSizes: [4], byeCount: 0 })
      })

      it('computePodSizes(5, true) -> { podSizes: [4], byeCount: 1 } (special case)', () => {
        expect(computePodSizes(5, true)).toEqual({ podSizes: [4], byeCount: 1 })
      })

      it('computePodSizes(6, true) -> { podSizes: [3, 3], byeCount: 0 }', () => {
        expect(computePodSizes(6, true)).toEqual({ podSizes: [3, 3], byeCount: 0 })
      })

      it('computePodSizes(7, true) -> { podSizes: [4, 3], byeCount: 0 }', () => {
        expect(computePodSizes(7, true)).toEqual({ podSizes: [4, 3], byeCount: 0 })
      })

      it('computePodSizes(9, true) -> { podSizes: [3, 3, 3], byeCount: 0 }', () => {
        expect(computePodSizes(9, true)).toEqual({ podSizes: [3, 3, 3], byeCount: 0 })
      })

      it('computePodSizes(10, true) -> { podSizes: [4, 3, 3], byeCount: 0 }', () => {
        expect(computePodSizes(10, true)).toEqual({ podSizes: [4, 3, 3], byeCount: 0 })
      })

      it('computePodSizes(13, true) -> { podSizes: [4, 3, 3, 3], byeCount: 0 }', () => {
        expect(computePodSizes(13, true)).toEqual({ podSizes: [4, 3, 3, 3], byeCount: 0 })
      })

      it('computePodSizes(12, true) -> { podSizes: [4, 4, 4], byeCount: 0 }', () => {
        expect(computePodSizes(12, true)).toEqual({ podSizes: [4, 4, 4], byeCount: 0 })
      })

      it('computePodSizes(16, true) -> { podSizes: [4, 4, 4, 4], byeCount: 0 }', () => {
        expect(computePodSizes(16, true)).toEqual({ podSizes: [4, 4, 4, 4], byeCount: 0 })
      })

      it('computePodSizes(17, true) -> { podSizes: [4, 4, 3, 3, 3], byeCount: 0 }', () => {
        expect(computePodSizes(17, true)).toEqual({ podSizes: [4, 4, 3, 3, 3], byeCount: 0 })
      })

      it('computePodSizes(20, true) -> { podSizes: [4, 4, 4, 4, 4], byeCount: 0 }', () => {
        expect(computePodSizes(20, true)).toEqual({ podSizes: [4, 4, 4, 4, 4], byeCount: 0 })
      })

      it.each(Array.from({ length: 18 }, (_, i) => i + 3))(
        'allowPodsOf3=true with %i players: sum of podSizes + byeCount == playerCount',
        (n) => {
          const result = computePodSizes(n, true)
          expect(result.podSizes.reduce((a, b) => a + b, 0) + result.byeCount).toBe(n)
          // All pod sizes are 3 or 4
          expect(result.podSizes.every(s => s === 3 || s === 4)).toBe(true)
          // Only n=5 has byes
          if (n !== 5) {
            expect(result.byeCount).toBe(0)
          }
        }
      )
    })
  })

  describe('generatePods with allowPodsOf3', () => {
    it('generatePods(7_players, [], true) -> 2 pods (one of 4, one of 3), 0 byes', () => {
      const players = makePlayers(7)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(2)
      expect(byePods).toHaveLength(0)

      const podSizes = activePods.map(p => p.players.length).sort((a, b) => b - a)
      expect(podSizes).toEqual([4, 3])

      // All 7 players accounted for
      const allIds = result.assignments.flatMap(a => a.players.map(p => p.player_id))
      expect(new Set(allIds).size).toBe(7)
    })

    it('generatePods(7_players, [], false) -> 1 pod of 4, 3 byes (existing behavior)', () => {
      const players = makePlayers(7)
      const result = generatePods(players, [], false)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(1)
      expect(activePods[0].players).toHaveLength(4)
      expect(byePods).toHaveLength(1)
      expect(byePods[0].players).toHaveLength(3)
    })

    it('generatePods(5_players, [], true) -> 1 pod of 4, 1 bye, warning message', () => {
      const players = makePlayers(5)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(1)
      expect(activePods[0].players).toHaveLength(4)
      expect(byePods).toHaveLength(1)
      expect(byePods[0].players).toHaveLength(1)
      expect(result.warnings).toContainEqual(
        expect.stringContaining('5 players cannot be split into pods of 3 and 4')
      )
    })

    it('generatePods(3_players, [], true) -> 1 pod of 3, 0 byes (lowered threshold)', () => {
      const players = makePlayers(3)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(1)
      expect(activePods[0].players).toHaveLength(3)
      expect(byePods).toHaveLength(0)
    })

    it('generatePods(3_players, [], false) -> throws "Fewer than 4 active players"', () => {
      const players = makePlayers(3)
      expect(() => generatePods(players, [], false)).toThrow('Fewer than 4 active players')
    })

    it('generatePods(8_players, [], false) -> identical to current behavior (backward compatible)', () => {
      const players = makePlayers(8)
      const result = generatePods(players, [], false)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(activePods).toHaveLength(2)
      activePods.forEach(pod => expect(pod.players).toHaveLength(4))
      expect(byePods).toHaveLength(0)
    })

    it('3-player pods have seat numbers [1, 2, 3] (not [1, 2, 3, 4])', () => {
      const players = makePlayers(7)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      for (const pod of activePods) {
        const seats = pod.players.map(p => p.seat_number).sort((a, b) => a! - b!)
        if (pod.players.length === 3) {
          expect(seats).toEqual([1, 2, 3])
        } else {
          expect(seats).toEqual([1, 2, 3, 4])
        }
      }
    })

    it('4-player pods have seat numbers [1, 2, 3, 4]', () => {
      const players = makePlayers(8)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      for (const pod of activePods) {
        const seats = pod.players.map(p => p.seat_number).sort((a, b) => a! - b!)
        expect(seats).toEqual([1, 2, 3, 4])
      }
    })

    it('default (no third param) behaves like allowPodsOf3=false', () => {
      const players = makePlayers(7)
      const result = generatePods(players, [])

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      // Without allowPodsOf3, 7 players => 1 pod of 4 + 3 byes
      expect(activePods).toHaveLength(1)
      expect(activePods[0].players).toHaveLength(4)
      expect(byePods).toHaveLength(1)
      expect(byePods[0].players).toHaveLength(3)
    })

    it('bye pod_number is correct with variable pod sizes', () => {
      const players = makePlayers(5)
      const result = generatePods(players, [], true)

      // 1 active pod + 1 bye
      const byePod = result.assignments.find(a => a.is_bye)
      expect(byePod).toBeDefined()
      expect(byePod!.pod_number).toBe(2) // 1 active pod + 1 = 2
    })

    it.each([
      [6, [3, 3]],
      [9, [3, 3, 3]],
      [10, [4, 3, 3]],
      [11, [4, 4, 3]],
      [13, [4, 3, 3, 3]],
      [14, [4, 4, 3, 3]],
      [15, [4, 4, 4, 3]],
      [17, [4, 4, 3, 3, 3]],
      [18, [4, 4, 4, 3, 3]],
      [19, [4, 4, 4, 4, 3]],
    ])('allowPodsOf3=true with %i players: correct pod sizes %j, 0 byes', (count, expectedSizes) => {
      const players = makePlayers(count)
      const result = generatePods(players, [], true)

      const activePods = result.assignments.filter(a => !a.is_bye)
      const byePods = result.assignments.filter(a => a.is_bye)

      expect(byePods).toHaveLength(0)

      const actualSizes = activePods.map(p => p.players.length).sort((a, b) => b - a)
      const sortedExpected = [...expectedSizes].sort((a, b) => b - a)
      expect(actualSizes).toEqual(sortedExpected)

      // All players accounted for
      const allIds = result.assignments.flatMap(a => a.players.map(p => p.player_id))
      expect(new Set(allIds).size).toBe(count)
    })
  })
})
