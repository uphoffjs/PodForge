import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from './useCountdown'
import type { RoundTimer } from '@/types/database'

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
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when timer is null', () => {
    const { result } = renderHook(() => useCountdown(null))
    expect(result.current).toBeNull()
  })

  it('returns null when timer is cancelled', () => {
    const timer = makeTimer({ status: 'cancelled' })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current).toBeNull()
  })

  it('calculates remaining seconds correctly from expires_at for running timer', () => {
    // Set expires_at to 1800 seconds (30 min) from now
    const expiresAt = new Date(Date.now() + 1800 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current).not.toBeNull()
    // Should be approximately 1800 (could be 1799 due to floor)
    expect(result.current!.remainingSeconds).toBeGreaterThanOrEqual(1799)
    expect(result.current!.remainingSeconds).toBeLessThanOrEqual(1800)
  })

  it('returns static remaining_seconds when paused (no countdown)', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 450,
      paused_at: '2026-01-01T00:10:00Z',
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current).not.toBeNull()
    expect(result.current!.remainingSeconds).toBe(450)
    expect(result.current!.isPaused).toBe(true)
  })

  it('formats display as "mm:ss" for positive remaining', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 330, // 5:30
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.display).toBe('5:30')
  })

  it('formats display as "+m:ss" for overtime (negative remaining)', () => {
    // expires_at in the past by 150 seconds (2:30 overtime)
    const expiresAt = new Date(Date.now() - 150 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.display).toBe('+2:30')
    expect(result.current!.isOvertime).toBe(true)
  })

  it('computes urgency "normal" for >10min remaining', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 700, // ~11.7 min
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.urgency).toBe('normal')
  })

  it('computes urgency "warning" for 5-10min remaining', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 450, // 7.5 min
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.urgency).toBe('warning')
  })

  it('computes urgency "danger" for 0-5min remaining', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 120, // 2 min
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.urgency).toBe('danger')
  })

  it('computes urgency "expired" for <=0 remaining', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 0,
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.urgency).toBe('expired')
  })

  it('updates every second when running', () => {
    // 10 seconds from now
    const expiresAt = new Date(Date.now() + 10 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt })

    const { result } = renderHook(() => useCountdown(timer))

    const initialRemaining = result.current!.remainingSeconds

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Should have decreased by approximately 1 second
    expect(result.current!.remainingSeconds).toBe(initialRemaining - 1)
  })

  it('stops updating when paused', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 500,
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.remainingSeconds).toBe(500)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Should NOT have changed -- paused timers don't tick
    expect(result.current!.remainingSeconds).toBe(500)
  })

  it('sets isOvertime=true when remaining <= 0, false otherwise', () => {
    // Positive remaining
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 60,
    })

    const { result: result1 } = renderHook(() => useCountdown(timer))
    expect(result1.current!.isOvertime).toBe(false)

    // Zero remaining
    const timerZero = makeTimer({
      status: 'paused',
      remaining_seconds: 0,
    })

    const { result: result2 } = renderHook(() => useCountdown(timerZero))
    expect(result2.current!.isOvertime).toBe(true)
  })

  it('formats large remaining times correctly (e.g. 90:00)', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 5400, // 90 min
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.display).toBe('90:00')
  })

  it('formats zero remaining as "0:00"', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: 0,
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.display).toBe('0:00')
  })

  it('clears existing interval when timer prop changes to a different running timer', () => {
    // First timer: 10 seconds from now
    const expiresAt1 = new Date(Date.now() + 10 * 1000).toISOString()
    const timer1 = makeTimer({ id: 'timer-1', status: 'running', expires_at: expiresAt1 })

    const { result, rerender } = renderHook(
      ({ timer }) => useCountdown(timer),
      { initialProps: { timer: timer1 as RoundTimer | null } }
    )

    // Timer 1 is running and interval is set up
    expect(result.current).not.toBeNull()
    const initialRemaining = result.current!.remainingSeconds

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current!.remainingSeconds).toBe(initialRemaining - 1)

    // Switch to a different running timer (exercises lines 52-55: clearing old interval)
    const expiresAt2 = new Date(Date.now() + 60 * 1000).toISOString()
    const timer2 = makeTimer({ id: 'timer-2', status: 'running', expires_at: expiresAt2 })

    rerender({ timer: timer2 })

    // New timer should have different remaining seconds
    expect(result.current).not.toBeNull()
    const newRemaining = result.current!.remainingSeconds
    expect(newRemaining).toBeGreaterThan(initialRemaining - 2)

    // Verify the new interval works
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current!.remainingSeconds).toBe(newRemaining - 1)
  })

  it('clears existing interval when timer prop changes to null', () => {
    const expiresAt = new Date(Date.now() + 10 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt })

    const { result, rerender } = renderHook(
      ({ timer: t }) => useCountdown(t),
      { initialProps: { timer: timer as RoundTimer | null } }
    )

    expect(result.current).not.toBeNull()

    // Switch to null timer (exercises lines 52-55 clearing interval, then line 57 early return)
    rerender({ timer: null })

    expect(result.current).toBeNull()
  })

  it('uses 0 as fallback when paused timer has null remaining_seconds', () => {
    const timer = makeTimer({
      status: 'paused',
      remaining_seconds: null,
    })

    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current).not.toBeNull()
    expect(result.current!.remainingSeconds).toBe(0)
    expect(result.current!.display).toBe('0:00')
    expect(result.current!.isPaused).toBe(true)
  })

  it('urgency is "warning" at exactly 600 seconds (boundary)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 600 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.urgency).toBe('warning')
  })

  it('urgency is "normal" at 601 seconds (boundary)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 601 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.urgency).toBe('normal')
  })

  it('urgency is "danger" at exactly 300 seconds (boundary)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 300 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.urgency).toBe('danger')
  })

  it('urgency is "warning" at 301 seconds (boundary)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 301 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.urgency).toBe('warning')
  })

  it('urgency is "danger" at 1 second remaining (boundary)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 1 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.urgency).toBe('danger')
  })

  it('formats 120 seconds as "2:00"', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 120 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.display).toBe('2:00')
  })

  it('formats overtime -120 seconds as "+2:00"', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -120 })
    const { result } = renderHook(() => useCountdown(timer))
    expect(result.current!.display).toBe('+2:00')
    expect(result.current!.isOvertime).toBe(true)
  })

  it('clears interval on timer change (spy on clearInterval)', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const expiresAt1 = new Date(Date.now() + 10 * 1000).toISOString()
    const timer1 = makeTimer({ id: 'timer-1', status: 'running', expires_at: expiresAt1 })

    const { rerender } = renderHook(
      ({ timer }) => useCountdown(timer),
      { initialProps: { timer: timer1 as RoundTimer | null } }
    )

    clearIntervalSpy.mockClear()

    // Switch to a different timer
    const expiresAt2 = new Date(Date.now() + 60 * 1000).toISOString()
    const timer2 = makeTimer({ id: 'timer-2', status: 'running', expires_at: expiresAt2 })
    rerender({ timer: timer2 })

    expect(clearIntervalSpy).toHaveBeenCalled()

    clearIntervalSpy.mockRestore()
  })

  it('handles rapid timer changes without leaking intervals', () => {
    const expiresAt1 = new Date(Date.now() + 10 * 1000).toISOString()
    const timer1 = makeTimer({ id: 'timer-1', status: 'running', expires_at: expiresAt1 })

    const { result, rerender } = renderHook(
      ({ timer }) => useCountdown(timer),
      { initialProps: { timer: timer1 as RoundTimer | null } }
    )

    expect(result.current).not.toBeNull()

    // Rapidly change timers
    const expiresAt2 = new Date(Date.now() + 20 * 1000).toISOString()
    const timer2 = makeTimer({ id: 'timer-2', status: 'running', expires_at: expiresAt2 })
    rerender({ timer: timer2 })

    const expiresAt3 = new Date(Date.now() + 30 * 1000).toISOString()
    const timer3 = makeTimer({ id: 'timer-3', status: 'running', expires_at: expiresAt3 })
    rerender({ timer: timer3 })

    // Should work correctly with the latest timer
    expect(result.current).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Verify it's tracking the latest timer (approximately 29 seconds remaining)
    expect(result.current!.remainingSeconds).toBeGreaterThanOrEqual(28)
  })
})

