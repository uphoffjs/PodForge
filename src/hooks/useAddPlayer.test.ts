import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAddPlayer } from './useAddPlayer'

// Hoist mock fns so vi.mock factories can reference them
const {
  mockFrom, mockInsert, mockSelect, mockSingle,
  mockToastSuccess, mockToastError,
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
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAddPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a player into the players table with correct event_id', async () => {
    const playerData = { id: 'p1', name: 'Alice', event_id: 'evt1' }
    mockSingle.mockResolvedValue({ data: playerData, error: null })

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Alice')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('players')
    expect(mockInsert).toHaveBeenCalledWith({ event_id: 'evt1', name: 'Alice' })
  })

  it('shows success toast on successful add', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Bob', event_id: 'evt1' },
      error: null,
    })

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Bob')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockToastSuccess).toHaveBeenCalledWith('Player added!')
  })

  it('does NOT call storePlayerId on success', async () => {
    // This is the critical difference from useJoinEvent
    const storePlayerIdMock = vi.fn()
    vi.doMock('@/lib/player-identity', () => ({
      storePlayerId: storePlayerIdMock,
    }))

    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Carol', event_id: 'evt1' },
      error: null,
    })

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Carol')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(storePlayerIdMock).not.toHaveBeenCalled()
  })

  it('invalidates the players query cache on success', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Dave', event_id: 'evt1' },
      error: null,
    })

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useAddPlayer('evt1'), { wrapper })

    result.current.mutate('Dave')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['players', 'evt1'] })
  })

  it('shows duplicate name error toast for code 23505', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Existing')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockToastError).toHaveBeenCalledWith('That name is already taken. Try another!')
  })

  it('shows generic error toast when error is null (optional chaining safety)', async () => {
    mockSingle.mockRejectedValue(null)

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Someone')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockToastError).toHaveBeenCalledWith('Failed to add player. Please try again.')
  })

  it('shows generic error toast for non-duplicate errors', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '500', message: 'server error' },
    })

    const { result } = renderHook(() => useAddPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('Whoever')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockToastError).toHaveBeenCalledWith('Failed to add player. Please try again.')
  })
})
