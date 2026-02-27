import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCurrentRound } from './useCurrentRound'

const { mockFrom, mockSelect, mockEq, mockOrder, mockLimit, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockOrder = vi.fn(() => ({ limit: mockLimit }))
  const mockEq = vi.fn(() => ({ order: mockOrder }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockEq, mockOrder, mockLimit, mockMaybeSingle }
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

describe('useCurrentRound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns round data on success', async () => {
    const roundData = { id: 'r1', event_id: 'evt1', round_number: 3, created_at: '2026-01-01T00:00:00Z' }
    mockMaybeSingle.mockResolvedValue({ data: roundData, error: null })

    const { result } = renderHook(() => useCurrentRound('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(roundData)
  })

  it('returns null when no round exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useCurrentRound('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('throws error when Supabase returns error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const { result } = renderHook(() => useCurrentRound('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'DB error' })
  })

  it('query is disabled when eventId is empty string', () => {
    const { result } = renderHook(() => useCurrentRound(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls supabase with correct table and chain methods', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'r1' }, error: null })

    const { result } = renderHook(() => useCurrentRound('evt-abc'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('rounds')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('event_id', 'evt-abc')
    expect(mockOrder).toHaveBeenCalledWith('round_number', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(1)
  })

  it('uses queryKey containing currentRound and eventId', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'r1' }, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useCurrentRound('evt-xyz'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queries = queryClient.getQueryCache().getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['currentRound', 'evt-xyz'])
  })
})
