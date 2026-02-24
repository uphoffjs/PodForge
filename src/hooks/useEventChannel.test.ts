import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useEventChannel } from './useEventChannel'

const { mockSubscribe, mockRemoveChannel, mockOn, mockChannel, capturedCallbacks } = vi.hoisted(
  () => {
    const capturedCallbacks: Array<{ event: string; config: unknown; callback: () => void }> = []
    const mockSubscribe = vi.fn()
    const mockOn = vi.fn()
    const channelObj = { on: mockOn, subscribe: mockSubscribe }
    mockOn.mockImplementation((event: string, config: unknown, callback: () => void) => {
      capturedCallbacks.push({ event, config, callback })
      return channelObj
    })
    mockSubscribe.mockReturnValue(channelObj)
    const mockChannel = vi.fn((_name: string) => channelObj)
    return {
      mockSubscribe,
      mockRemoveChannel: vi.fn(),
      mockOn,
      mockChannel,
      capturedCallbacks,
    }
  }
)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useEventChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks.length = 0
  })

  it('creates channel with correct name event:{eventId}', () => {
    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(),
    })

    expect(mockChannel).toHaveBeenCalledWith('event:evt1')
  })

  it('subscribes to players and events tables', () => {
    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(),
    })

    expect(mockOn).toHaveBeenCalledTimes(5)

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: 'event_id=eq.evt1',
      },
      expect.any(Function)
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: 'id=eq.evt1',
      },
      expect.any(Function)
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: 'event_id=eq.evt1',
      },
      expect.any(Function)
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pods',
      },
      expect.any(Function)
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pod_players',
      },
      expect.any(Function)
    )

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })

  it('calls removeChannel on unmount', () => {
    const { unmount } = renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(),
    })

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  })

  it('does not create channel when eventId is empty', () => {
    renderHook(() => useEventChannel(''), {
      wrapper: createWrapper(),
    })

    expect(mockChannel).not.toHaveBeenCalled()
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('players callback invalidates players query with correct key', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    // Find the players callback (table: 'players')
    const playersCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'players'
    )
    expect(playersCall).toBeDefined()

    playersCall!.callback()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
  })

  it('events callback invalidates event query with correct key', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    // Find the events callback (table: 'events')
    const eventsCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'events'
    )
    expect(eventsCall).toBeDefined()

    eventsCall!.callback()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['event', 'evt1'],
    })
  })

  it('players callback uses correct filter with eventId', () => {
    renderHook(() => useEventChannel('abc-123'), {
      wrapper: createWrapper(),
    })

    const playersCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'players'
    )
    expect(playersCall).toBeDefined()
    expect((playersCall!.config as { filter: string }).filter).toBe('event_id=eq.abc-123')
  })

  it('events callback uses correct filter with eventId', () => {
    renderHook(() => useEventChannel('abc-123'), {
      wrapper: createWrapper(),
    })

    const eventsCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'events'
    )
    expect(eventsCall).toBeDefined()
    expect((eventsCall!.config as { filter: string }).filter).toBe('id=eq.abc-123')
  })

  it('recreates channel when eventId changes', () => {
    const { rerender } = renderHook(
      ({ eventId }: { eventId: string }) => useEventChannel(eventId),
      { wrapper: createWrapper(), initialProps: { eventId: 'evt1' } }
    )

    expect(mockChannel).toHaveBeenCalledWith('event:evt1')
    expect(mockRemoveChannel).not.toHaveBeenCalled()

    rerender({ eventId: 'evt2' })

    // Old channel should be removed, new channel created
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockChannel).toHaveBeenCalledWith('event:evt2')
  })

  it('rounds callback invalidates rounds and currentRound queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    const roundsCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'rounds'
    )
    expect(roundsCall).toBeDefined()

    roundsCall!.callback()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rounds', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['currentRound', 'evt1'],
    })
  })

  it('pods callback invalidates pods queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    const podsCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'pods'
    )
    expect(podsCall).toBeDefined()

    podsCall!.callback()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pods'],
    })
  })

  it('pod_players callback invalidates pods queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    const podPlayersCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'pod_players'
    )
    expect(podPlayersCall).toBeDefined()

    podPlayersCall!.callback()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pods'],
    })
  })

  it('rounds callback uses correct filter with eventId', () => {
    renderHook(() => useEventChannel('abc-123'), {
      wrapper: createWrapper(),
    })

    const roundsCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'rounds'
    )
    expect(roundsCall).toBeDefined()
    expect((roundsCall!.config as { filter: string }).filter).toBe('event_id=eq.abc-123')
  })

  it('each callback only invalidates its own query key, not both', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useEventChannel('evt1'), {
      wrapper: createWrapper(queryClient),
    })

    const playersCall = capturedCallbacks.find(
      (c) => (c.config as { table: string }).table === 'players'
    )

    playersCall!.callback()

    // Only the players query should be invalidated, not event
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['event', 'evt1'],
    })
  })
})
