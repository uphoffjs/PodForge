import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { usePods } from './usePods'

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

describe('usePods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pods data on success', async () => {
    const pods = [
      { id: 'pod1', round_id: 'r1', pod_number: 1, is_bye: false, pod_players: [] },
      { id: 'pod2', round_id: 'r1', pod_number: 2, is_bye: false, pod_players: [] },
    ]
    mockOrder.mockResolvedValue({ data: pods, error: null })

    const { result } = renderHook(() => usePods('r1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(pods)
  })

  it('throws error when Supabase returns error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'Query failed' } })

    const { result } = renderHook(() => usePods('r1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'Query failed' })
  })

  it('query is disabled when roundId is undefined', () => {
    const { result } = renderHook(() => usePods(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('query is disabled when roundId is empty string', () => {
    const { result } = renderHook(() => usePods(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls supabase with correct table and chain methods', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => usePods('round-abc'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('pods')
    expect(mockSelect).toHaveBeenCalledWith('*, pod_players(*, players(*))')
    expect(mockEq).toHaveBeenCalledWith('round_id', 'round-abc')
    expect(mockOrder).toHaveBeenCalledWith('pod_number')
  })

  it('uses queryKey containing pods and roundId', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => usePods('r-xyz'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queries = queryClient.getQueryCache().getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['pods', 'r-xyz'])
  })
})