describe('useCountdown three-phase derivation (80+20)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("derives phase 'main' with full main display when mainRemaining > 0 (75:00)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 4500, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('main')
    expect(result.current!.display).toBe('75:00')
    expect(result.current!.remainingSeconds).toBe(4500)
    expect(result.current!.isOvertime).toBe(false)
  })

  it("derives phase 'overtime' at the main boundary mainRemaining = 0 (20:00)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 0, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.display).toBe('20:00')
    expect(result.current!.isOvertime).toBe(true)
  })

  it("derives phase 'main' at mainRemaining = 1 (kills > vs >= boundary mutant)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 1, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('main')
    expect(result.current!.display).toBe('0:01')
  })

  it("derives phase 'overtime' for a running timer at mainRemaining = -300 (15:00, kills + vs - mutant)", () => {
    const expiresAt = new Date(Date.now() - 300 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.display).toBe('15:00')
    expect(result.current!.remainingSeconds).toBe(-300)
  })

  it("derives phase 'countup' at overtimeRemaining = 0 (0:00, kills second boundary mutant)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -1200, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('countup')
    expect(result.current!.display).toBe('0:00')
  })

  it("derives phase 'overtime' at overtimeRemaining = 1 (0:01, kills second boundary mutant)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -1199, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.display).toBe('0:01')
  })

  it("derives phase 'countup' for a running timer at mainRemaining = -1320 (+2:00)", () => {
    const expiresAt = new Date(Date.now() - 1320 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('countup')
    expect(result.current!.display).toBe('+2:00')
  })

  it("derives phase 'overtime' from signed paused remaining_seconds = -300 (15:00)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -300, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.display).toBe('15:00')
    expect(result.current!.remainingSeconds).toBe(-300)
    expect(result.current!.isOvertime).toBe(true)
  })

  it("derives phase 'countup' from signed paused remaining_seconds = -1320 (+2:00)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -1320, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('countup')
    expect(result.current!.display).toBe('+2:00')
  })

  it('backward compat: overtime_seconds = 0 reproduces single-phase count-up (+1:30)', () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -90, overtime_seconds: 0 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('countup')
    expect(result.current!.display).toBe('+1:30')
    expect(result.current!.isOvertime).toBe(true)
  })

  it("maps urgency to 'danger' in the overtime phase (keeps 4-value union)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -300, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.urgency).toBe('danger')
  })

  it("maps urgency to 'expired' in the count-up phase (keeps 4-value union)", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: -1320, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('countup')
    expect(result.current!.urgency).toBe('expired')
  })

  it("maps urgency via main-phase thresholds when phase is 'main'", () => {
    const timer = makeTimer({ status: 'paused', remaining_seconds: 450, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('main')
    expect(result.current!.urgency).toBe('warning')
  })

  it('recomputes phase each tick: main crosses into overtime as the clock advances', () => {
    // 2 seconds left in main, 1200s overtime configured
    const expiresAt = new Date(Date.now() + 2 * 1000).toISOString()
    const timer = makeTimer({ status: 'running', expires_at: expiresAt, overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('main')
    expect(result.current!.display).toBe('0:02')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // mainRemaining is now -1 → overtime phase, display 1200 - 1 = 19:59
    expect(result.current!.phase).toBe('overtime')
    expect(result.current!.display).toBe('19:59')
  })

  it('does not start an interval for a paused timer (kills the running-only tick-guard mutant)', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const timer = makeTimer({ status: 'paused', remaining_seconds: 500, overtime_seconds: 1200 })

    renderHook(() => useCountdown(timer))

    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })

  it('reports isPaused=false and isCancelled=false for a running timer', () => {
    const timer = makeTimer({ status: 'running', overtime_seconds: 1200 })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.isPaused).toBe(false)
    expect(result.current!.isCancelled).toBe(false)
  })
})

