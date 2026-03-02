import { useState } from 'react'
import { toast } from 'sonner'
import { Shuffle, Loader2, Lock } from 'lucide-react'
import { generatePods, type PlayerInfo, type RoundHistory } from '@/lib/pod-algorithm'
import { useGenerateRound, type PodAssignment } from '@/hooks/useGenerateRound'
import { useEndEvent } from '@/hooks/useEndEvent'
import { useRounds } from '@/hooks/useRounds'
import { useAllRoundsPods } from '@/hooks/useAllRoundsPods'
import type { PodWithPlayers } from '@/hooks/usePods'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
// eslint-disable-next-line react-refresh/only-export-components
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
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null)
  const [allowPodsOf3, setAllowPodsOf3] = useState(false)

  const generateRound = useGenerateRound(eventId)
  const endEvent = useEndEvent(eventId)
  const { data: rounds } = useRounds(eventId)

  // Fetch pods for ALL existing rounds to build complete opponent history
  const roundIds = rounds?.map((r) => r.id) ?? []
  const { data: allPods } = useAllRoundsPods(eventId, roundIds)

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

    // Build round history from ALL existing rounds for complete opponent avoidance
    const previousRounds: RoundHistory[] = []
    if (rounds && allPods) {
      // Group pods by round_id
      const podsByRound = new Map<string, PodWithPlayers[]>()
      for (const pod of allPods) {
        const existing = podsByRound.get(pod.round_id) ?? []
        existing.push(pod)
        podsByRound.set(pod.round_id, existing)
      }
      previousRounds.push(...buildRoundHistoryFromData(rounds, podsByRound))
    }

    try {
      const result = generatePods(activePlayers, previousRounds, allowPodsOf3)

      // Show algorithm warnings
      for (const warning of result.warnings) {
        toast.warning(warning)
      }

      // Transform to the hook's expected format
      const podAssignments: PodAssignment[] = result.assignments

      setIsGenerating(true)
      generateRound.mutate(
        { passphrase, podAssignments, timerDurationMinutes: selectedDuration ?? undefined },
        {
          onSuccess: () => {
            toast.success(`Round ${roundCount + 1} generated!`)
            setIsGenerating(false)
            setSelectedDuration(null)
            setAllowPodsOf3(false)
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

  const handleEndEvent = () => {
    if (isEventEnded) return

    if (!passphrase) {
      onPassphraseNeeded()
      return
    }

    setShowEndConfirm(true)
  }

  const handleEndEventConfirm = () => {
    if (!passphrase) return

    endEvent.mutate(
      { passphrase },
      {
        onSuccess: () => {
          setShowEndConfirm(false)
        },
        onError: () => {
          setShowEndConfirm(false)
        },
      },
    )
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

      {/* Timer duration picker */}
      {!isEventEnded && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-text-secondary whitespace-nowrap">Timer:</span>
          {[60, 90, 120].map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() =>
                setSelectedDuration((prev) => (prev === duration ? null : duration))
              }
              data-testid={`timer-duration-${duration}`}
              className={`flex-1 rounded-lg py-2 px-3 text-sm font-medium transition-colors min-h-[36px] ${
                selectedDuration === duration
                  ? 'bg-accent text-surface border border-accent'
                  : 'bg-surface border border-border text-text-secondary hover:border-border-bright'
              }`}
            >
              {duration} min
            </button>
          ))}
        </div>
      )}

      {/* Allow pods of 3 toggle */}
      {!isEventEnded && (
        <label className="flex items-center gap-2 mb-3 cursor-pointer" data-testid="pods-of-3-toggle">
          <input
            type="checkbox"
            checked={allowPodsOf3}
            onChange={(e) => setAllowPodsOf3(e.target.checked)}
            data-testid="pods-of-3-checkbox"
            className="w-4 h-4 rounded border-border bg-surface-raised text-accent cursor-pointer"
          />
          <span className="text-sm text-text-secondary">Allow pods of 3</span>
        </label>
      )}

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

      <button
        type="button"
        onClick={handleEndEvent}
        disabled={endEvent.isPending || isEventEnded}
        data-testid="end-event-btn"
        className="flex items-center justify-center gap-2 w-full mt-3 rounded-lg border border-error text-error py-2.5 px-4 text-sm font-medium hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {endEvent.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ending...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            End Event
          </>
        )}
      </button>

      <ConfirmDialog
        isOpen={showEndConfirm}
        title="End this event?"
        message="This action cannot be undone. All data will remain visible but no new rounds can be generated."
        confirmLabel="End Event"
        onConfirm={handleEndEventConfirm}
        onCancel={() => setShowEndConfirm(false)}
        isLoading={endEvent.isPending}
      />
    </div>
  )
}
