import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimerNotification } from './useTimerNotification'
import type { RoundTimer } from '@/types/database'
import type { CountdownState } from '@/hooks/useCountdown'

function makeTimer(overrides: Partial<RoundTimer> = {}): RoundTimer {
  return {
    id: 'timer-1',
    round_id: 'round-1',
    event_id: 'evt-1',
    duration_minutes: 60,
    status: 'running',
    started_at: '2026-01-01T00:00:00Z',
    remaining_seconds: null,
    paused_at: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCountdown(overrides: Partial<CountdownState> = {}): CountdownState {
  return {
    remainingSeconds: 300,
    display: '5:00',
    isOvertime: false,
    isPaused: false,
    isCancelled: false,
    urgency: 'danger',
    ...overrides,
  }
}

function makeExpiredCountdown(overrides: Partial<CountdownState> = {}): CountdownState {
  return makeCountdown({
    remainingSeconds: -10,
    display: '+0:10',
    isOvertime: true,
    urgency: 'expired',
    ...overrides,
  })
}

// Store original Notification
const OriginalNotification = globalThis.Notification

describe('useTimerNotification', () => {
  let mockNotificationConstructor: ReturnType<typeof vi.fn>
  let mockRequestPermission: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockNotificationConstructor = vi.fn()
    mockRequestPermission = vi.fn().mockResolvedValue('granted')

    Object.defineProperty(window, 'Notification', {
      value: Object.assign(mockNotificationConstructor, {
        permission: 'default' as NotificationPermission,
        requestPermission: mockRequestPermission,
      }),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Restore original Notification if it existed
    if (OriginalNotification) {
      Object.defineProperty(window, 'Notification', {
        value: OriginalNotification,
        writable: true,
        configurable: true,
      })
    }
  })

  it('isSupported is true when Notification exists in window', () => {
    const { result } = renderHook(() =>
      useTimerNotification(null, null)
    )
    expect(result.current.isSupported).toBe(true)
  })

  it('permission reflects Notification.permission', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const { result } = renderHook(() =>
      useTimerNotification(null, null)
    )
    expect(result.current.permission).toBe('granted')
  })

  it('requestPermission calls Notification.requestPermission and updates state', async () => {
    mockRequestPermission.mockResolvedValue('granted')

    const { result } = renderHook(() =>
      useTimerNotification(null, null)
    )

    expect(result.current.permission).toBe('default')

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(mockRequestPermission).toHaveBeenCalledOnce()
    expect(result.current.permission).toBe('granted')
  })

  it('requestPermission catches errors gracefully (iOS PWA simulation)', async () => {
    mockRequestPermission.mockRejectedValue(new Error('iOS PWA error'))

    const { result } = renderHook(() =>
      useTimerNotification(null, null)
    )

    await act(async () => {
      await result.current.requestPermission()
    })

    // Should not throw, should set permission to 'denied'
    expect(result.current.permission).toBe('denied')
  })

  it('fires notification when countdown transitions to overtime', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()
    const countdown = makeExpiredCountdown()

    const { result } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: countdown } }
    )

    // Notification should fire because permission is granted and we force-read it on init
    // We need to re-init the hook so it reads 'granted' from start
    expect(result.current.permission).toBe('granted')
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      "Time's Up!",
      expect.objectContaining({
        body: 'Round timer has expired',
        tag: 'timer-expired',
      })
    )
  })

  it('does NOT fire notification twice for the same timer', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()
    const expired = makeExpiredCountdown()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: expired } }
    )

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // Re-render with the same timer (e.g., different remaining seconds)
    const moreExpired = makeExpiredCountdown({ remainingSeconds: -20 })
    rerender({ t: timer, c: moreExpired })

    // Should still only have been called once
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
  })

  it('fires notification again for a different timer (new timer.id)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer1 = makeTimer({ id: 'timer-1' })
    const timer2 = makeTimer({ id: 'timer-2' })
    const expired = makeExpiredCountdown()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer1, c: expired } }
    )

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // Switch to a new timer that is also expired
    rerender({ t: timer2, c: expired })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2)
  })

  it('does NOT fire notification when permission is denied', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'denied'

    const timer = makeTimer()
    const expired = makeExpiredCountdown()

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: expired } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire notification when permission is default', () => {
    const timer = makeTimer()
    const expired = makeExpiredCountdown()

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: expired } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire notification when timer is paused', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer({ status: 'paused' })
    const pausedCountdown = makeCountdown({
      remainingSeconds: -5,
      isOvertime: true,
      isPaused: true,
      urgency: 'expired',
    })

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: pausedCountdown } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire notification when countdown is null', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer as RoundTimer | null, c: null as CountdownState | null } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('handles Notification constructor throwing (iOS PWA fallback)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'
    mockNotificationConstructor.mockImplementation(() => {
      throw new Error('iOS PWA: Notification not supported')
    })

    const timer = makeTimer()
    const expired = makeExpiredCountdown()

    // Should not throw
    expect(() => {
      renderHook(
        ({ t, c }) => useTimerNotification(t, c),
        { initialProps: { t: timer, c: expired } }
      )
    }).not.toThrow()
  })

  it('returns isSupported=false and permission="unsupported" when Notification is not in window', () => {
    // Temporarily remove Notification from window
    const savedNotification = window.Notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification

    const { result } = renderHook(() => useTimerNotification(null, null))

    expect(result.current.isSupported).toBe(false)
    expect(result.current.permission).toBe('unsupported')

    // Restore
    Object.defineProperty(window, 'Notification', {
      value: savedNotification,
      writable: true,
      configurable: true,
    })
  })

  it('requestPermission returns early when Notification is not supported', async () => {
    const savedNotification = window.Notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification

    const { result } = renderHook(() => useTimerNotification(null, null))

    await act(async () => {
      await result.current.requestPermission()
    })

    // Should still be 'unsupported' - no error thrown
    expect(result.current.permission).toBe('unsupported')

    // Restore
    Object.defineProperty(window, 'Notification', {
      value: savedNotification,
      writable: true,
      configurable: true,
    })
  })

  it('returns permission "unsupported" when Notification.permission getter throws', () => {
    // Create a Notification mock where accessing .permission throws
    const throwingNotification = Object.assign(vi.fn(), {
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    Object.defineProperty(throwingNotification, 'permission', {
      get() {
        throw new Error('SecurityError: blocked')
      },
      configurable: true,
    })
    Object.defineProperty(window, 'Notification', {
      value: throwingNotification,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useTimerNotification(null, null))

    expect(result.current.permission).toBe('unsupported')
  })

  it('resets lastNotifiedTimerId when timer changes, allowing notification for new timer', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer1 = makeTimer({ id: 'timer-1' })
    const expired = makeExpiredCountdown()
    const notExpired = makeCountdown({ remainingSeconds: 300, isOvertime: false })

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer1, c: expired } }
    )

    // First timer expired, notification fires
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // Switch to timer-2 that is NOT expired yet (this resets the lastNotifiedTimerId ref via the effect on line 66-68)
    const timer2 = makeTimer({ id: 'timer-2' })
    rerender({ t: timer2, c: notExpired })

    // No new notification for non-expired timer
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // Now timer-2 expires - should fire because the ref was reset
    rerender({ t: timer2, c: expired })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2)
  })
})