describe('useCountdown not-started (pending) state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns a static not-started state for a pending 80+20 timer (80:00)", () => {
    const timer = makeTimer({
      status: 'pending',
      duration_minutes: 80,
      overtime_seconds: 1200,
    })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current).not.toBeNull()
    expect(result.current!.phase).toBe('not-started')
    expect(result.current!.display).toBe('80:00')
    expect(result.current!.remainingSeconds).toBe(80 * 60)
    expect(result.current!.isOvertime).toBe(false)
    expect(result.current!.isPaused).toBe(false)
    expect(result.current!.isCancelled).toBe(false)
    expect(result.current!.urgency).toBe('normal')
  })

  it("derives the pending display from duration_minutes, not expires_at (60:00)", () => {
    // expires_at is in the past — a pending timer must IGNORE it and show duration.
    const timer = makeTimer({
      status: 'pending',
      duration_minutes: 60,
      overtime_seconds: 0,
      expires_at: new Date(Date.now() - 5000 * 1000).toISOString(),
    })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('not-started')
    expect(result.current!.display).toBe('60:00')
    expect(result.current!.remainingSeconds).toBe(60 * 60)
    expect(result.current!.isOvertime).toBe(false)
  })

  it("does NOT start a setInterval for a pending timer", () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const timer = makeTimer({
      status: 'pending',
      duration_minutes: 80,
      overtime_seconds: 1200,
    })

    renderHook(() => useCountdown(timer))

    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })

  it("static pending display does not change when fake timers advance", () => {
    const timer = makeTimer({
      status: 'pending',
      duration_minutes: 80,
      overtime_seconds: 1200,
    })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.display).toBe('80:00')

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current!.display).toBe('80:00')
    expect(result.current!.remainingSeconds).toBe(80 * 60)
  })

  it("regression: a running 80+20 timer still derives main/overtime via derivePhase", () => {
    // 75:00 of main remaining, 1200s overtime — must NOT be treated as not-started.
    const timer = makeTimer({
      status: 'running',
      duration_minutes: 80,
      overtime_seconds: 1200,
      expires_at: new Date(Date.now() + 4500 * 1000).toISOString(),
    })
    const { result } = renderHook(() => useCountdown(timer))

    expect(result.current!.phase).toBe('main')
    expect(result.current!.display).toBe('75:00')
    expect(result.current!.isOvertime).toBe(false)
  })
})
