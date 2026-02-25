import { useCountdown } from '@/hooks/useCountdown'
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

export function TimerDisplay({ timer }: TimerDisplayProps) {
  const countdown = useCountdown(timer)

  if (!countdown) return null

  const statusLabel = countdown.isPaused
    ? 'PAUSED'
    : countdown.isOvertime
      ? 'OVERTIME'
      : `Round Timer`

  return (
    <div
      className={`sticky top-0 z-40 w-full max-w-lg border rounded-xl p-4 text-center ${urgencyStyles[countdown.urgency]}`}
      data-testid="timer-display"
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
    </div>
  )
}
