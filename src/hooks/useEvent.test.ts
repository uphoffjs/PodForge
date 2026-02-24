import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useEvent } from './useEvent'

const { mockFrom, mockSelect, mockEq, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn((_col: string, _val: string) => ({ single: mockSingle }))
  const mockSelect = vi.fn((_sel: string) => ({ eq: mockEq }))
  const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockEq, mockSingle }
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

describe('useEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns event data on success', async () => {
    const eventData = {
      id: 'evt1',
      name: 'Test Event',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockSingle.mockResolvedValue({ data: eventData, error: null })

    const { result } = renderHook(() => useEvent('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(eventData)
  })

  it('throws error when Supabase returns error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { result } = renderHook(() => useEvent('evt1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual({ message: 'Not found' })
  })

  it('query is disabled when eventId is empty string', () => {
    const { result } = renderHook(() => useEvent(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('calls supabase.from with "events" table name', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'e1' }, error: null })

    const { result } = renderHook(() => useEvent('e1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('events')
  })

  it('calls select with "id, name, status, created_at"', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'e1' }, error: null })

    const { result } = renderHook(() => useEvent('e1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockSelect).toHaveBeenCalledWith('id, name, status, created_at')
  })

  it('calls eq with "id" column and the provided eventId', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'my-event-456' }, error: null })

    const { result } = renderHook(() => useEvent('my-event-456'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockEq).toHaveBeenCalledWith('id', 'my-event-456')
  })

  it('uses queryKey containing "event" and the eventId', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'evt-xyz' }, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useEvent('evt-xyz'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.getAll()
    expect(queries).toHaveLength(1)
    expect(queries[0].queryKey).toEqual(['event', 'evt-xyz'])
  })

  it('does not call supabase when eventId is empty', () => {
    renderHook(() => useEvent(''), {
      wrapper: createWrapper(),
    })

    expect(mockFrom).not.toHaveBeenCalled()
  })
})
