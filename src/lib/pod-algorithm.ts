/**
 * Pod Generation Algorithm
 *
 * Pure function that divides active players into pods of 4,
 * minimizing repeat opponents using a greedy algorithm with
 * opponent history matrix. Handles bye rotation fairly and
 * assigns random seat order.
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
 * Fisher-Yates shuffle (in-place). Returns a new shuffled array.
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
    score += candidateHistory.get(member) ?? 0
  }
  return score
}

/**
 * Main pod generation function.
 *
 * Takes active players and their round history, produces pod
 * assignments that minimize repeat opponents, handle bye rotation
 * fairly, and assign random seat order.
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

  // 5. Assign remaining players to pods (greedy)
  const numPods = podPlayers.length / 4
  const pods: string[][] = Array.from({ length: numPods }, () => [])

  // Shuffle the pool for initial randomness
  let pool = shuffleArray(podPlayers.map((p) => p.id))

  for (let podIdx = 0; podIdx < numPods; podIdx++) {
    // Pick first player randomly from pool (already shuffled)
    const firstPlayer = pool[0]
    pods[podIdx].push(firstPlayer)
    pool = pool.filter((id) => id !== firstPlayer)

    // Fill positions 2-4 greedily
    for (let slot = 1; slot < 4; slot++) {
      let bestCandidate = pool[0]
      let bestScore = getOpponentScore(pool[0], pods[podIdx], opponentHistory)

      for (let i = 1; i < pool.length; i++) {
        const score = getOpponentScore(pool[i], pods[podIdx], opponentHistory)
        if (score < bestScore) {
          bestScore = score
          bestCandidate = pool[i]
        }
      }

      pods[podIdx].push(bestCandidate)
      pool = pool.filter((id) => id !== bestCandidate)
    }
  }

  // 6. Build result
  const assignments: PodAssignment[] = []

  // Add active pods
  for (let i = 0; i < pods.length; i++) {
    const seatOrder = shuffleArray([1, 2, 3, 4])
    assignments.push({
      pod_number: i + 1,
      is_bye: false,
      players: pods[i].map((playerId, idx) => ({
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
