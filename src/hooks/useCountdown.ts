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
  /** Current timer phase (source of truth for three-phase 80+20 timers) */
  phase: 'main' | 'overtime' | 'countup'
}

function computeRemaining(timer: RoundTimer): number {
  if (timer.status === 'paused') {
    return timer.remaining_seconds ?? 0
  }
  // Running: compute from expires_at
  return Math.floor((new Date(timer.expires_at).getTime() - Date.now()) / 1000)
}

// Only called for the main phase, where mainRemaining > 0 is guaranteed by
// derivePhase. Overtime → 'danger' and count-up → 'expired' are mapped in
// phaseUrgency, so this never needs to handle remaining <= 0.
function computeUrgency(remaining: number): CountdownState['urgency'] {
  if (remaining > 600) return 'normal'
  if (remaining > 300) return 'warning'
  return 'danger'
}

/**
 * Derive the current phase and the seconds to display from the signed main
 * remaining plus the configured overtime length. The whole three-phase model
 * collapses to: overtimeRemaining = mainRemaining + overtimeSeconds.
 */
function derivePhase(
  mainRemaining: number,
  overtimeSeconds: number
): { phase: CountdownState['phase']; displaySeconds: number } {
  const overtimeRemaining = mainRemaining + overtimeSeconds
  if (mainRemaining > 0) {
    return { phase: 'main', displaySeconds: mainRemaining }
  }
  if (overtimeRemaining > 0) {
    return { phase: 'overtime', displaySeconds: overtimeRemaining }
  }
  return { phase: 'countup', displaySeconds: overtimeRemaining }
}

/** Map a phase to the existing 4-value urgency union (Phase 9 owns distinct styling). */
function phaseUrgency(phase: CountdownState['phase'], mainRemaining: number): CountdownState['urgency'] {
  if (phase === 'main') return computeUrgency(mainRemaining)
  if (phase === 'overtime') return 'danger'
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
    // Stryker disable next-line ConditionalExpression: the `=== 'cancelled'` branch here is an
    // equivalent mutant — the render guard below returns null for cancelled timers regardless, and a
    // cancelled timer (status !== 'running') never starts an interval, so skipping vs. running this
    // effect has no observable effect. The user-facing guard is the one at the bottom of the hook.
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

  // remainingSeconds holds the signed mainRemaining (see computeRemaining); the
  // per-tick effect keeps it fresh, so phase/display recompute every second.
  // overtime_seconds is NOT NULL (0 for plain timers) per the RoundTimer type.
  const { phase, displaySeconds } = derivePhase(remainingSeconds, timer.overtime_seconds)

  return {
    remainingSeconds,
    display: formatDisplay(displaySeconds),
    isOvertime: remainingSeconds <= 0,
    isPaused: timer.status === 'paused',
    isCancelled: false,
    urgency: phaseUrgency(phase, remainingSeconds),
    phase,
  }
}
