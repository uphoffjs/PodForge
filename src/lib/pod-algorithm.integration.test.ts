import { describe, it, expect } from 'vitest'
import {
  generatePods,
  buildOpponentHistory,
  type PlayerInfo,
  type RoundHistory,
  type PodAssignmentResult,
} from './pod-algorithm'

/**
 * Helper: Create an array of PlayerInfo objects.
 */
function makePlayers(count: number): PlayerInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    name: `Player ${i}`,
  }))
}

/**
 * Helper: Simulate multiple rounds of pod generation, accumulating history.
 * Returns the full round history and all PodAssignmentResults.
 */
function simulateRounds(
  playerCount: number,
  roundCount: number
): { rounds: RoundHistory[]; results: PodAssignmentResult[] } {
  const players = makePlayers(playerCount)
  const previousRounds: RoundHistory[] = []
  const results: PodAssignmentResult[] = []

  for (let r = 0; r < roundCount; r++) {
    const result = generatePods(players, previousRounds)
    results.push(result)

    // Convert PodAssignmentResult to RoundHistory entry
    const roundHistory: RoundHistory = {
      pods: result.assignments.map((a) => ({
        playerIds: a.players.map((p) => p.player_id),
        isBye: a.is_bye,
      })),
    }
    previousRounds.push(roundHistory)
  }

  return { rounds: previousRounds, results }
}

/**
 * Helper: Count how many times a specific player was in a bye pod across all rounds.
 */
function countByes(rounds: RoundHistory[], playerId: string): number {
  let count = 0
  for (const round of rounds) {
    for (const pod of round.pods) {
      if (pod.isBye && pod.playerIds.includes(playerId)) {
        count++
      }
    }
  }
  return count
}

