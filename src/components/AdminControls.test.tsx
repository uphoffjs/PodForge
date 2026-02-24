import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { AdminControls } from './AdminControls'
import type { Player } from '@/types/database'

// Mock generatePods to capture its input
const mockGeneratePods = vi.fn()

vi.mock('@/lib/pod-algorithm', () => ({
  generatePods: (...args: unknown[]) => mockGeneratePods(...args),
}))

// Mock hooks
const mockMutate = vi.fn()
const mockEndMutate = vi.fn()

vi.mock('@/hooks/useGenerateRound', () => ({
  useGenerateRound: () => ({ mutate: mockMutate, isPending: false }),
}))

vi.mock('@/hooks/useEndEvent', () => ({
  useEndEvent: () => ({ mutate: mockEndMutate, isPending: false }),
}))

// Configurable mock data for useRounds
let mockRoundsData: { id: string; event_id: string; round_number: number; created_at: string }[] | undefined

vi.mock('@/hooks/useRounds', () => ({
  useRounds: () => ({ data: mockRoundsData }),
}))

// Configurable mock data for useAllRoundsPods
let mockAllPodsData: {
  id: string
  round_id: string
  pod_number: number
  is_bye: boolean
  pod_players: { id: string; pod_id: string; player_id: string; seat_number: number | null; players: { id: string; event_id: string; name: string; status: string; created_at: string } }[]
}[] | undefined

vi.mock('@/hooks/useAllRoundsPods', () => ({
  useAllRoundsPods: () => ({ data: mockAllPodsData }),
}))

