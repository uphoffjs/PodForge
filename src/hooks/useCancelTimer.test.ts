import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCancelTimer } from './useCancelTimer'

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

describe('useCancelTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc("cancel_timer") with correct args', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useCancelTimer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('cancel_timer', {
      p_event_id: 'evt1',
      p_passphrase: 'secret',
    })
  })

  it('invalidates timer query on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useCancelTimer('evt1'), { wrapper })

    result.current.mutate({ passphrase: 'secret' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['timer', 'evt1'],
    })
  })

  it('shows success toast on success', async () => {
    mockRpc.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useCancelTimer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Timer cancelled')
  })

  it('shows passphrase error toast when passphrase is invalid', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'invalid passphrase provided' },
    })

    const { result } = renderHook(() => useCancelTimer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'wrong' })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Invalid passphrase')
  })

  it('shows generic error toast on other failures', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'something went wrong' },
    })

    const { result } = renderHook(() => useCancelTimer('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ passphrase: 'secret' })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Failed to cancel timer')
  })
})
