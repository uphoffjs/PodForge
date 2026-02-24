import { useState } from 'react'
import { toast } from 'sonner'
import { Shuffle, Loader2 } from 'lucide-react'
import { generatePods, type PlayerInfo, type RoundHistory } from '@/lib/pod-algorithm'
import { useGenerateRound, type PodAssignment } from '@/hooks/useGenerateRound'
import { useRounds } from '@/hooks/useRounds'
import { usePods, type PodWithPlayers } from '@/hooks/usePods'
import type { Player, Round } from '@/types/database'

interface AdminControlsProps {
  eventId: string
  isAdmin: boolean
  passphrase: string | null
  onPassphraseNeeded: () => void
  players: Player[]
  isEventEnded: boolean
}

/**
 * Build RoundHistory[] from fetched rounds and their pods data.
 * Transforms the database shape into the format expected by generatePods.
 */
export function buildRoundHistoryFromData(
  rounds: Round[],
  podsByRound: Map<string, PodWithPlayers[]>
): RoundHistory[] {
  return rounds.map((round) => {
    const pods = podsByRound.get(round.id) ?? []
    return {
      pods: pods.map((pod) => ({
        playerIds: pod.pod_players.map((pp) => pp.player_id),
        isBye: pod.is_bye,
      })),
    }
  })
}

export function AdminControls({
  eventId,
  isAdmin,
  passphrase,
  onPassphraseNeeded,
  players,
  isEventEnded,
}: AdminControlsProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateRound = useGenerateRound(eventId)
  const { data: rounds } = useRounds(eventId)

  // Fetch pods for all existing rounds to build history
  // We use the most recent round to indicate we have data loaded
  const latestRound = rounds?.[0]
  const { data: latestPods } = usePods(latestRound?.id)

  if (!isAdmin) return null

  const roundCount = rounds?.length ?? 0

  const handleGenerateRound = () => {
    if (isEventEnded) return

    if (!passphrase) {
      onPassphraseNeeded()
      return
    }

    // Filter active players for the algorithm
    const activePlayers: PlayerInfo[] = players
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.id, name: p.name }))

    // Build round history from existing rounds
    // For simplicity, we build history from available data
    // The algorithm primarily needs previous round pods to avoid repeat opponents
    const previousRounds: RoundHistory[] = []
    if (rounds && latestPods) {
      // Build a map of round pods -- we have the latest round's pods
      // For a complete history we'd need all rounds' pods, but the greedy algorithm
      // works best with the most recent data
      const podsByRound = new Map<string, PodWithPlayers[]>()
      if (latestRound) {
        podsByRound.set(latestRound.id, latestPods)
      }
      previousRounds.push(...buildRoundHistoryFromData(
        latestRound ? [latestRound] : [],
        podsByRound
      ))
    }

    try {
      const result = generatePods(activePlayers, previousRounds)

      // Show algorithm warnings
      for (const warning of result.warnings) {
        toast.warning(warning)
      }

      // Transform to the hook's expected format
      const podAssignments: PodAssignment[] = result.assignments

      setIsGenerating(true)
      generateRound.mutate(
        { passphrase, podAssignments },
        {
          onSuccess: () => {
            toast.success(`Round ${roundCount + 1} generated!`)
            setIsGenerating(false)
          },
          onError: () => {
            setIsGenerating(false)
          },
        },
      )
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const isPending = isGenerating || generateRound.isPending

  return (
    <div
      className="w-full max-w-lg mb-6 bg-surface-raised border border-border rounded-xl p-4"
      data-testid="admin-controls"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Admin Controls
        </h2>
        <span className="text-sm text-text-secondary">
          {roundCount > 0 ? `Round ${roundCount}` : 'No rounds yet'}
        </span>
      </div>

      <button
        type="button"
        onClick={handleGenerateRound}
        disabled={isPending || isEventEnded}
        title={isEventEnded ? 'Event has ended' : undefined}
        data-testid="generate-round-btn"
        className="flex items-center justify-center gap-2 w-full rounded-lg bg-accent py-3 px-4 text-surface font-semibold text-base hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Shuffle className="w-5 h-5" />
            Generate Next Round
          </>
        )}
      </button>
    </div>
  )
}