// Mock usePods for the PodWithPlayers type import (not called as hook)
vi.mock('@/hooks/usePods', () => ({
  usePods: () => ({ data: undefined }),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const mockPlayers: Player[] = [
  { id: 'p1', event_id: 'evt1', name: 'Alice', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p2', event_id: 'evt1', name: 'Bob', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p3', event_id: 'evt1', name: 'Charlie', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p4', event_id: 'evt1', name: 'Diana', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p5', event_id: 'evt1', name: 'Eve', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p6', event_id: 'evt1', name: 'Frank', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p7', event_id: 'evt1', name: 'Grace', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p8', event_id: 'evt1', name: 'Hank', status: 'active', created_at: '2026-01-01T00:00:00Z' },
]

const defaultProps = {
  eventId: 'evt1',
  isAdmin: true,
  passphrase: 'secret123',
  onPassphraseNeeded: vi.fn(),
  players: mockPlayers,
  isEventEnded: false,
}

describe('AdminControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoundsData = undefined
    mockAllPodsData = undefined
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })
  })

  it('renders Generate Next Round button', () => {
    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    const btn = screen.getByTestId('generate-round-btn')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Generate Next Round')
  })

  it('returns null when not admin', () => {
    const { container } = render(
      <AdminControls {...defaultProps} isAdmin={false} />,
      { wrapper: createWrapper() }
    )

    expect(container.innerHTML).toBe('')
  })

  it('passes multi-round history to generatePods (PODG-02 gap closure)', async () => {
    const user = userEvent.setup()

    // Set up 3 rounds
    mockRoundsData = [
      { id: 'r3', event_id: 'evt1', round_number: 3, created_at: '2026-01-03T00:00:00Z' },
      { id: 'r2', event_id: 'evt1', round_number: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]

    // Set up pods for all 3 rounds
    mockAllPodsData = [
      {
        id: 'pod-r1-1', round_id: 'r1', pod_number: 1, is_bye: false,
        pod_players: [
          { id: 'pp1', pod_id: 'pod-r1-1', player_id: 'p1', seat_number: 1, players: { id: 'p1', event_id: 'evt1', name: 'Alice', status: 'active', created_at: '' } },
          { id: 'pp2', pod_id: 'pod-r1-1', player_id: 'p2', seat_number: 2, players: { id: 'p2', event_id: 'evt1', name: 'Bob', status: 'active', created_at: '' } },
          { id: 'pp3', pod_id: 'pod-r1-1', player_id: 'p3', seat_number: 3, players: { id: 'p3', event_id: 'evt1', name: 'Charlie', status: 'active', created_at: '' } },
          { id: 'pp4', pod_id: 'pod-r1-1', player_id: 'p4', seat_number: 4, players: { id: 'p4', event_id: 'evt1', name: 'Diana', status: 'active', created_at: '' } },
        ],
      },
      {
        id: 'pod-r1-2', round_id: 'r1', pod_number: 2, is_bye: false,
        pod_players: [
          { id: 'pp5', pod_id: 'pod-r1-2', player_id: 'p5', seat_number: 1, players: { id: 'p5', event_id: 'evt1', name: 'Eve', status: 'active', created_at: '' } },
          { id: 'pp6', pod_id: 'pod-r1-2', player_id: 'p6', seat_number: 2, players: { id: 'p6', event_id: 'evt1', name: 'Frank', status: 'active', created_at: '' } },
          { id: 'pp7', pod_id: 'pod-r1-2', player_id: 'p7', seat_number: 3, players: { id: 'p7', event_id: 'evt1', name: 'Grace', status: 'active', created_at: '' } },
          { id: 'pp8', pod_id: 'pod-r1-2', player_id: 'p8', seat_number: 4, players: { id: 'p8', event_id: 'evt1', name: 'Hank', status: 'active', created_at: '' } },
        ],
      },
      {
        id: 'pod-r2-1', round_id: 'r2', pod_number: 1, is_bye: false,
        pod_players: [
          { id: 'pp9', pod_id: 'pod-r2-1', player_id: 'p1', seat_number: 1, players: { id: 'p1', event_id: 'evt1', name: 'Alice', status: 'active', created_at: '' } },
          { id: 'pp10', pod_id: 'pod-r2-1', player_id: 'p5', seat_number: 2, players: { id: 'p5', event_id: 'evt1', name: 'Eve', status: 'active', created_at: '' } },
          { id: 'pp11', pod_id: 'pod-r2-1', player_id: 'p3', seat_number: 3, players: { id: 'p3', event_id: 'evt1', name: 'Charlie', status: 'active', created_at: '' } },
          { id: 'pp12', pod_id: 'pod-r2-1', player_id: 'p7', seat_number: 4, players: { id: 'p7', event_id: 'evt1', name: 'Grace', status: 'active', created_at: '' } },
        ],
      },
      {
        id: 'pod-r2-2', round_id: 'r2', pod_number: 2, is_bye: false,
        pod_players: [
          { id: 'pp13', pod_id: 'pod-r2-2', player_id: 'p2', seat_number: 1, players: { id: 'p2', event_id: 'evt1', name: 'Bob', status: 'active', created_at: '' } },
          { id: 'pp14', pod_id: 'pod-r2-2', player_id: 'p6', seat_number: 2, players: { id: 'p6', event_id: 'evt1', name: 'Frank', status: 'active', created_at: '' } },
          { id: 'pp15', pod_id: 'pod-r2-2', player_id: 'p4', seat_number: 3, players: { id: 'p4', event_id: 'evt1', name: 'Diana', status: 'active', created_at: '' } },
          { id: 'pp16', pod_id: 'pod-r2-2', player_id: 'p8', seat_number: 4, players: { id: 'p8', event_id: 'evt1', name: 'Hank', status: 'active', created_at: '' } },
        ],
      },
      {
        id: 'pod-r3-1', round_id: 'r3', pod_number: 1, is_bye: false,
        pod_players: [
          { id: 'pp17', pod_id: 'pod-r3-1', player_id: 'p1', seat_number: 1, players: { id: 'p1', event_id: 'evt1', name: 'Alice', status: 'active', created_at: '' } },
          { id: 'pp18', pod_id: 'pod-r3-1', player_id: 'p6', seat_number: 2, players: { id: 'p6', event_id: 'evt1', name: 'Frank', status: 'active', created_at: '' } },
          { id: 'pp19', pod_id: 'pod-r3-1', player_id: 'p4', seat_number: 3, players: { id: 'p4', event_id: 'evt1', name: 'Diana', status: 'active', created_at: '' } },
          { id: 'pp20', pod_id: 'pod-r3-1', player_id: 'p7', seat_number: 4, players: { id: 'p7', event_id: 'evt1', name: 'Grace', status: 'active', created_at: '' } },
        ],
      },
      {
        id: 'pod-r3-2', round_id: 'r3', pod_number: 2, is_bye: false,
        pod_players: [
          { id: 'pp21', pod_id: 'pod-r3-2', player_id: 'p2', seat_number: 1, players: { id: 'p2', event_id: 'evt1', name: 'Bob', status: 'active', created_at: '' } },
          { id: 'pp22', pod_id: 'pod-r3-2', player_id: 'p5', seat_number: 2, players: { id: 'p5', event_id: 'evt1', name: 'Eve', status: 'active', created_at: '' } },
          { id: 'pp23', pod_id: 'pod-r3-2', player_id: 'p3', seat_number: 3, players: { id: 'p3', event_id: 'evt1', name: 'Charlie', status: 'active', created_at: '' } },
          { id: 'pp24', pod_id: 'pod-r3-2', player_id: 'p8', seat_number: 4, players: { id: 'p8', event_id: 'evt1', name: 'Hank', status: 'active', created_at: '' } },
        ],
      },
    ]

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    // The critical assertion: generatePods receives history from ALL 3 rounds
    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [activePlayers, previousRounds] = mockGeneratePods.mock.calls[0]

    expect(activePlayers).toHaveLength(8)
    expect(previousRounds).toHaveLength(3)

    // Verify each round has the correct number of pods
    expect(previousRounds[0].pods).toHaveLength(2) // r3: 2 pods
    expect(previousRounds[1].pods).toHaveLength(2) // r2: 2 pods
    expect(previousRounds[2].pods).toHaveLength(2) // r1: 2 pods

    // Verify player IDs are correctly extracted from pod_players
    expect(previousRounds[2].pods[0].playerIds).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(previousRounds[2].pods[1].playerIds).toEqual(['p5', 'p6', 'p7', 'p8'])
  })

  it('passes empty history when no rounds exist', async () => {
    const user = userEvent.setup()

    mockRoundsData = []
    mockAllPodsData = undefined

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, previousRounds] = mockGeneratePods.mock.calls[0]
    expect(previousRounds).toHaveLength(0)
  })

  it('passes empty history when allPods is undefined', async () => {
    const user = userEvent.setup()

    mockRoundsData = [
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]
    mockAllPodsData = undefined

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, previousRounds] = mockGeneratePods.mock.calls[0]
    expect(previousRounds).toHaveLength(0)
  })

  it('calls onPassphraseNeeded when passphrase is null', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <AdminControls {...defaultProps} passphrase={null} onPassphraseNeeded={onPassphraseNeeded} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockGeneratePods).not.toHaveBeenCalled()
  })

  it('does not call generatePods when event is ended', async () => {
    const user = userEvent.setup()

    render(
      <AdminControls {...defaultProps} isEventEnded={true} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).not.toHaveBeenCalled()
  })

  it('displays round count when rounds exist', () => {
    mockRoundsData = [
      { id: 'r2', event_id: 'evt1', round_number: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })

  it('displays "No rounds yet" when no rounds', () => {
    mockRoundsData = []

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('No rounds yet')).toBeInTheDocument()
  })
})
