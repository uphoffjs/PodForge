import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { Copy, Loader2 } from 'lucide-react'
import { useEvent } from '@/hooks/useEvent'
import { useEventPlayers } from '@/hooks/useEventPlayers'
import { getStoredPlayerId, clearPlayerId, storePlayerId } from '@/lib/player-identity'
import { JoinEventForm } from '@/components/JoinEventForm'
import { PlayerList } from '@/components/PlayerList'
import { QRCodeDisplay } from '@/components/QRCodeDisplay'

export function EventPage() {
  const { eventId } = useParams()
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [skippedJoin, setSkippedJoin] = useState(false)

  const { data: event, isLoading: eventLoading, error: eventError } = useEvent(eventId ?? '')
  const { data: players, isLoading: playersLoading } = useEventPlayers(eventId ?? '')

  // Check localStorage for existing player identity
  useEffect(() => {
    if (!eventId) return
    const storedId = getStoredPlayerId(eventId)
    if (storedId) {
      setCurrentPlayerId(storedId)
    }
  }, [eventId])

  // Verify stored player exists in fetched player list
  useEffect(() => {
    if (!eventId || !players || !currentPlayerId) return

    const playerExists = players.some((p) => p.id === currentPlayerId)
    if (!playerExists) {
      clearPlayerId(eventId)
      setCurrentPlayerId(null)
    }
  }, [eventId, players, currentPlayerId])

  const handleJoined = useCallback(
    (playerId: string) => {
      if (eventId) {
        storePlayerId(eventId, playerId)
      }
      setCurrentPlayerId(playerId)
    },
    [eventId],
  )

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/event/${eventId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    } catch {
      toast.error('Failed to copy link.')
    }
  }, [eventId])

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-2xl font-display font-bold text-error">Invalid Event</h1>
        <p className="text-text-secondary mt-2">No event ID provided.</p>
      </div>
    )
  }

  if (eventLoading || playersLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-text-secondary mt-4">Loading event...</p>
      </div>
    )
  }

  if (eventError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-2xl font-display font-bold text-error">Event Not Found</h1>
        <p className="text-text-secondary mt-2">
          This event doesn't exist or has been removed.
        </p>
      </div>
    )
  }

  const isJoined = !!currentPlayerId || skippedJoin
  const showJoinForm = !isJoined

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Event header */}
      <div className="w-full max-w-lg text-center mb-6">
        <h1 className="text-3xl font-display font-bold text-accent">
          {event?.name}
        </h1>
        <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold uppercase rounded-full bg-surface-raised border border-border text-text-secondary">
          {event?.status}
        </span>
      </div>

      {/* Join form (shown for unrecognized players) */}
      {showJoinForm && (
        <div className="w-full max-w-lg mb-6 p-6 bg-surface-overlay border border-border-bright rounded-xl">
          <JoinEventForm eventId={eventId} onJoined={handleJoined} />
          <button
            type="button"
            onClick={() => setSkippedJoin(true)}
            className="mt-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Player list */}
      <div className="w-full max-w-lg mb-6 p-4 bg-surface-raised border border-border rounded-xl">
        <PlayerList
          players={players ?? []}
          currentPlayerId={currentPlayerId}
        />
      </div>

      {/* Share section */}
      <div className="w-full max-w-lg flex flex-col items-center gap-4 p-4 bg-surface-raised border border-border rounded-xl">
        <h2 className="text-lg font-semibold text-text-primary">Share This Event</h2>

        <QRCodeDisplay eventId={eventId} />

        <div className="flex items-center gap-2 w-full">
          <input
            type="text"
            readOnly
            value={`${window.location.origin}/event/${eventId}`}
            className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-secondary truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-accent text-surface rounded-lg hover:bg-accent-bright transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
