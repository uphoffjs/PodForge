import { useState, useEffect, useRef } from 'react'
import type { RoundTimer } from '@/types/database'

export interface CountdownState {
  /** Total remaining seconds (negative = overtime) */
  remainingSeconds: number
  /** Formatted display string: "45:30" or "+2:30" for overtime */
  display: string
  /** true when timer has passed zero */
  isOvertime: boolean
  /** true when timer is paused */
  isPaused: boolean
  /** true when timer is cancelled */
  isCancelled: boolean
  /** Urgency level for styling */
  urgency: 'normal' | 'warning' | 'danger' | 'expired'
}

function computeRemaining(timer: RoundTimer): number {
  if (timer.status === 'paused') {
    return timer.remaining_seconds ?? 0
  }
  // Running: compute from expires_at
  return Math.floor((new Date(timer.expires_at).getTime() - Date.now()) / 1000)
}

function computeUrgency(remaining: number): CountdownState['urgency'] {
  if (remaining > 600) return 'normal'
  if (remaining > 300) return 'warning'
  if (remaining > 0) return 'danger'
  return 'expired'
}

function formatDisplay(remaining: number): string {
  if (remaining >= 0) {
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  const abs = Math.abs(remaining)
  const minutes = Math.floor(abs / 60)
  const seconds = abs % 60
  return `+${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function useCountdown(timer: RoundTimer | null): CountdownState | null {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!timer || timer.status === 'cancelled') {
      return
    }

    // Set initial remaining
    const initial = computeRemaining(timer)
    setRemainingSeconds(initial) // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: sync countdown with timer prop

    // Only tick when running
    if (timer.status === 'running') {
      intervalRef.current = setInterval(() => {
        const remaining = computeRemaining(timer)
        setRemainingSeconds(remaining)
      }, 1000)
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timer])

  if (!timer || timer.status === 'cancelled') {
    return null
  }

  return {
    remainingSeconds,
    display: formatDisplay(remainingSeconds),
    isOvertime: remainingSeconds <= 0,
    isPaused: timer.status === 'paused',
    isCancelled: false,
    urgency: computeUrgency(remainingSeconds),
  }
}
