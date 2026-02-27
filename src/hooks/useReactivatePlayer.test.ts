import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useReactivatePlayer } from './useReactivatePlayer'

const { mockRpc, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
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

describe('useReactivatePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc("reactivate_player") with correct args', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useReactivatePlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret', playerId: 'p1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('reactivate_player', {
      p_event_id: 'evt1',
      p_passphrase: 'secret',
      p_player_id: 'p1',
    })
  })

  it('invalidates players query on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useReactivatePlayer('evt1'), { wrapper })

    result.current.mutate({ passphrase: 'secret', playerId: 'p1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['players', 'evt1'],
    })
  })

  it('does not show success toast on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useReactivatePlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret', playerId: 'p1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('shows passphrase error toast when passphrase is invalid', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'invalid passphrase provided' },
    })

    const { result } = renderHook(() => useReactivatePlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'wrong', playerId: 'p1' })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Invalid passphrase')
  })

  it('shows generic error toast on other failures', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'something went wrong' },
    })

    const { result } = renderHook(() => useReactivatePlayer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret', playerId: 'p1' })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to reactivate player. Please try again.'
    )
  })
})
