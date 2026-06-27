import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, UserPlus } from 'lucide-react'
import { useRemovePlayer } from '@/hooks/useRemovePlayer'
import { useReactivatePlayer } from '@/hooks/useReactivatePlayer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  isInvalidPassphraseError,
  INVALID_PASSPHRASE_RETRY_MESSAGE,
} from '@/lib/passphrase-error'

interface AdminPlayerActionsProps {
  eventId: string
  playerId: string
  playerName: string
  playerStatus: 'active' | 'dropped'
  passphrase: string | null
  onPassphraseNeeded: (error?: string) => void
}

export function AdminPlayerActions({
  eventId,
  playerId,
  playerName,
  playerStatus,
  passphrase,
  onPassphraseNeeded,
}: AdminPlayerActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const removePlayer = useRemovePlayer(eventId)
  const reactivatePlayer = useReactivatePlayer(eventId)

  const isActive = playerStatus === 'active'
  const isPending = removePlayer.isPending || reactivatePlayer.isPending

  const handleClick = () => {
    if (!passphrase) {
      onPassphraseNeeded()
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!passphrase) return

    // Re-open the passphrase modal with inline feedback when the mutation is
    // rejected because the stored passphrase is invalid.
    const handleError = (error: unknown) => {
      setShowConfirm(false)
      if (isInvalidPassphraseError(error)) {
        onPassphraseNeeded(INVALID_PASSPHRASE_RETRY_MESSAGE)
      }
    }

    if (isActive) {
      removePlayer.mutate(
        { passphrase, playerId },
        {
          onSuccess: () => {
            toast.success(`Removed ${playerName}`)
            setShowConfirm(false)
          },
          onError: handleError,
        },
      )
    } else {
      reactivatePlayer.mutate(
        { passphrase, playerId },
        {
          onSuccess: () => {
            toast.success(`Reactivated ${playerName}`)
            setShowConfirm(false)
          },
          onError: handleError,
        },
      )
    }
  }

  return (
    <>
      {isActive ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          data-testid={`admin-remove-player-${playerId}`}
          className="ml-2 text-error/60 hover:text-error transition-colors disabled:opacity-50"
          title={`Remove ${playerName}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          data-testid={`admin-reactivate-player-${playerId}`}
          className="ml-2 text-accent/60 hover:text-accent transition-colors disabled:opacity-50"
          title={`Reactivate ${playerName}`}
        >
          <UserPlus className="w-4 h-4" />
        </button>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={isActive ? `Remove ${playerName}?` : `Reactivate ${playerName}?`}
        message={
          isActive
            ? `${playerName} will be marked as dropped and excluded from future rounds.`
            : `${playerName} will be re-added to the active player list for future rounds.`
        }
        confirmLabel={isActive ? 'Remove' : 'Reactivate'}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isLoading={isPending}
      />
    </>
  )
}