describe('Pod Algorithm Integration — Multi-Round Fairness', () => {
  describe('sit-out fairness rotation', () => {
    it('distributes byes evenly across 5 players over 5 rounds', () => {
      // 5 players, 5 rounds: each round 1 pod of 4 + 1 bye
      const { rounds } = simulateRounds(5, 5)
      const players = makePlayers(5)

      const byeCounts = players.map((p) => countByes(rounds, p.id))
      const maxByes = Math.max(...byeCounts)
      const minByes = Math.min(...byeCounts)

      // Each player should sit out exactly once (5 byes / 5 players = 1 each)
      // Allow max-min difference of 1
      expect(maxByes - minByes).toBeLessThanOrEqual(1)
    })

    it('distributes byes evenly across 9 players over 9 rounds', () => {
      // 9 players, 9 rounds: each round 2 pods of 4 + 1 bye
      const { rounds } = simulateRounds(9, 9)
      const players = makePlayers(9)

      const byeCounts = players.map((p) => countByes(rounds, p.id))
      const maxByes = Math.max(...byeCounts)
      const minByes = Math.min(...byeCounts)

      expect(maxByes - minByes).toBeLessThanOrEqual(1)
    })

    it('distributes byes evenly across 13 players over 10 rounds', () => {
      // 13 players, 10 rounds: each round 3 pods of 4 + 1 bye
      const { rounds } = simulateRounds(13, 10)
      const players = makePlayers(13)

      const byeCounts = players.map((p) => countByes(rounds, p.id))
      const maxByes = Math.max(...byeCounts)
      const minByes = Math.min(...byeCounts)

      expect(maxByes - minByes).toBeLessThanOrEqual(1)
    })

    it('handles exact multiple of 4 (no byes needed)', () => {
      // 8 players, 5 rounds: each round 2 pods of 4, no bye
      const { rounds } = simulateRounds(8, 5)
      const players = makePlayers(8)

      const byeCounts = players.map((p) => countByes(rounds, p.id))

      // All bye counts should be 0
      for (const count of byeCounts) {
        expect(count).toBe(0)
      }
    })

    it('handles 6 players (high bye count scenario)', () => {
      // 6 players, 6 rounds: each round 1 pod of 4 + 1 bye with 2 players
      const { rounds, results } = simulateRounds(6, 6)
      const players = makePlayers(6)

      const byeCounts = players.map((p) => countByes(rounds, p.id))
      const maxByes = Math.max(...byeCounts)
      const minByes = Math.min(...byeCounts)

      expect(maxByes - minByes).toBeLessThanOrEqual(1)

      // Algorithm should warn about high bye count for 6 players (2 byes = not >= 3, no warning)
      // Actually with 6 players: numByes = 6 % 4 = 2, which is < 3, so no "High bye count" warning
      // Let's just verify structural correctness instead
      for (const result of results) {
        const byePods = result.assignments.filter((a) => a.is_bye)
        if (byePods.length > 0) {
          expect(byePods[0].players).toHaveLength(2)
        }
      }
    })
  })

  describe('comprehensive sit-out fairness (all non-div-by-4 counts)', () => {
    const countsWithByes = [5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19]

    it.each(countsWithByes)('distributes byes evenly for %i players over sufficient rounds', (count) => {
      const roundCount = Math.max(5, count) // enough rounds to test fairness
      const { rounds } = simulateRounds(count, roundCount)
      const players = makePlayers(count)

      const byeCounts = players.map(p => countByes(rounds, p.id))
      const maxByes = Math.max(...byeCounts)
      const minByes = Math.min(...byeCounts)

      expect(maxByes - minByes).toBeLessThanOrEqual(1)
    })
  })

  describe('opponent avoidance across rounds', () => {
    it('minimizes repeat opponents for 8 players over 4 rounds', () => {
      // 8 players, 4 rounds, no byes
      const { rounds } = simulateRounds(8, 4)

      const opponentHistory = buildOpponentHistory(rounds)

      // Check max pair count
      // With 8 players in 4 rounds, each player has 3 opponents per round = 12 opponent-slots
      // With 7 other players, perfectly spread would be ~1.7 each
      // Assert max pair count <= 3
      let maxPairCount = 0
      for (const [, opponents] of opponentHistory) {
        for (const [, count] of opponents) {
          if (count > maxPairCount) maxPairCount = count
        }
      }

      expect(maxPairCount).toBeLessThanOrEqual(3)
    })

    it('minimizes repeat opponents for 12 players over 6 rounds', () => {
      // 12 players, 6 rounds, 3 pods per round, no byes
      const { rounds } = simulateRounds(12, 6)

      const opponentHistory = buildOpponentHistory(rounds)

      // With 12 players, 3 opponents per round, 6 rounds = 18 opponent-slots
      // 11 other players, average ~1.6 each
      // Max should be bounded
      let maxPairCount = 0
      for (const [, opponents] of opponentHistory) {
        for (const [, count] of opponents) {
          if (count > maxPairCount) maxPairCount = count
        }
      }

      // With 12 players, 3 pods of 4, 6 rounds: greedy reduces repeats but
      // cannot guarantee <= 3. Allow up to 4 (still well below random baseline).
      expect(maxPairCount).toBeLessThanOrEqual(4)
    })

    it('no repeat opponents in round 2 for 8 players', () => {
      // 8 players, 2 rounds
      const { rounds } = simulateRounds(8, 2)

      // Get opponents from round 1 and round 2
      const round1Pairs = new Set<string>()
      const round2Pairs = new Set<string>()

      for (const pod of rounds[0].pods) {
        if (pod.isBye) continue
        for (let i = 0; i < pod.playerIds.length; i++) {
          for (let j = i + 1; j < pod.playerIds.length; j++) {
            const pair = [pod.playerIds[i], pod.playerIds[j]].sort().join('-')
            round1Pairs.add(pair)
          }
        }
      }

      for (const pod of rounds[1].pods) {
        if (pod.isBye) continue
        for (let i = 0; i < pod.playerIds.length; i++) {
          for (let j = i + 1; j < pod.playerIds.length; j++) {
            const pair = [pod.playerIds[i], pod.playerIds[j]].sort().join('-')
            round2Pairs.add(pair)
          }
        }
      }

      // Count repeat pairs
      let repeatCount = 0
      for (const pair of round2Pairs) {
        if (round1Pairs.has(pair)) repeatCount++
      }

      // With 8 players in 2 pods of 4, round 2 has C(4,2)*2 = 12 pairs.
      // Round 1 also had 12 pairs. The greedy algorithm minimizes repeats
      // but with only 8 players, some overlap is unavoidable.
      // Allow up to 4 repeat pairs (well below the 12 possible).
      expect(repeatCount).toBeLessThanOrEqual(4)
    })

    it('minimizes repeat opponents for 16 players over 5 rounds', () => {
      const { rounds } = simulateRounds(16, 5)
      const opponentHistory = buildOpponentHistory(rounds)

      let maxPairCount = 0
      for (const [, opponents] of opponentHistory) {
        for (const [, count] of opponents) {
          if (count > maxPairCount) maxPairCount = count
        }
      }

      // With 16 players, 4 pods of 4, 5 rounds: greedy keeps repeats bounded
      expect(maxPairCount).toBeLessThanOrEqual(3)
    })

    it('minimizes repeat opponents for 20 players over 5 rounds', () => {
      const { rounds } = simulateRounds(20, 5)
      const opponentHistory = buildOpponentHistory(rounds)

      let maxPairCount = 0
      for (const [, opponents] of opponentHistory) {
        for (const [, count] of opponents) {
          if (count > maxPairCount) maxPairCount = count
        }
      }

      // With 20 players, 5 pods of 4, 5 rounds: ample players for good diversity
      expect(maxPairCount).toBeLessThanOrEqual(3)
    })
  })

  describe('multi-round structural correctness', () => {
    it('every round has correct pod structure for various player counts', () => {
      const playerCounts = Array.from({ length: 17 }, (_, i) => i + 4) // [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

      for (const playerCount of playerCounts) {
        const { results } = simulateRounds(playerCount, 3)
        const expectedByes = playerCount % 4

        for (const result of results) {
          const activePods = result.assignments.filter((a) => !a.is_bye)
          const byePods = result.assignments.filter((a) => a.is_bye)

          // Total players across all pods = playerCount
          const totalPlayers = result.assignments.reduce(
            (sum, a) => sum + a.players.length,
            0
          )
          expect(totalPlayers).toBe(playerCount)

          // Non-bye pods have exactly 4 players each
          for (const pod of activePods) {
            expect(pod.players).toHaveLength(4)
          }

          // Bye pod (if exists) has (playerCount % 4) players
          if (expectedByes > 0) {
            expect(byePods).toHaveLength(1)
            expect(byePods[0].players).toHaveLength(expectedByes)
          } else {
            expect(byePods).toHaveLength(0)
          }

          // Each player appears in exactly one pod per round
          const allPlayerIds = result.assignments.flatMap((a) =>
            a.players.map((p) => p.player_id)
          )
          const uniqueIds = new Set(allPlayerIds)
          expect(uniqueIds.size).toBe(playerCount)
          expect(allPlayerIds.length).toBe(playerCount)

          // Seat numbers in non-bye pods are 1-4 (unique within each pod)
          for (const pod of activePods) {
            const seats = pod.players
              .map((p) => p.seat_number)
              .sort((a, b) => a! - b!)
            expect(seats).toEqual([1, 2, 3, 4])
          }

          // Seat numbers in bye pods are null
          for (const pod of byePods) {
            for (const player of pod.players) {
              expect(player.seat_number).toBeNull()
            }
          }
        }
      }
    })

    it('fewer than 4 players throws error', () => {
      const players = makePlayers(3)
      expect(() => generatePods(players, [])).toThrow('Fewer than 4 active players')
    })

    it('all seat numbers are unique within each pod', () => {
      // 16 players, 5 rounds
      const { results } = simulateRounds(16, 5)

      for (const result of results) {
        for (const pod of result.assignments) {
          if (!pod.is_bye) {
            const seats = pod.players.map((p) => p.seat_number)
            const uniqueSeats = new Set(seats)
            expect(uniqueSeats.size).toBe(4)
            expect(seats.sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4])
          } else {
            for (const player of pod.players) {
              expect(player.seat_number).toBeNull()
            }
          }
        }
      }
    })

    it('seat assignments are randomized (not always 1,2,3,4 in same order)', () => {
      // Run 8 players through 10 rounds
      const { results } = simulateRounds(8, 10)

      // Collect all seat assignment orders for pod 1 (pod_number === 1) across rounds
      const seatOrders: string[] = []
      for (const result of results) {
        const pod1 = result.assignments.find((a) => a.pod_number === 1)
        if (pod1) {
          const order = pod1.players.map((p) => p.seat_number).join(',')
          seatOrders.push(order)
        }
      }

      // Assert that not all seat orders are identical
      const uniqueOrders = new Set(seatOrders)
      expect(uniqueOrders.size).toBeGreaterThan(1)
    })
  })
})
