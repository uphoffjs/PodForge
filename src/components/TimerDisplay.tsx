import { useCountdown } from '@/hooks/useCountdown'
import { useTimerNotification } from '@/hooks/useTimerNotification'
import type { RoundTimer } from '@/types/database'

interface TimerDisplayProps {
  timer: RoundTimer
}

const urgencyStyles = {
  normal: 'bg-surface-raised text-text-primary border-border',
  warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  danger: 'bg-red-900/30 text-red-400 border-red-700',
  expired: 'bg-red-900/50 text-red-300 border-red-500 animate-pulse',
} as const

// Flat, single-color bands for the non-main phases of an 80+20 timer. The main
// phase deliberately keeps the urgencyStyles progression above so plain
// 60/90/120 timers do not regress (09-UI-SPEC Open Question Resolution).
const phaseBands = {
  'not-started': 'bg-surface-raised text-text-secondary border-border',
  overtime: 'bg-accent/15 text-accent-bright border-accent',
  countup: 'bg-red-900/50 text-red-300 border-red-500 animate-pulse',
} as const

export function TimerDisplay({ timer }: TimerDisplayProps) {
  const countdown = useCountdown(timer)
  const { isSupported, permission, requestPermission } = useTimerNotification(timer, countdown)

  if (!countdown) return null

  // Phase-first band selection: main falls back to the urgency progression;
  // every other phase uses its flat band.
  const band =
    countdown.phase === 'main'
      ? urgencyStyles[countdown.urgency]
      : phaseBands[countdown.phase]
  const dimmed = countdown.isPaused ? 'opacity-70' : ''

  const statusLabel = countdown.isPaused
    ? 'PAUSED'
    : countdown.phase === 'not-started'
      ? 'READY TO START'
      : countdown.phase === 'overtime'
        ? 'OVERTIME'
        : countdown.phase === 'countup'
          ? 'OVERRUN'
          : 'ROUND TIMER'

  return (
    <div
      className={`sticky top-0 z-40 w-full max-w-lg border rounded-xl p-4 text-center ${band} ${dimmed}`}
      data-testid="timer-display"
      data-phase={countdown.phase}
    >
      <div
        className="text-4xl md:text-5xl font-mono font-bold"
        data-testid="timer-countdown"
      >
        {countdown.display}
      </div>
      <div
        className="mt-1 text-sm font-medium uppercase tracking-wide opacity-80"
        data-testid="timer-status"
      >
        {statusLabel}
      </div>

      {isSupported && permission === 'default' && (
        <div
          className="mt-2 flex items-center justify-center gap-2 text-xs text-text-secondary"
          data-testid="timer-notification-prompt"
        >
          <span>Get alerted when time is up</span>
          <button
            type="button"
            onClick={requestPermission}
            className="rounded bg-white/10 px-2 py-0.5 font-medium hover:bg-white/20 transition-colors"
            data-testid="timer-notification-enable-btn"
          >
            Enable
          </button>
        </div>
      )}

      {isSupported && permission === 'denied' && (
        <div className="mt-2 text-xs text-text-secondary opacity-60">
          Notifications blocked
        </div>
      )}
    </div>
  )
}
