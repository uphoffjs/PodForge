import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useJoinEvent } from './useJoinEvent'

const {
  mockFrom,
  mockInsert,
  mockSelect,
  mockSingle,
  mockStorePlayerId,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockFrom = vi.fn((_table: string) => ({
    insert: mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle,
      }),
    }),
  }))
  return {
    mockFrom,
    mockInsert,
    mockSelect,
    mockSingle,
    mockStorePlayerId: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/lib/player-identity', () => ({
  storePlayerId: mockStorePlayerId,
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useJoinEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts player with correct event_id and name', async () => {
    const playerData = { id: 'p1', name: 'Alice', event_id: 'evt1' }
    mockSingle.mockResolvedValue({ data: playerData, error: null })

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Alice')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('players')
    expect(mockInsert).toHaveBeenCalledWith({ event_id: 'evt1', name: 'Alice' })
  })

  it('does not call storePlayerId (caller responsibility)', async () => {
    const playerData = { id: 'player-uuid-123', name: 'Bob', event_id: 'evt1' }
    mockSingle.mockResolvedValue({ data: playerData, error: null })

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Bob')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockStorePlayerId).not.toHaveBeenCalled()
  })

  it('invalidates players query on success', async () => {
    const playerData = { id: 'p1', name: 'Carol', event_id: 'evt1' }
    mockSingle.mockResolvedValue({ data: playerData, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useJoinEvent('evt1'), { wrapper })

    result.current.mutate('Carol')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
  })

  it('shows success toast on success', async () => {
    const playerData = { id: 'p1', name: 'Dave', event_id: 'evt1' }
    mockSingle.mockResolvedValue({ data: playerData, error: null })

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Dave')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Joined the event!')
  })

  it('shows duplicate name error for code 23505', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Existing')

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'That name is already taken. Try another!'
    )
  })

  it('shows generic error when error has no code property (null error)', async () => {
    // Rejecting with null bypasses the mutationFn destructuring and throws null
    // directly. onError receives null. With ?. this safely returns undefined;
    // without ?. it would crash.
    mockSingle.mockRejectedValue(null)

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Someone')

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to join. Please try again.'
    )
  })

  it('shows generic error for other errors', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '500', message: 'server error' },
    })

    const { result } = renderHook(() => useJoinEvent('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Someone')

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to join. Please try again.'
    )
  })
})
