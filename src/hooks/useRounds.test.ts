import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useRounds } from './useRounds'

const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockEq = vi.fn(() => ({ order: mockOrder }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
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

describe('useRounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns rounds data on success', async () => {
    const rounds = [
      { id: 'r2', event_id: 'evt1', round_number: 2, created_at: '2026-01-01T01:00:00Z' },
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]
    mockOrder.mockResolvedValue({ data: rounds, error: null })

    const { result } = renderHook(() => useRounds('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rounds)
  })

  it('throws error when Supabase returns error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'Query failed' } })

    const { result } = renderHook(() => useRounds('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'Query failed' })
  })

  it('query is disabled when eventId is empty string', () => {
    const { result } = renderHook(() => useRounds(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls supabase with correct table and chain methods', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useRounds('evt-abc'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('rounds')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('event_id', 'evt-abc')
    expect(mockOrder).toHaveBeenCalledWith('round_number', { ascending: false })
  })

  it('uses queryKey containing rounds and eventId', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useRounds('evt-xyz'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queries = queryClient.getQueryCache().getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['rounds', 'evt-xyz'])
  })
})
