import { useState } from 'react'
import { Pause, Play, Plus, X } from 'lucide-react'
import { usePauseTimer } from '@/hooks/usePauseTimer'
import { useResumeTimer } from '@/hooks/useResumeTimer'
import { useExtendTimer } from '@/hooks/useExtendTimer'
import { useCancelTimer } from '@/hooks/useCancelTimer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  isInvalidPassphraseError,
  INVALID_PASSPHRASE_RETRY_MESSAGE,
} from '@/lib/passphrase-error'
import type { RoundTimer } from '@/types/database'

interface TimerControlsProps {
  eventId: string
  passphrase: string
  timer: RoundTimer
  onPassphraseNeeded: (error?: string) => void
}

export function TimerControls({
  eventId,
  passphrase,
  timer,
  onPassphraseNeeded,
}: TimerControlsProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const pauseTimer = usePauseTimer(eventId)
  const resumeTimer = useResumeTimer(eventId)
  const extendTimer = useExtendTimer(eventId)
  const cancelTimer = useCancelTimer(eventId)

  if (timer.status === 'cancelled') return null

  // Re-open the passphrase modal with inline feedback when a timer mutation is
  // rejected because the stored passphrase is invalid.
  const handlePassphraseRejection = (error: unknown) => {
    if (isInvalidPassphraseError(error)) {
      onPassphraseNeeded(INVALID_PASSPHRASE_RETRY_MESSAGE)
    }
  }

  const handlePause = () => {
    if (!passphrase) {
      onPassphraseNeeded()
      return
    }
    pauseTimer.mutate({ passphrase }, { onError: handlePassphraseRejection })
  }

  const handleResume = () => {
    if (!passphrase) {
      onPassphraseNeeded()
      return
    }
    resumeTimer.mutate({ passphrase }, { onError: handlePassphraseRejection })
  }

  const handleExtend = () => {
    if (!passphrase) {
      onPassphraseNeeded()
      return
    }
    extendTimer.mutate({ passphrase }, { onError: handlePassphraseRejection })
  }

  const handleCancelClick = () => {
    if (!passphrase) {
      onPassphraseNeeded()
      return
    }
    setShowCancelConfirm(true)
  }

  const handleCancelConfirm = () => {
    if (!passphrase) return
    cancelTimer.mutate(
      { passphrase },
      {
        onSuccess: () => setShowCancelConfirm(false),
        onError: (error) => {
          setShowCancelConfirm(false)
          handlePassphraseRejection(error)
        },
      },
    )
  }

  return (
    <div className="w-full max-w-lg flex items-center justify-center gap-2 mt-2 mb-4">
      {timer.status === 'running' ? (
        <button
          type="button"
          onClick={handlePause}
          disabled={pauseTimer.isPending}
          data-testid="timer-pause-btn"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          <Pause className="w-4 h-4" />
          Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={handleResume}
          disabled={resumeTimer.isPending}
          data-testid="timer-resume-btn"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          <Play className="w-4 h-4" />
          Resume
        </button>
      )}

      <button
        type="button"
        onClick={handleExtend}
        disabled={extendTimer.isPending}
        data-testid="timer-extend-btn"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        <Plus className="w-4 h-4" />
        +5 min
      </button>

      <button
        type="button"
        onClick={handleCancelClick}
        disabled={cancelTimer.isPending}
        data-testid="timer-cancel-btn"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-error/40 px-4 py-2 text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Cancel Timer?"
        message="This will remove the timer for this round."
        confirmLabel="Cancel Timer"
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        isLoading={cancelTimer.isPending}
      />
    </div>
  )
}
