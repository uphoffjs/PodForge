import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useGenerateRound } from './useGenerateRound'
import type { PodAssignment } from './useGenerateRound'

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

const samplePodAssignments: PodAssignment[] = [
  {
    pod_number: 1,
    is_bye: false,
    players: [
      { player_id: 'p1', seat_number: 1 },
      { player_id: 'p2', seat_number: 2 },
      { player_id: 'p3', seat_number: 3 },
      { player_id: 'p4', seat_number: 4 },
    ],
  },
]

describe('useGenerateRound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc("generate_round") with correct args', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('generate_round', {
      p_event_id: 'evt1',
      p_passphrase: 'secret',
      p_pod_assignments: samplePodAssignments,
      p_timer_duration_minutes: 50,
    })
  })

  it('passes null for p_timer_duration_minutes when not provided', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('generate_round', {
      p_event_id: 'evt1',
      p_passphrase: 'secret',
      p_pod_assignments: samplePodAssignments,
      p_timer_duration_minutes: null,
    })
  })

  it('invalidates all 5 query keys on success', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useGenerateRound('evt1'), { wrapper })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rounds', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['currentRound', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pods'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['allRoundsPods', 'evt1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['timer', 'evt1'],
    })
  })

  it('returns data from RPC on success', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(3)
  })

  it('shows passphrase error toast when passphrase is invalid', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'invalid passphrase provided' },
    })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'wrong',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Invalid passphrase')
  })

  it('shows raw error message when fewer than 4 players', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'Pod has fewer than 4 players' },
    })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Pod has fewer than 4 players')
  })

  it('shows event not found error toast', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'event not found' },
    })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Event not found')
  })

  it('shows event has ended error toast', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'event has ended' },
    })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Event has ended')
  })

  it('shows generic error toast on other failures', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'something unexpected' },
    })

    const { result } = renderHook(() => useGenerateRound('evt1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      passphrase: 'secret',
      podAssignments: samplePodAssignments,
      timerDurationMinutes: 50,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to generate round. Please try again.'
    )
  })
})
