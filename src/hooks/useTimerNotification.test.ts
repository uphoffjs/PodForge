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
    overtime_seconds: 0,
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
    phase: 'main',
    ...overrides,
  }
}

function makeOvertimeCountdown(overrides: Partial<CountdownState> = {}): CountdownState {
  return makeCountdown({
    remainingSeconds: -300,
    display: '15:00',
    isOvertime: true,
    urgency: 'danger',
    phase: 'overtime',
    ...overrides,
  })
}

function makeCountupCountdown(overrides: Partial<CountdownState> = {}): CountdownState {
  return makeCountdown({
    remainingSeconds: -1320,
    display: '+2:00',
    isOvertime: true,
    urgency: 'expired',
    phase: 'countup',
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

  // ---------------------------------------------------------------------------
  // Support / permission surface (unchanged behavior)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Phase-transition notifications (TIMER-05)
  // ---------------------------------------------------------------------------

  it('does NOT fire on initial mount, even directly into overtime (prevPhase null)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: makeTimer(), c: makeOvertimeCountdown() } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire on initial mount directly into count-up (refresh-safe)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: makeTimer(), c: makeCountupCountdown() } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it("fires 'Overtime started' exactly once on the main->overtime boundary", () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    // Mount in main: no fire
    expect(mockNotificationConstructor).not.toHaveBeenCalled()

    // Cross into overtime
    rerender({ t: timer, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
    expect(mockNotificationConstructor).toHaveBeenCalledWith('Round Timer', {
      body: 'Overtime started',
      icon: '/favicon.ico',
      tag: 'timer-1:overtime',
    })
  })

  it("fires 'Round over' exactly once on the overtime->count-up boundary", () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeOvertimeCountdown() } }
    )

    // Mount in overtime: no fire (prevPhase null)
    expect(mockNotificationConstructor).not.toHaveBeenCalled()

    // Cross into count-up
    rerender({ t: timer, c: makeCountupCountdown() })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
    expect(mockNotificationConstructor).toHaveBeenCalledWith('Round Timer', {
      body: 'Round over',
      icon: '/favicon.ico',
      tag: 'timer-1:countup',
    })
  })

  it('fires both boundaries once each across main->overtime->count-up', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    rerender({ t: timer, c: makeOvertimeCountdown() })
    rerender({ t: timer, c: makeCountupCountdown() })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2)
    expect(mockNotificationConstructor).toHaveBeenNthCalledWith(1, 'Round Timer', {
      body: 'Overtime started',
      icon: '/favicon.ico',
      tag: 'timer-1:overtime',
    })
    expect(mockNotificationConstructor).toHaveBeenNthCalledWith(2, 'Round Timer', {
      body: 'Round over',
      icon: '/favicon.ico',
      tag: 'timer-1:countup',
    })
  })

  it('does NOT fire on a same-phase re-render in main (Realtime churn)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown({ remainingSeconds: 300 }) } }
    )

    rerender({ t: timer, c: makeCountdown({ remainingSeconds: 299 }) })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire on a same-phase re-render in overtime (Realtime churn)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeOvertimeCountdown() } }
    )

    // Already crossed overtime before mount (prevPhase null), churn stays overtime
    rerender({ t: timer, c: makeOvertimeCountdown({ remainingSeconds: -301 }) })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('de-dupes: two main->overtime crossings for the same timer fire only once', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    // main -> overtime (fires)
    rerender({ t: timer, c: makeOvertimeCountdown() })
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // overtime -> main (e.g. an extend pulled it back), no fire
    rerender({ t: timer, c: makeCountdown() })

    // main -> overtime AGAIN — Set dedup must suppress the second fire
    rerender({ t: timer, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
  })

  it('resets dedup state for a new timer.id so its first boundary notifies fresh', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer1 = makeTimer({ id: 'timer-1' })
    const timer2 = makeTimer({ id: 'timer-2' })

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer1, c: makeCountdown() } }
    )

    // timer-1 crosses into overtime
    rerender({ t: timer1, c: makeOvertimeCountdown() })
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // Switch to a brand-new timer starting in main
    rerender({ t: timer2, c: makeCountdown() })
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // timer-2 crosses into overtime — fires fresh (Set was reset)
    rerender({ t: timer2, c: makeOvertimeCountdown() })
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2)
    expect(mockNotificationConstructor).toHaveBeenLastCalledWith('Round Timer', {
      body: 'Overtime started',
      icon: '/favicon.ico',
      tag: 'timer-2:overtime',
    })
  })

  it('does NOT fire when switching to a timer already past the boundary (pre-switch crossing)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer1 = makeTimer({ id: 'timer-1' })
    const timer2 = makeTimer({ id: 'timer-2' })

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer1, c: makeCountdown() } }
    )

    // Switch to a different timer that is ALREADY in overtime — boundary crossed before observing
    rerender({ t: timer2, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when timer object changes but timer.id is unchanged', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer1 = makeTimer({ id: 'timer-1' })

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer1, c: makeCountdown() } }
    )

    rerender({ t: timer1, c: makeOvertimeCountdown() })
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)

    // New timer object, SAME id (re-fetch) — must not reset dedup, must not re-fire
    const timer1Again = makeTimer({ id: 'timer-1', duration_minutes: 90 })
    rerender({ t: timer1Again, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when permission is denied during a real transition', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'denied'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    rerender({ t: timer, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when permission is default during a real transition', () => {
    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    rerender({ t: timer, c: makeOvertimeCountdown() })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when the timer is paused across a phase change', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer({ status: 'paused' })

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown({ isPaused: true }) } }
    )

    rerender({ t: timer, c: makeOvertimeCountdown({ isPaused: true }) })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when the countdown is cancelled across a phase change', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown({ isCancelled: true }) } }
    )

    rerender({ t: timer, c: makeOvertimeCountdown({ isCancelled: true }) })

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when countdown is null', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: makeTimer() as RoundTimer | null, c: null as CountdownState | null } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('does NOT fire when timer is null but countdown is in overtime', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'

    renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: null as RoundTimer | null, c: makeOvertimeCountdown() as CountdownState | null } }
    )

    expect(mockNotificationConstructor).not.toHaveBeenCalled()
  })

  it('handles the Notification constructor throwing on a boundary (iOS PWA fallback)', () => {
    ;(window.Notification as unknown as { permission: string }).permission = 'granted'
    mockNotificationConstructor.mockImplementation(() => {
      throw new Error('iOS PWA: Notification not supported')
    })

    const timer = makeTimer()

    const { rerender } = renderHook(
      ({ t, c }) => useTimerNotification(t, c),
      { initialProps: { t: timer, c: makeCountdown() } }
    )

    expect(() => {
      rerender({ t: timer, c: makeOvertimeCountdown() })
    }).not.toThrow()

    // It still attempted to construct the notification
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
  })
})
