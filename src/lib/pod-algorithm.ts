/**
 * Pod Generation Algorithm
 *
 * Pure function that divides active players into pods of 4,
 * minimizing repeat opponents using a multi-start greedy algorithm
 * with quadratic penalty scoring and post-greedy swap pass.
 * Handles bye rotation fairly and assigns random seat order.
 */

export interface PlayerInfo {
  id: string
  name: string
}

export interface RoundHistory {
  pods: { playerIds: string[]; isBye: boolean }[]
}

export interface PodAssignment {
  pod_number: number
  is_bye: boolean
  players: { player_id: string; seat_number: number | null }[]
}

export interface PodAssignmentResult {
  assignments: PodAssignment[]
  warnings: string[]
}

/**
 * Number of random orderings to try in the multi-start greedy.
 * Higher values produce better assignments at the cost of computation.
 */
const NUM_STARTS = 20

/**
 * Fisher-Yates shuffle. Returns a new shuffled copy of the input array.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Build opponent history matrix from previous rounds.
 * Returns Map<playerA, Map<playerB, count>> where count is the
 * number of times players A and B were in the same (non-bye) pod.
 */
export function buildOpponentHistory(
  previousRounds: RoundHistory[]
): Map<string, Map<string, number>> {
  const history = new Map<string, Map<string, number>>()

  for (const round of previousRounds) {
    for (const pod of round.pods) {
      if (pod.isBye) continue

      const playerIds = pod.playerIds
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const a = playerIds[i]
          const b = playerIds[j]

          if (!history.has(a)) history.set(a, new Map())
          if (!history.has(b)) history.set(b, new Map())

          const aMap = history.get(a)!
          const bMap = history.get(b)!

          aMap.set(b, (aMap.get(b) ?? 0) + 1)
          bMap.set(a, (bMap.get(a) ?? 0) + 1)
        }
      }
    }
  }

  return history
}

/**
 * Build bye count map from previous rounds.
 * Counts how many times each player was in a bye pod.
 * Initializes all given playerIds with 0.
 */
export function buildByeCounts(
  previousRounds: RoundHistory[],
  playerIds: string[]
): Map<string, number> {
  const counts = new Map<string, number>()

  // Initialize all players with 0
  for (const id of playerIds) {
    counts.set(id, 0)
  }

  // Count byes from history
  for (const round of previousRounds) {
    for (const pod of round.pods) {
      if (!pod.isBye) continue
      for (const playerId of pod.playerIds) {
        counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
      }
    }
  }

  return counts
}

/**
 * Calculate the opponent overlap score for a candidate player
 * against players already placed in a pod.
 * Uses quadratic penalty: encounters^2 to penalize repeat opponents
 * superlinearly (2 encounters = 4x penalty, 3 = 9x).
 */
export function getOpponentScore(
  candidate: string,
  podMembers: string[],
  history: Map<string, Map<string, number>>
): number {
  let score = 0
  const candidateHistory = history.get(candidate)
  if (!candidateHistory) return 0

  for (const member of podMembers) {
    const encounters = candidateHistory.get(member) ?? 0
    score += encounters * encounters
  }
  return score
}

/**
 * Compute the penalty for a single pod: sum of encounters^2
 * for all C(n,2) pairs of players in the pod.
 */
export function podPenalty(
  pod: string[],
  history: Map<string, Map<string, number>>
): number {
  let penalty = 0
  for (let i = 0; i < pod.length; i++) {
    for (let j = i + 1; j < pod.length; j++) {
      const encounters = history.get(pod[i])?.get(pod[j]) ?? 0
      penalty += encounters * encounters
    }
  }
  return penalty
}

/**
 * Compute the total penalty across all pods: sum of podPenalty
 * for each pod in the assignment.
 */
export function totalPenalty(
  pods: string[][],
  history: Map<string, Map<string, number>>
): number {
  let total = 0
  for (const pod of pods) {
    total += podPenalty(pod, history)
  }
  return total
}

/**
 * Single greedy assignment pass. Takes a pre-shuffled pool of player IDs
 * and assigns them to pods, greedily minimizing opponent overlap score.
 * Returns string[][] of pod assignments.
 */
