import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useDropPlayer } from './useDropPlayer'

const { mockRpc, mockClearPlayerId, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockRpc: vi.fn(),
    mockClearPlayerId: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('@/lib/player-identity', () => ({
  clearPlayerId: mockClearPlayerId,
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

describe('useDropPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc("drop_player") with correct player ID', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useDropPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('player-abc')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('drop_player', {
      p_player_id: 'player-abc',
    })
  })

  it('calls clearPlayerId with eventId on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useDropPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('player-abc')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockClearPlayerId).toHaveBeenCalledWith('evt1')
  })

  it('invalidates players query on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useDropPlayer('evt1'), { wrapper })

    result.current.mutate('player-abc')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
  })

  it('shows success toast on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useDropPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('player-abc')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith("You've left the event")
  })

  it('shows error toast on failure', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'drop failed' },
    })

    const { result } = renderHook(() => useDropPlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('player-abc')

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to leave event. Please try again.'
    )
  })
})
