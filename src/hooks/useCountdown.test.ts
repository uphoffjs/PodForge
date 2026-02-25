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
})
