import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { RoundDisplay } from './RoundDisplay'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const { mockUsePods } = vi.hoisted(() => ({
  mockUsePods: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/usePods', () => ({
  usePods: (...args: unknown[]) => mockUsePods(...args),
}))

vi.mock('@/components/PodCard', () => ({
  PodCard: ({
    podNumber,
    isBye,
    players,
    currentPlayerId,
  }: {
    podNumber: number
    isBye: boolean
    players: { playerId: string; playerName: string; seatNumber: number | null }[]
    currentPlayerId: string | null
  }) => (
    <div
      data-testid={`pod-card-${podNumber}`}
      data-is-bye={String(isBye)}
      data-current-player-id={currentPlayerId ?? ''}
      data-players={JSON.stringify(players)}
    >
      Pod {podNumber}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function makePod(overrides: {
  id: string
  pod_number: number
  is_bye?: boolean
  pod_players?: {
    id: string
    pod_id: string
    player_id: string
    seat_number: number | null
    players: { id: string; event_id: string; name: string; status: string; created_at: string }
  }[]
}) {
  return {
    id: overrides.id,
    round_id: 'round-1',
    pod_number: overrides.pod_number,
    is_bye: overrides.is_bye ?? false,
    pod_players: overrides.pod_players ?? [],
  }
}

const defaultProps = {
  roundId: 'round-1',
  roundNumber: 3,
  currentPlayerId: null as string | null,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RoundDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePods.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('shows loading spinner when isLoading is true', () => {
    mockUsePods.mockReturnValue({ data: undefined, isLoading: true })

    render(<RoundDisplay {...defaultProps} />, { wrapper: createWrapper() })

    const roundDisplay = screen.getByTestId('round-display')
    expect(roundDisplay).toBeInTheDocument()
    // The Loader2 SVG has animate-spin class
    const svg = roundDisplay.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.classList.contains('animate-spin')).toBe(true)
  })

  it('returns null when pods is undefined and not loading', () => {
    mockUsePods.mockReturnValue({ data: undefined, isLoading: false })

    const { container } = render(
      <RoundDisplay {...defaultProps} />,
      { wrapper: createWrapper() }
    )

    expect(container.innerHTML).toBe('')
  })

  it('returns null when pods is empty array and not loading', () => {
    mockUsePods.mockReturnValue({ data: [], isLoading: false })

    const { container } = render(
      <RoundDisplay {...defaultProps} />,
      { wrapper: createWrapper() }
    )

    expect(container.innerHTML).toBe('')
  })

  it('displays round number heading', () => {
    mockUsePods.mockReturnValue({
      data: [makePod({ id: 'pod-1', pod_number: 1 })],
      isLoading: false,
    })

    render(
      <RoundDisplay {...defaultProps} roundNumber={5} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('round-number')).toHaveTextContent('Round 5')
  })

  it('renders PodCard for each pod', () => {
    mockUsePods.mockReturnValue({
      data: [
        makePod({ id: 'pod-1', pod_number: 1 }),
        makePod({ id: 'pod-2', pod_number: 2 }),
        makePod({ id: 'pod-3', pod_number: 3 }),
      ],
      isLoading: false,
    })

    render(<RoundDisplay {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('pod-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('pod-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('pod-card-3')).toBeInTheDocument()
  })

  it('non-bye pods appear before bye pods in order', () => {
    // Provide pods with bye pod first in the data to confirm reordering
    mockUsePods.mockReturnValue({
      data: [
        makePod({ id: 'pod-bye', pod_number: 99, is_bye: true }),
        makePod({ id: 'pod-1', pod_number: 1, is_bye: false }),
        makePod({ id: 'pod-2', pod_number: 2, is_bye: false }),
      ],
      isLoading: false,
    })

    render(<RoundDisplay {...defaultProps} />, { wrapper: createWrapper() })

    const roundDisplay = screen.getByTestId('round-display')
    const podCards = roundDisplay.querySelectorAll('[data-testid^="pod-card-"]')

    expect(podCards).toHaveLength(3)
    // Non-bye pods should come first
    expect(podCards[0]).toHaveAttribute('data-is-bye', 'false')
    expect(podCards[1]).toHaveAttribute('data-is-bye', 'false')
    // Bye pod should be last
    expect(podCards[2]).toHaveAttribute('data-is-bye', 'true')
  })

  it('passes currentPlayerId through to PodCard', () => {
    mockUsePods.mockReturnValue({
      data: [makePod({ id: 'pod-1', pod_number: 1 })],
      isLoading: false,
    })

    render(
      <RoundDisplay {...defaultProps} currentPlayerId="player-42" />,
      { wrapper: createWrapper() }
    )

    const podCard = screen.getByTestId('pod-card-1')
    expect(podCard).toHaveAttribute('data-current-player-id', 'player-42')
  })

  it('passes correct player data from pod_players to PodCard', () => {
    const podWithPlayers = makePod({
      id: 'pod-1',
      pod_number: 1,
      pod_players: [
        {
          id: 'pp-1',
          pod_id: 'pod-1',
          player_id: 'p1',
          seat_number: 1,
          players: { id: 'p1', event_id: 'e1', name: 'Alice', status: 'active', created_at: '' },
        },
        {
          id: 'pp-2',
          pod_id: 'pod-1',
          player_id: 'p2',
          seat_number: 2,
          players: { id: 'p2', event_id: 'e1', name: 'Bob', status: 'active', created_at: '' },
        },
      ],
    })

    mockUsePods.mockReturnValue({
      data: [podWithPlayers],
      isLoading: false,
    })

    render(<RoundDisplay {...defaultProps} />, { wrapper: createWrapper() })

    const podCard = screen.getByTestId('pod-card-1')
    const players = JSON.parse(podCard.getAttribute('data-players')!)

    expect(players).toEqual([
      { playerId: 'p1', playerName: 'Alice', seatNumber: 1 },
      { playerId: 'p2', playerName: 'Bob', seatNumber: 2 },
    ])
  })
})