export function greedyAssign(
  pool: string[],
  numPods: number,
  history: Map<string, Map<string, number>>
): string[][] {
  const pods: string[][] = Array.from({ length: numPods }, () => [])
  const remaining = [...pool]

  for (let podIdx = 0; podIdx < numPods; podIdx++) {
    // Pick first player from remaining (already shuffled)
    pods[podIdx].push(remaining[0])
    remaining.splice(0, 1)

    // Fill positions 2-4 greedily
    for (let slot = 1; slot < 4; slot++) {
      let bestIdx = 0
      let bestScore = getOpponentScore(
        remaining[0],
        pods[podIdx],
        history
      )

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

/**
 * Post-greedy swap pass. Iterates all pairs of players across different pods
 * and swaps them if it reduces total penalty. Uses strict less-than comparison
 * to guarantee monotonic improvement and termination.
 */
export function swapPass(
  pods: string[][],
  history: Map<string, Map<string, number>>
): string[][] {
  // Deep copy pods to avoid mutating input
  const result = pods.map((pod) => [...pod])
  let improved = true

  while (improved) {
    improved = false
    const currentScore = totalPenalty(result, history)

    for (let podA = 0; podA < result.length; podA++) {
      for (let podB = podA + 1; podB < result.length; podB++) {
        for (let iA = 0; iA < result[podA].length; iA++) {
          for (let iB = 0; iB < result[podB].length; iB++) {
            // Try swap
            ;[result[podA][iA], result[podB][iB]] = [
              result[podB][iB],
              result[podA][iA],
            ]
            const swappedScore = totalPenalty(result, history)

            if (swappedScore < currentScore) {
              // Keep swap, restart outer loop
              improved = true
              break
            } else {
              // Undo swap
              ;[result[podA][iA], result[podB][iB]] = [
                result[podB][iB],
                result[podA][iA],
              ]
            }
          }
          if (improved) break
        }
        if (improved) break
      }
      if (improved) break
    }
  }

  return result
}

/**
 * Main pod generation function.
 *
 * Takes active players and their round history, produces pod
 * assignments that minimize repeat opponents using multi-start
 * greedy with quadratic scoring and swap pass. Handles bye rotation
 * fairly, and assigns random seat order.
 *
 * @throws Error when fewer than 4 active players
 */
export function generatePods(
  activePlayers: PlayerInfo[],
  previousRounds: RoundHistory[]
): PodAssignmentResult {
  // 1. Validation
  if (activePlayers.length < 4) {
    throw new Error('Fewer than 4 active players')
  }

  const warnings: string[] = []

  // 2. Build opponent history matrix
  const opponentHistory = buildOpponentHistory(previousRounds)

  // 3. Build bye count map
  const byeCounts = buildByeCounts(
    previousRounds,
    activePlayers.map((p) => p.id)
  )

  // 4. Select bye players (if needed)
  const numByes = activePlayers.length % 4
  let byePlayers: PlayerInfo[] = []
  let podPlayers: PlayerInfo[]

  if (numByes > 0) {
    // Shuffle first for random tie-breaking, then stable sort by bye count.
    // Using Math.random() inside a sort comparator is broken because it
    // violates transitivity and can produce incorrect orderings.
    const shuffled = shuffleArray(activePlayers)
    const sorted = shuffled.sort((a, b) => {
      // All active player IDs are guaranteed to be in byeCounts (initialized with 0)
      const aByes = byeCounts.get(a.id)!
      const bByes = byeCounts.get(b.id)!
      return aByes - bByes
    })

    byePlayers = sorted.slice(0, numByes)

    if (numByes >= 3) {
      warnings.push(
        `High bye count: ${numByes} of ${activePlayers.length} players sitting out`
      )
    }

    const byeIds = new Set(byePlayers.map((p) => p.id))
    podPlayers = activePlayers.filter((p) => !byeIds.has(p.id))
  } else {
    podPlayers = [...activePlayers]
  }

  // 5. Multi-start assignment with swap pass
  const numPods = podPlayers.length / 4
  const podPlayerIds = podPlayers.map((p) => p.id)

  let bestPods: string[][] = []
  let bestScore = Infinity

  for (let start = 0; start < NUM_STARTS; start++) {
    const pool = shuffleArray(podPlayerIds)
    let pods: string[][]

    if (start < NUM_STARTS / 2) {
      // First half: greedy assignment (good local optimization)
      pods = greedyAssign(pool, numPods, opponentHistory)
    } else {
      // Second half: random chunk assignment (diverse starting points)
      // Split shuffled pool into consecutive chunks of 4
      pods = Array.from({ length: numPods }, (_, i) =>
        pool.slice(i * 4, (i + 1) * 4)
      )
    }

    // Apply swap pass to each candidate
    const improved = swapPass(pods, opponentHistory)
    const score = totalPenalty(improved, opponentHistory)
    if (score < bestScore) {
      bestScore = score
      bestPods = improved
    }
  }

  const finalPods = bestPods

  // 6. Build result
  const assignments: PodAssignment[] = []

  // Add active pods
  for (let i = 0; i < finalPods.length; i++) {
    const seatOrder = shuffleArray([1, 2, 3, 4])
    assignments.push({
      pod_number: i + 1,
      is_bye: false,
      players: finalPods[i].map((playerId, idx) => ({
        player_id: playerId,
        seat_number: seatOrder[idx],
      })),
    })
  }

  // Add bye pod (if any)
  if (byePlayers.length > 0) {
    assignments.push({
      pod_number: numPods + 1,
      is_bye: true,
      players: byePlayers.map((p) => ({
        player_id: p.id,
        seat_number: null,
      })),
    })
  }

  return { assignments, warnings }
}
