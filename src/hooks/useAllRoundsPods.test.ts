import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAllRoundsPods } from './useAllRoundsPods'

const { mockFrom, mockSelect, mockIn, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockIn = vi.fn((_col: string, _vals: string[]) => ({ order: mockOrder }))
  const mockSelect = vi.fn((_sel: string) => ({ in: mockIn }))
  const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockIn, mockOrder }
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

describe('useAllRoundsPods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches pods for multiple round IDs', async () => {
    const pods = [
      { id: 'pod1', round_id: 'r1', pod_number: 1, is_bye: false, pod_players: [] },
      { id: 'pod2', round_id: 'r2', pod_number: 1, is_bye: false, pod_players: [] },
    ]
    mockOrder.mockResolvedValue({ data: pods, error: null })

    const { result } = renderHook(
      () => useAllRoundsPods('evt1', ['r1', 'r2']),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(pods)
    expect(mockFrom).toHaveBeenCalledWith('pods')
    expect(mockSelect).toHaveBeenCalledWith('*, pod_players(*, players(*))')
    expect(mockIn).toHaveBeenCalledWith('round_id', ['r1', 'r2'])
    expect(mockOrder).toHaveBeenCalledWith('pod_number')
  })

  it('returns empty when roundIds is empty (query disabled)', () => {
    const { result } = renderHook(
      () => useAllRoundsPods('evt1', []),
      { wrapper: createWrapper() }
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('does not fire query when no round IDs provided', () => {
    renderHook(
      () => useAllRoundsPods('evt1', []),
      { wrapper: createWrapper() }
    )

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws error when Supabase returns error', async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    })

    const { result } = renderHook(
      () => useAllRoundsPods('evt1', ['r1']),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual({ message: 'Query failed' })
  })

  it('uses queryKey containing allRoundsPods, eventId, and roundIds', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(
      () => useAllRoundsPods('evt-abc', ['r1']),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['allRoundsPods', 'evt-abc', ['r1']])
  })
})
