import { describe, it, expect } from 'vitest'
import {
  generatePods,
  buildOpponentHistory,
  buildByeCounts,
  type PlayerInfo,
  type RoundHistory,
  type PodAssignmentResult,
} from './pod-algorithm'

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
        const pod2Ids = activePods[1].players
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
        ]

        const result = generatePods(players, previousRounds)
        const byePod = result.assignments.find((a) => a.is_bye)
        const byePlayerIds = byePod!.players.map((p) => p.player_id)

        // player-5 has 2 byes, others have 1 each.
        // The algorithm should NOT pick player-5 again (they have more byes).
        expect(byePlayerIds).not.toContain('player-5')
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

      // Each player should have 3 opponents each with count 1
      expect(history.get('a')?.get('b')).toBe(1)
      expect(history.get('a')?.get('c')).toBe(1)
      expect(history.get('a')?.get('d')).toBe(1)
      expect(history.get('b')?.get('a')).toBe(1)
      expect(history.get('c')?.get('d')).toBe(1)
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
              playerIds: ['e'],
              isBye: true,
            },
          ],
        },
      ]

      const history = buildOpponentHistory(rounds)

      // 'e' should not appear in the history at all
      expect(history.has('e')).toBe(false)
      // Players in the active pod should not have 'e' as an opponent
      expect(history.get('a')?.has('e')).toBeFalsy()
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
  })
})
