import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAdminAuth } from './useAdminAuth'

describe('useAdminAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('isAdmin is false when no passphrase in sessionStorage', () => {
    const { result } = renderHook(() => useAdminAuth('evt1'))

    expect(result.current.isAdmin).toBe(false)
    expect(result.current.passphrase).toBeNull()
  })

  it('isAdmin is true when passphrase exists in sessionStorage', () => {
    sessionStorage.setItem('podforge_admin_evt1', 'secret123')

    const { result } = renderHook(() => useAdminAuth('evt1'))

    expect(result.current.isAdmin).toBe(true)
    expect(result.current.passphrase).toBe('secret123')
  })

  it('setPassphrase stores in sessionStorage and updates isAdmin', () => {
    const { result } = renderHook(() => useAdminAuth('evt1'))

    expect(result.current.isAdmin).toBe(false)

    act(() => {
      result.current.setPassphrase('mypass')
    })

    expect(result.current.isAdmin).toBe(true)
    expect(result.current.passphrase).toBe('mypass')
    expect(sessionStorage.getItem('podforge_admin_evt1')).toBe('mypass')
  })

  it('clearPassphrase removes from sessionStorage and sets isAdmin to false', () => {
    sessionStorage.setItem('podforge_admin_evt1', 'secret123')

    const { result } = renderHook(() => useAdminAuth('evt1'))

    expect(result.current.isAdmin).toBe(true)

    act(() => {
      result.current.clearPassphrase()
    })

    expect(result.current.isAdmin).toBe(false)
    expect(result.current.passphrase).toBeNull()
    expect(sessionStorage.getItem('podforge_admin_evt1')).toBeNull()
  })

  it('different eventIds use different storage keys', () => {
    sessionStorage.setItem('podforge_admin_event-a', 'passA')

    const { result: resultA } = renderHook(() => useAdminAuth('event-a'))
    const { result: resultB } = renderHook(() => useAdminAuth('event-b'))

    expect(resultA.current.isAdmin).toBe(true)
    expect(resultA.current.passphrase).toBe('passA')

    expect(resultB.current.isAdmin).toBe(false)
    expect(resultB.current.passphrase).toBeNull()
  })

  it('storage key uses "podforge_admin_" prefix with eventId', () => {
    const { result } = renderHook(() => useAdminAuth('my-special-event'))

    act(() => {
      result.current.setPassphrase('pass123')
    })

    // Verify the exact key format: prefix + eventId
    expect(sessionStorage.getItem('podforge_admin_my-special-event')).toBe('pass123')
    // Verify no other keys were created
    expect(sessionStorage.length).toBe(1)
  })

  it('setPassphrase callback updates when eventId changes', () => {
    const { result, rerender } = renderHook(
      ({ eventId }) => useAdminAuth(eventId),
      { initialProps: { eventId: 'event-1' } },
    )

    const firstSetPassphrase = result.current.setPassphrase

    rerender({ eventId: 'event-2' })

    const secondSetPassphrase = result.current.setPassphrase

    // useCallback with [eventId] dependency means the reference should change
    expect(firstSetPassphrase).not.toBe(secondSetPassphrase)

    // Verify the new callback writes to the new eventId's key
    act(() => {
      result.current.setPassphrase('newpass')
    })

    expect(sessionStorage.getItem('podforge_admin_event-2')).toBe('newpass')
    // Should NOT have written to the old key
    expect(sessionStorage.getItem('podforge_admin_event-1')).toBeNull()
  })

  it('clearPassphrase callback updates when eventId changes', () => {
    sessionStorage.setItem('podforge_admin_event-1', 'pass1')
    sessionStorage.setItem('podforge_admin_event-2', 'pass2')

    const { result, rerender } = renderHook(
      ({ eventId }) => useAdminAuth(eventId),
      { initialProps: { eventId: 'event-1' } },
    )

    const firstClearPassphrase = result.current.clearPassphrase

    rerender({ eventId: 'event-2' })

    const secondClearPassphrase = result.current.clearPassphrase

    // useCallback with [eventId] dependency means the reference should change
    expect(firstClearPassphrase).not.toBe(secondClearPassphrase)

    // Verify the new callback clears the new eventId's key
    act(() => {
      result.current.clearPassphrase()
    })

    expect(sessionStorage.getItem('podforge_admin_event-2')).toBeNull()
    // Should NOT have cleared the old key
    expect(sessionStorage.getItem('podforge_admin_event-1')).toBe('pass1')
  })

  it('setPassphrase callback remains stable when eventId does not change', () => {
    const { result, rerender } = renderHook(
      ({ eventId }) => useAdminAuth(eventId),
      { initialProps: { eventId: 'same-event' } },
    )

    const firstSetPassphrase = result.current.setPassphrase
    const firstClearPassphrase = result.current.clearPassphrase

    rerender({ eventId: 'same-event' })

    // Same eventId means useCallback should return the same reference
    expect(result.current.setPassphrase).toBe(firstSetPassphrase)
    expect(result.current.clearPassphrase).toBe(firstClearPassphrase)
  })

  it('reads initial passphrase from sessionStorage on mount', () => {
    sessionStorage.setItem('podforge_admin_pre-loaded', 'existing-pass')

    const { result } = renderHook(() => useAdminAuth('pre-loaded'))

    // Should read the value on initial render, not require setPassphrase
    expect(result.current.passphrase).toBe('existing-pass')
    expect(result.current.isAdmin).toBe(true)
  })

  it('isAdmin is derived from passphrase being non-null', () => {
    const { result } = renderHook(() => useAdminAuth('evt-derive'))

    // null passphrase -> not admin
    expect(result.current.passphrase).toBeNull()
    expect(result.current.isAdmin).toBe(false)

    act(() => {
      result.current.setPassphrase('any-value')
    })

    // non-null passphrase -> admin
    expect(result.current.passphrase).not.toBeNull()
    expect(result.current.isAdmin).toBe(true)

    act(() => {
      result.current.clearPassphrase()
    })

    // back to null -> not admin
    expect(result.current.passphrase).toBeNull()
    expect(result.current.isAdmin).toBe(false)
  })
})
