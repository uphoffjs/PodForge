import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useRounds } from '@/hooks/useRounds'
import { usePods } from '@/hooks/usePods'
import { PodCard } from '@/components/PodCard'

interface PreviousRoundsProps {
  eventId: string
  currentRoundNumber: number | null
  currentPlayerId: string | null
}

function PreviousRoundSection({
  roundId,
  roundNumber,
  currentPlayerId,
}: {
  roundId: string
  roundNumber: number
  currentPlayerId: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: pods, isLoading } = usePods(isExpanded ? roundId : undefined)

  // Separate non-bye pods from bye pods, non-bye first
  const nonByePods = pods?.filter((p) => !p.is_bye) ?? []
  const byePods = pods?.filter((p) => p.is_bye) ?? []
  const sortedPods = [...nonByePods, ...byePods]

  return (
    <div
      className="bg-surface-raised border border-border rounded-xl overflow-hidden"
      data-testid={`previous-round-${roundNumber}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`previous-round-toggle-${roundNumber}`}
        className="flex items-center gap-2 w-full px-4 py-3 text-left cursor-pointer hover:bg-surface-overlay/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
        )}
        <span className="text-base font-semibold text-text-primary">
          Round {roundNumber}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            </div>
          ) : sortedPods.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedPods.map((pod) => (
                <PodCard
                  key={pod.id}
                  podNumber={pod.pod_number}
                  isBye={pod.is_bye}
                  players={pod.pod_players.map((pp) => ({
                    playerId: pp.player_id,
                    playerName: pp.players.name,
                    seatNumber: pp.seat_number,
                  }))}
                  currentPlayerId={currentPlayerId}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary py-2">No pods for this round.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function PreviousRounds({
  eventId,
  currentRoundNumber,
  currentPlayerId,
}: PreviousRoundsProps) {
  const { data: rounds } = useRounds(eventId)

  if (!rounds) return null

  // Filter out the current round (highest round_number) -- only show earlier rounds
  // Rounds are already ordered descending by round_number from useRounds
  const previousRounds = currentRoundNumber
    ? rounds.filter((r) => r.round_number < currentRoundNumber)
    : rounds.slice(1) // If no current round number provided, skip the first (most recent)

  if (previousRounds.length === 0) return null

  return (
    <div className="w-full max-w-lg mb-6" data-testid="previous-rounds">
      <h2 className="text-lg font-semibold text-text-primary mb-3">
        Previous Rounds
      </h2>

      <div className="space-y-2">
        {previousRounds.map((round) => (
          <PreviousRoundSection
            key={round.id}
            roundId={round.id}
            roundNumber={round.round_number}
            currentPlayerId={currentPlayerId}
          />
        ))}
      </div>
    </div>
  )
}
