import { Loader2 } from 'lucide-react'
import { usePods } from '@/hooks/usePods'
import { PodCard } from '@/components/PodCard'

interface RoundDisplayProps {
  roundId: string
  roundNumber: number
  currentPlayerId: string | null
}

export function RoundDisplay({ roundId, roundNumber, currentPlayerId }: RoundDisplayProps) {
  const { data: pods, isLoading } = usePods(roundId)

  if (isLoading) {
    return (
      <div className="w-full max-w-lg mb-6 flex items-center justify-center py-8" data-testid="round-display">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  if (!pods || pods.length === 0) return null

  // Separate non-bye pods from bye pods, non-bye first
  const nonByePods = pods.filter((p) => !p.is_bye)
  const byePods = pods.filter((p) => p.is_bye)
  const sortedPods = [...nonByePods, ...byePods]

  return (
    <div className="w-full max-w-lg mb-6" data-testid="round-display">
      <h2
        className="text-xl font-display font-bold text-text-primary mb-4"
        data-testid="round-number"
      >
        Round {roundNumber}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  )
}
