import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useEventPlayers } from './useEventPlayers'

const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockEq = vi.fn((_col: string, _val: string) => ({ order: mockOrder }))
  const mockSelect = vi.fn((_sel: string) => ({ eq: mockEq }))
  const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockEq, mockOrder }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useEventPlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns player list on success', async () => {
    const players = [
      {
        id: 'p1',
        event_id: 'evt1',
        name: 'Alice',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'p2',
        event_id: 'evt1',
        name: 'Bob',
        status: 'active',
        created_at: '2026-01-01T00:01:00Z',
      },
    ]
    mockOrder.mockResolvedValue({ data: players, error: null })

    const { result } = renderHook(() => useEventPlayers('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(players)
  })

  it('throws error when Supabase returns error', async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    })

    const { result } = renderHook(() => useEventPlayers('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual({ message: 'Query failed' })
  })

  it('query is disabled when eventId is empty string', () => {
    const { result } = renderHook(() => useEventPlayers(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('calls supabase.from with "players" table name', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useEventPlayers('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('players')
  })

  it('calls select with "*"', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useEventPlayers('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockSelect).toHaveBeenCalledWith('*')
  })

  it('calls eq with "event_id" column and the provided eventId', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useEventPlayers('my-event-123'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockEq).toHaveBeenCalledWith('event_id', 'my-event-123')
  })

  it('calls order with "created_at" and ascending: true', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useEventPlayers('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('uses queryKey containing "players" and the eventId', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useEventPlayers('evt-abc'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['players', 'evt-abc'])
  })

  it('sets staleTime to 30000', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useEventPlayers('evt-stale'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.getAll()
    const query = queries.find(
      (q) => JSON.stringify(q.queryKey) === JSON.stringify(['players', 'evt-stale']),
    )
    expect(query).toBeDefined()
    // The query's observer options should reflect the staleTime from the hook
    // We verify this by checking the data is not immediately stale
    expect(query!.isStale()).toBe(false)

    // If staleTime were mutated to 0, data would be immediately stale
    // We confirm it is not stale right after fetching
    expect(result.current.isStale).toBe(false)
  })

  it('does not call supabase when eventId is empty', () => {
    renderHook(() => useEventPlayers(''), {
      wrapper: createWrapper(),
    })

    expect(mockFrom).not.toHaveBeenCalled()
  })
})
