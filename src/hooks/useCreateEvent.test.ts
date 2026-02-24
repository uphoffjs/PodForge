import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCreateEvent } from './useCreateEvent'

const { mockRpc, mockToastError } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCreateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc with correct params (p_name, p_passphrase)', async () => {
    mockRpc.mockResolvedValue({ data: 'new-event-uuid', error: null })

    const { result } = renderHook(() => useCreateEvent(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: 'My Event', passphrase: 'secret' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('create_event', {
      p_name: 'My Event',
      p_passphrase: 'secret',
    })
  })

  it('returns event ID on success', async () => {
    mockRpc.mockResolvedValue({ data: 'returned-uuid-123', error: null })

    const { result } = renderHook(() => useCreateEvent(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: 'Test', passphrase: 'pass' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe('returned-uuid-123')
  })

  it('shows error toast on failure', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Something went wrong' },
    })

    const { result } = renderHook(() => useCreateEvent(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: 'Fail', passphrase: 'pass' })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to create event. Please try again.'
    )
  })
})
