import { useEffect, useRef, useCallback, useState } from 'react'
import type { RoundTimer } from '@/types/database'
import type { CountdownState } from '@/hooks/useCountdown'

export interface UseTimerNotificationReturn {
  /** Whether the browser supports notifications */
  isSupported: boolean
  /** Current permission state: 'default' | 'granted' | 'denied' | 'unsupported' */
  permission: NotificationPermission | 'unsupported'
  /** Request notification permission (call on user interaction, NOT on mount) */
  requestPermission: () => Promise<void>
}

export function useTimerNotification(
  timer: RoundTimer | null,
  countdown: CountdownState | null
): UseTimerNotificationReturn {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!isSupported) return 'unsupported'
    try {
      return Notification.permission
    } catch {
      return 'unsupported'
    }
  })

  // Per-boundary dedup keyed by `${timer.id}:overtime` / `${timer.id}:countup`.
  // Keying on the id (not the timer object reference) survives Realtime row churn.
  const notifiedRef = useRef<Set<string>>(new Set())
  // Last observed phase for the current timer; null = no baseline yet (fresh
  // mount or a just-switched timer.id) so a boundary crossed before we observed
  // it is never re-announced (refresh/reconnect safe — TIMER-06).
  const prevPhaseRef = useRef<string | null>(null)
  const prevTimerIdRef = useRef<string | null>(null)

  const requestPermission = useCallback(async () => {
    if (!isSupported) return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch {
      setPermission('denied')
    }
  }, [isSupported])

  // Fire a browser notification exactly once at each forward phase boundary
  // (main->overtime, overtime->count-up), deduped per boundary.
  useEffect(() => {
    if (!countdown || !timer) return
    if (countdown.isPaused || countdown.isCancelled) return

    // A new timer.id resets dedup + phase tracking. The first phase we observe
    // for a timer is a baseline, never a crossing — so switching into a timer
    // already past a boundary does not spuriously fire.
    if (prevTimerIdRef.current !== timer.id) {
      prevTimerIdRef.current = timer.id
      notifiedRef.current.clear()
      prevPhaseRef.current = null
    }

    const phase = countdown.phase
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (prev === null) return
    if (permission !== 'granted') return

    const fireOnce = (key: string, body: string) => {
      if (notifiedRef.current.has(key)) return
      notifiedRef.current.add(key)
      try {
        new Notification('Round Timer', {
          body,
          icon: '/favicon.ico',
          tag: key,
        })
      } catch {
        // iOS PWA: Notification constructor may throw — silently fail
      }
    }

    if (prev === 'main' && phase === 'overtime') {
      fireOnce(`${timer.id}:overtime`, 'Overtime started')
    }
    if (prev === 'overtime' && phase === 'countup') {
      fireOnce(`${timer.id}:countup`, 'Round over')
    }
  }, [countdown, timer, permission])

  return {
    isSupported,
    permission,
    requestPermission,
  }
}
