import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useTimer } from './useTimer'

const { mockFrom, mockSelect, mockEq, mockIn, mockOrder, mockLimit, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockLimit = vi.fn((_n: number) => ({ maybeSingle: mockMaybeSingle }))
  const mockOrder = vi.fn((_col: string, _opts: object) => ({ limit: mockLimit }))
  const mockIn = vi.fn((_col: string, _vals: string[]) => ({ order: mockOrder }))
  const mockEq = vi.fn((_col: string, _val: string) => ({ in: mockIn }))
  const mockSelect = vi.fn((_sel: string) => ({ eq: mockEq }))
  const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockEq, mockIn, mockOrder, mockLimit, mockMaybeSingle }
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

describe('useTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns timer data on success', async () => {
    const timerData = {
      id: 't1',
      round_id: 'r1',
      event_id: 'evt1',
      duration_minutes: 50,
      status: 'running',
      started_at: '2026-01-01T00:00:00Z',
      remaining_seconds: null,
      paused_at: null,
      expires_at: '2026-01-01T00:50:00Z',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockMaybeSingle.mockResolvedValue({ data: timerData, error: null })

    const { result } = renderHook(() => useTimer('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(timerData)
  })

  it('returns null when no active timer exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useTimer('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('throws error when Supabase returns error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const { result } = renderHook(() => useTimer('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'DB error' })
  })

  it('query is disabled when eventId is empty string', () => {
    const { result } = renderHook(() => useTimer(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls supabase with correct table and chain methods', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null })

    const { result } = renderHook(() => useTimer('evt-abc'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('round_timers')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('event_id', 'evt-abc')
    expect(mockIn).toHaveBeenCalledWith('status', ['running', 'paused'])
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(1)
  })

  it('uses queryKey containing timer and eventId', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 't1' }, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useTimer('evt-xyz'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queries = queryClient.getQueryCache().getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['timer', 'evt-xyz'])
  })
})
