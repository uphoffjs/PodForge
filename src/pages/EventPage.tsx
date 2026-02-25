import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { Copy, Loader2, LogOut, Lock } from 'lucide-react'
import { useEvent } from '@/hooks/useEvent'
import { useEventPlayers } from '@/hooks/useEventPlayers'
import { useEventChannel } from '@/hooks/useEventChannel'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'
import { useDropPlayer } from '@/hooks/useDropPlayer'
import { useCurrentRound } from '@/hooks/useCurrentRound'
import { useTimer } from '@/hooks/useTimer'
import { getStoredPlayerId, clearPlayerId, storePlayerId } from '@/lib/player-identity'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { JoinEventForm } from '@/components/JoinEventForm'
import { PlayerList } from '@/components/PlayerList'
import { AddPlayerForm } from '@/components/AddPlayerForm'
import { QRCodeDisplay } from '@/components/QRCodeDisplay'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RoundDisplay } from '@/components/RoundDisplay'
import { AdminControls } from '@/components/AdminControls'
import { AdminPassphraseModal } from '@/components/AdminPassphraseModal'
import { PreviousRounds } from '@/components/PreviousRounds'
import { TimerDisplay } from '@/components/TimerDisplay'
import { TimerControls } from '@/components/TimerControls'

export function EventPage() {
  const { eventId } = useParams()
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [skippedJoin, setSkippedJoin] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [newPlayerIds, setNewPlayerIds] = useState<Set<string>>(new Set())
  const [showPassphraseModal, setShowPassphraseModal] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)

  const { data: event, isLoading: eventLoading, error: eventError } = useEvent(eventId ?? '')
  const { data: players, isLoading: playersLoading } = useEventPlayers(eventId ?? '')
  const { data: currentRound } = useCurrentRound(eventId ?? '')
  const { data: timer } = useTimer(eventId ?? '')

  // Wire up Realtime subscriptions
  useEventChannel(eventId ?? '')

  // Wire up tab restore refetch
  useVisibilityRefetch(eventId ?? '')

  // Admin auth (sessionStorage-based)
  const { isAdmin, passphrase, setPassphrase, clearPassphrase } = useAdminAuth(eventId ?? '')

  // Self-drop mutation
  const dropPlayer = useDropPlayer(eventId ?? '')

  // Track previous player IDs for detecting new joins
  const prevPlayerIdsRef = useRef<Set<string>>(new Set())

  // Gate validation effect to prevent race condition after fresh join
  const justJoinedRef = useRef(false)

  // Check localStorage for existing player identity
  useEffect(() => {
    if (!eventId) return
    const storedId = getStoredPlayerId(eventId)
    if (storedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync from localStorage on mount is inherently an effect
      setCurrentPlayerId(storedId)
    }
  }, [eventId])

  // Verify stored player exists in fetched player list
  useEffect(() => {
    if (!eventId || !players || !currentPlayerId) return

    // Skip validation right after joining — players list hasn't refetched yet
    if (justJoinedRef.current) {
      const playerExists = players.some((p) => p.id === currentPlayerId)
      if (playerExists) {
        // Player appeared in the list — join is confirmed, resume normal validation
        justJoinedRef.current = false
      }
      // Either way, don't clear identity while join is pending
      return
    }

    const playerExists = players.some((p) => p.id === currentPlayerId)
    if (!playerExists) {
      clearPlayerId(eventId)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing stale identity when player dropped is an inherent side effect
      setCurrentPlayerId(null)
    }
  }, [eventId, players, currentPlayerId])

  // Detect new player joins for highlight animation
  useEffect(() => {
    if (!players) return

    const currentIds = new Set(players.filter((p) => p.status === 'active').map((p) => p.id))
    const prevIds = prevPlayerIdsRef.current

    // Only detect new players after initial load (prevIds is populated)
    if (prevIds.size > 0) {
      const added = new Set<string>()
      for (const id of currentIds) {
        if (!prevIds.has(id)) {
          added.add(id)
        }
      }
      if (added.size > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: highlight animation requires re-render when new players detected
        setNewPlayerIds(added)
        // Clear the highlight after the animation completes
        const timer = setTimeout(() => setNewPlayerIds(new Set()), 400)
        return () => clearTimeout(timer)
      }
    }

    prevPlayerIdsRef.current = currentIds
  }, [players])

  const handleJoined = useCallback(
    (playerId: string) => {
      if (eventId) {
        storePlayerId(eventId, playerId)
      }
      justJoinedRef.current = true
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

  const handleLeaveConfirm = useCallback(() => {
    if (!currentPlayerId) return
    dropPlayer.mutate(currentPlayerId, {
      onSuccess: () => {
        setShowLeaveConfirm(false)
        setCurrentPlayerId(null)
        setSkippedJoin(false)
      },
    })
  }, [currentPlayerId, dropPlayer])

  const handlePassphraseSubmit = useCallback(
    (enteredPassphrase: string) => {
      setPassphrase(enteredPassphrase)
      setPassphraseError(null)
      setShowPassphraseModal(false)
    },
    [setPassphrase],
  )

  const handlePassphraseCancel = useCallback(() => {
    setShowPassphraseModal(false)
    setPassphraseError(null)
  }, [])

  const handlePassphraseNeeded = useCallback(() => {
    setShowPassphraseModal(true)
    setPassphraseError(null)
  }, [])

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
      <div className="flex flex-col items-center justify-center min-h-screen px-4" data-testid="event-loading">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-text-secondary mt-4">Loading event...</p>
      </div>
    )
  }

  if (eventError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4" data-testid="event-error">
        <h1 className="text-2xl font-display font-bold text-error">Event Not Found</h1>
        <p className="text-text-secondary mt-2">
          This event doesn't exist or has been removed.
        </p>
      </div>
    )
  }

  const isEventEnded = event?.status === 'ended'
  const isJoined = !!currentPlayerId || skippedJoin
  const showJoinForm = !isJoined && !isEventEnded

  // Determine if the current player is active (for showing Leave Event button)
  const isActivePlayer =
    !!currentPlayerId &&
    players?.some((p) => p.id === currentPlayerId && p.status === 'active')

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Event header */}
      <div className="w-full max-w-lg text-center mb-6">
        <h1 className="text-3xl font-display font-bold text-accent" data-testid="event-name">
          {event?.name}
        </h1>
        <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold uppercase rounded-full bg-surface-raised border border-border text-text-secondary" data-testid="event-status">
          {event?.status}
        </span>
      </div>

      {/* Event ended banner */}
      {isEventEnded && (
        <div
          className="w-full max-w-lg mb-6 flex items-center gap-3 p-4 bg-surface-raised border border-border rounded-xl"
          data-testid="event-ended-banner"
        >
          <Lock className="w-5 h-5 text-text-secondary flex-shrink-0" />
          <p className="text-text-secondary font-medium">This event has ended</p>
        </div>
      )}

      {/* Join form (shown for unrecognized players, hidden when event ended) */}
      {showJoinForm && (
        <div className="w-full max-w-lg mb-6 p-6 bg-surface-overlay border border-border-bright rounded-xl">
          <JoinEventForm eventId={eventId} onJoined={handleJoined} />
          <button
            type="button"
            onClick={() => setSkippedJoin(true)}
            data-testid="join-skip-btn"
            className="mt-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Timer display + controls */}
      {timer && timer.status !== 'cancelled' && (
        <div className="w-full max-w-lg mb-4">
          <TimerDisplay timer={timer} />
          {isAdmin && !isEventEnded && passphrase && (
            <TimerControls
              eventId={eventId}
              passphrase={passphrase}
              timer={timer}
              onPassphraseNeeded={handlePassphraseNeeded}
            />
          )}
        </div>
      )}

      {/* Current round display */}
      {currentRound && (
        <RoundDisplay
          roundId={currentRound.id}
          roundNumber={currentRound.round_number}
          currentPlayerId={currentPlayerId}
        />
      )}

      {/* Admin controls (hidden when event ended) */}
      {isAdmin && !isEventEnded && (
        <AdminControls
          eventId={eventId}
          isAdmin={isAdmin}
          passphrase={passphrase}
          onPassphraseNeeded={handlePassphraseNeeded}
          players={players ?? []}
          isEventEnded={isEventEnded}
        />
      )}

      {/* Previous rounds */}
      <PreviousRounds
        eventId={eventId}
        currentRoundNumber={currentRound?.round_number ?? null}
        currentPlayerId={currentPlayerId}
      />

      {/* Player list */}
      <div className="w-full max-w-lg mb-6 p-4 bg-surface-raised border border-border rounded-xl">
        <PlayerList
          players={players ?? []}
          currentPlayerId={currentPlayerId}
          newPlayerIds={newPlayerIds}
          isAdmin={isAdmin && !isEventEnded}
          eventId={eventId}
          passphrase={passphrase}
          onPassphraseNeeded={handlePassphraseNeeded}
        />
      </div>

      {/* Admin: Add Player card */}
      {isAdmin && !isEventEnded && <AddPlayerForm eventId={eventId} />}

      {/* Leave Event button -- separate from player list, deliberate action */}
      {isActivePlayer && !isEventEnded && (
        <div className="w-full max-w-lg mb-6">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            data-testid="leave-event-btn"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium text-error border border-error/40 rounded-lg hover:bg-error/10 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Leave Event
          </button>
        </div>
      )}

      {/* Share section */}
      <div className="w-full max-w-lg flex flex-col items-center gap-4 p-4 bg-surface-raised border border-border rounded-xl">
        <h2 className="text-lg font-semibold text-text-primary">Share This Event</h2>

        <QRCodeDisplay eventId={eventId} />

        <div className="flex items-center gap-2 w-full">
          <input
            type="text"
            readOnly
            value={`${window.location.origin}/event/${eventId}`}
            data-testid="share-link-input"
            className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-secondary truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            data-testid="share-copy-btn"
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-accent text-surface rounded-lg hover:bg-accent-bright transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </div>

      {/* Leave Event confirmation dialog */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title="Leave Event?"
        message="You'll be marked as dropped. You can ask the admin to re-add you later."
        confirmLabel="Leave Event"
        onConfirm={handleLeaveConfirm}
        onCancel={() => setShowLeaveConfirm(false)}
        isLoading={dropPlayer.isPending}
      />

      {/* Admin passphrase modal */}
      <AdminPassphraseModal
        isOpen={showPassphraseModal}
        onSubmit={handlePassphraseSubmit}
        onCancel={handlePassphraseCancel}
        error={passphraseError}
      />
    </div>
  )
}
