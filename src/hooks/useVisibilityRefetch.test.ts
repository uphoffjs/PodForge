import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useVisibilityRefetch } from './useVisibilityRefetch'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient()
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useVisibilityRefetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('invalidates both players and event queries when tab becomes visible', () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['event', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
  })

  it('does NOT invalidate when tab becomes hidden', () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('does not add listener when eventId is empty', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    renderHook(() => useVisibilityRefetch(''), {
      wrapper: createWrapper(),
    })

    const visibilityChangeCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange'
    )
    expect(visibilityChangeCalls).toHaveLength(0)
  })

  it('cleans up listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(),
    })

    unmount()

    const visibilityChangeCalls = removeEventListenerSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange'
    )
    expect(visibilityChangeCalls).toHaveLength(1)
  })

  it('listens specifically to the "visibilitychange" event', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(),
    })

    const visibilityChangeCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange'
    )
    expect(visibilityChangeCalls).toHaveLength(1)
    expect(visibilityChangeCalls[0][0]).toBe('visibilitychange')
  })

  it('checks specifically for "visible" state, not just any truthy value', () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    // Set to a non-standard string value -- should not trigger invalidation
    Object.defineProperty(document, 'visibilityState', {
      value: 'prerender',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('uses updated eventId after rerender', () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { rerender } = renderHook(
      ({ eventId }: { eventId: string }) => useVisibilityRefetch(eventId),
      { wrapper: createWrapper(queryClient), initialProps: { eventId: 'evt1' } }
    )

    rerender({ eventId: 'evt2' })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt2'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['event', 'evt2'],
    })
  })

  it('removes the exact same listener function on cleanup', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useVisibilityRefetch('evt1'), {
      wrapper: createWrapper(),
    })

    const addedHandler = addSpy.mock.calls.find(
      (call) => call[0] === 'visibilitychange'
    )?.[1]

    unmount()

    const removedHandler = removeSpy.mock.calls.find(
      (call) => call[0] === 'visibilitychange'
    )?.[1]

    expect(addedHandler).toBe(removedHandler)
  })
})
