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

  const lastNotifiedTimerIdRef = useRef<string | null>(null)

  const requestPermission = useCallback(async () => {
    if (!isSupported) return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch {
      setPermission('denied')
    }
  }, [isSupported])

  // Fire notification when timer reaches zero
  useEffect(() => {
    if (!countdown || !timer) return
    if (countdown.isPaused || countdown.isCancelled) return

    if (countdown.remainingSeconds <= 0 && countdown.isOvertime) {
      if (lastNotifiedTimerIdRef.current !== timer.id) {
        lastNotifiedTimerIdRef.current = timer.id
        if (permission === 'granted') {
          try {
            new Notification("Time's Up!", {
              body: 'Round timer has expired',
              icon: '/favicon.ico',
              tag: 'timer-expired',
            })
          } catch {
            // iOS PWA: Notification constructor may throw — silently fail
          }
        }
      }
    }
  }, [countdown, timer, permission])

  // Reset lastNotifiedTimerId when timer changes to a new one
  useEffect(() => {
    if (timer && lastNotifiedTimerIdRef.current !== null && lastNotifiedTimerIdRef.current !== timer.id) {
      lastNotifiedTimerIdRef.current = null
    }
  }, [timer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSupported,
    permission,
    requestPermission,
  }
}
