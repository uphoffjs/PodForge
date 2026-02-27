import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreviousRounds } from './PreviousRounds'
import type { Round } from '@/types/database'
import type { PodWithPlayers } from '@/hooks/usePods'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const { mockUseRounds, mockUsePods } = vi.hoisted(() => ({
  mockUseRounds: vi.fn(),
  mockUsePods: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/useRounds', () => ({
  useRounds: (...args: unknown[]) => mockUseRounds(...args),
}))

vi.mock('@/hooks/usePods', () => ({
  usePods: (...args: unknown[]) => mockUsePods(...args),
}))

vi.mock('@/components/PodCard', () => ({
  PodCard: ({
    podNumber,
    isBye,
    currentPlayerId,
    players,
  }: {
    podNumber: number
    isBye: boolean
    currentPlayerId: string | null
    players: { playerId: string; playerName: string; seatNumber: number | null }[]
  }) => (
    <div
      data-testid={`mock-pod-card-${podNumber}`}
      data-is-bye={String(isBye)}
      data-current-player-id={currentPlayerId ?? ''}
    >
      {players.map((p) => (
        <span key={p.playerId} data-testid={`mock-pod-player-${p.playerId}`}>
          {p.playerName}
        </span>
      ))}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    event_id: 'event-1',
    round_number: 1,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePod(overrides: Partial<PodWithPlayers> = {}): PodWithPlayers {
  return {
    id: 'pod-1',
    round_id: 'round-1',
    pod_number: 1,
    is_bye: false,
    pod_players: [],
    ...overrides,
  }
}

function makePodPlayer(overrides: Partial<PodWithPlayers['pod_players'][0]> = {}): PodWithPlayers['pod_players'][0] {
  return {
    id: 'pp-1',
    pod_id: 'pod-1',
    player_id: 'player-1',
    seat_number: 1,
    players: {
      id: 'player-1',
      event_id: 'event-1',
      name: 'Alice',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  }
}

/**
 * Configures mockUsePods to return specific data based on the roundId argument.
 * When called with undefined (collapsed state), returns no data and not loading.
 * When called with a valid roundId, returns the corresponding entry from the map.
 */
function setupPodsMap(
  podsMap: Map<string, { data: PodWithPlayers[] | undefined; isLoading: boolean }>
) {
  mockUsePods.mockImplementation((roundId: string | undefined) => {
    if (roundId === undefined) {
      return { data: undefined, isLoading: false }
    }
    const entry = podsMap.get(roundId)
    if (entry) {
      return entry
    }
    return { data: undefined, isLoading: false }
  })
}

const defaultProps = {
  eventId: 'event-1',
  currentRoundNumber: 3,
  currentPlayerId: 'player-1',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PreviousRounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: useRounds returns undefined, usePods returns no data
    mockUseRounds.mockReturnValue({ data: undefined })
    mockUsePods.mockReturnValue({ data: undefined, isLoading: false })
  })

  // -------------------------------------------------------------------------
  // 1. Returns null when rounds data is undefined
  // -------------------------------------------------------------------------
  it('returns null when rounds data is undefined', () => {
    mockUseRounds.mockReturnValue({ data: undefined })

    const { container } = render(
      <PreviousRounds {...defaultProps} />
    )

    expect(container.innerHTML).toBe('')
  })

  // -------------------------------------------------------------------------
  // 2. Returns null when no rounds match (currentRoundNumber filters all out)
  // -------------------------------------------------------------------------
  it('returns null when no rounds match after filtering by currentRoundNumber', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r4', round_number: 4 }),
      ],
    })

    const { container } = render(
      <PreviousRounds {...defaultProps} currentRoundNumber={3} />
    )

    // round_number 3 is not < 3, and round_number 4 is not < 3
    expect(container.innerHTML).toBe('')
  })

  // -------------------------------------------------------------------------
  // 3. Returns null when only current round exists
  // -------------------------------------------------------------------------
  it('returns null when only the current round exists', () => {
    mockUseRounds.mockReturnValue({
      data: [makeRound({ id: 'r1', round_number: 1 })],
    })

    const { container } = render(
      <PreviousRounds {...defaultProps} currentRoundNumber={1} />
    )

    expect(container.innerHTML).toBe('')
  })

  // -------------------------------------------------------------------------
  // 4. Renders "Previous Rounds" heading when previous rounds exist
  // -------------------------------------------------------------------------
  it('renders "Previous Rounds" heading when previous rounds exist', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    expect(screen.getByTestId('previous-rounds')).toBeInTheDocument()
    expect(screen.getByText('Previous Rounds')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 5. Displays correct round numbers as toggle buttons
  // -------------------------------------------------------------------------
  it('displays correct round numbers as toggle buttons', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={3} />)

    expect(screen.getByTestId('previous-round-toggle-2')).toHaveTextContent('Round 2')
    expect(screen.getByTestId('previous-round-toggle-1')).toHaveTextContent('Round 1')
  })

  // -------------------------------------------------------------------------
  // 6. Filters out current round when currentRoundNumber is provided
  // -------------------------------------------------------------------------
  it('filters out current round when currentRoundNumber is provided', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={3} />)

    // Round 3 (current) should not appear
    expect(screen.queryByTestId('previous-round-3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('previous-round-toggle-3')).not.toBeInTheDocument()
    // Rounds 1 and 2 should appear
    expect(screen.getByTestId('previous-round-2')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-1')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 7. Uses rounds.slice(1) when currentRoundNumber is null
  // -------------------------------------------------------------------------
  it('uses rounds.slice(1) when currentRoundNumber is null', () => {
    // useRounds returns descending order, so round 3 is first
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(
      <PreviousRounds
        eventId="event-1"
        currentRoundNumber={null}
        currentPlayerId="player-1"
      />
    )

    // slice(1) skips the first element (round 3), shows rounds 2 and 1
    expect(screen.queryByTestId('previous-round-3')).not.toBeInTheDocument()
    expect(screen.getByTestId('previous-round-2')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-1')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 8. Collapsed by default (no expanded content visible)
  // -------------------------------------------------------------------------
  it('is collapsed by default with no expanded content visible', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    // The toggle button is visible
    expect(screen.getByTestId('previous-round-toggle-1')).toBeInTheDocument()
    // But no pod cards or loading indicators should be present
    expect(screen.queryByText('No pods for this round.')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-pod-card-1')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 9. Expand toggle shows pods content
  // -------------------------------------------------------------------------
  it('expand toggle shows pods content', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      [
        'r1',
        {
          data: [
            makePod({
              id: 'pod-1',
              round_id: 'r1',
              pod_number: 1,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-1',
                  pod_id: 'pod-1',
                  player_id: 'p1',
                  players: { id: 'p1', event_id: 'event-1', name: 'Alice', status: 'active', created_at: '' },
                }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    expect(screen.getByTestId('mock-pod-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('mock-pod-player-p1')).toHaveTextContent('Alice')
  })

  // -------------------------------------------------------------------------
  // 10. Collapse toggle hides pods content
  // -------------------------------------------------------------------------
  it('collapse toggle hides pods content after being expanded', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      [
        'r1',
        {
          data: [
            makePod({
              id: 'pod-1',
              round_id: 'r1',
              pod_number: 1,
              pod_players: [
                makePodPlayer({ id: 'pp-1', pod_id: 'pod-1', player_id: 'p1' }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    const toggle = screen.getByTestId('previous-round-toggle-1')

    // Expand
    await user.click(toggle)
    expect(screen.getByTestId('mock-pod-card-1')).toBeInTheDocument()

    // Collapse
    await user.click(toggle)
    expect(screen.queryByTestId('mock-pod-card-1')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 11. usePods called with undefined when collapsed (lazy load)
  // -------------------------------------------------------------------------
  it('calls usePods with undefined when section is collapsed', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    // usePods should have been called with undefined (not the roundId)
    expect(mockUsePods).toHaveBeenCalledWith(undefined)
    expect(mockUsePods).not.toHaveBeenCalledWith('r1')
  })

  // -------------------------------------------------------------------------
  // 12. usePods called with roundId when expanded
  // -------------------------------------------------------------------------
  it('calls usePods with roundId when section is expanded', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    expect(mockUsePods).toHaveBeenCalledWith('r1')
  })

  // -------------------------------------------------------------------------
  // 13. Loading spinner shown when pods isLoading (after expand)
  // -------------------------------------------------------------------------
  it('shows loading spinner when pods are loading after expand', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      ['r1', { data: undefined, isLoading: true }],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    // The Loader2 icon from lucide-react renders as an svg element
    const roundSection = screen.getByTestId('previous-round-1')
    const svgs = roundSection.querySelectorAll('svg')
    // There should be at least 2 svgs: the chevron icon and the loading spinner
    expect(svgs.length).toBeGreaterThanOrEqual(2)
    // No pod cards or empty message should be visible
    expect(screen.queryByTestId('mock-pod-card-1')).not.toBeInTheDocument()
    expect(screen.queryByText('No pods for this round.')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 14. Empty pods message shown when sortedPods is empty
  // -------------------------------------------------------------------------
  it('shows empty pods message when data is an empty array', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      ['r1', { data: [], isLoading: false }],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    expect(screen.getByText('No pods for this round.')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 15. PodCard rendered for each pod when data available
  // -------------------------------------------------------------------------
  it('renders a PodCard for each pod when data is available', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      [
        'r1',
        {
          data: [
            makePod({
              id: 'pod-1',
              round_id: 'r1',
              pod_number: 1,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-1',
                  pod_id: 'pod-1',
                  player_id: 'p1',
                  players: { id: 'p1', event_id: 'event-1', name: 'Alice', status: 'active', created_at: '' },
                }),
              ],
            }),
            makePod({
              id: 'pod-2',
              round_id: 'r1',
              pod_number: 2,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-2',
                  pod_id: 'pod-2',
                  player_id: 'p2',
                  players: { id: 'p2', event_id: 'event-1', name: 'Bob', status: 'active', created_at: '' },
                }),
              ],
            }),
            makePod({
              id: 'pod-3',
              round_id: 'r1',
              pod_number: 3,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-3',
                  pod_id: 'pod-3',
                  player_id: 'p3',
                  players: { id: 'p3', event_id: 'event-1', name: 'Charlie', status: 'active', created_at: '' },
                }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    expect(screen.getByTestId('mock-pod-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('mock-pod-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('mock-pod-card-3')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 16. Non-bye pods appear before bye pods
  // -------------------------------------------------------------------------
  it('renders non-bye pods before bye pods in sorted order', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      [
        'r1',
        {
          data: [
            makePod({
              id: 'pod-bye',
              round_id: 'r1',
              pod_number: 3,
              is_bye: true,
              pod_players: [
                makePodPlayer({
                  id: 'pp-bye',
                  pod_id: 'pod-bye',
                  player_id: 'p3',
                  players: { id: 'p3', event_id: 'event-1', name: 'Charlie', status: 'active', created_at: '' },
                }),
              ],
            }),
            makePod({
              id: 'pod-1',
              round_id: 'r1',
              pod_number: 1,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-1',
                  pod_id: 'pod-1',
                  player_id: 'p1',
                  players: { id: 'p1', event_id: 'event-1', name: 'Alice', status: 'active', created_at: '' },
                }),
              ],
            }),
            makePod({
              id: 'pod-2',
              round_id: 'r1',
              pod_number: 2,
              is_bye: false,
              pod_players: [
                makePodPlayer({
                  id: 'pp-2',
                  pod_id: 'pod-2',
                  player_id: 'p2',
                  players: { id: 'p2', event_id: 'event-1', name: 'Bob', status: 'active', created_at: '' },
                }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={2} />)

    await user.click(screen.getByTestId('previous-round-toggle-1'))

    // All three pod cards should be rendered
    const podCard1 = screen.getByTestId('mock-pod-card-1')
    const podCard2 = screen.getByTestId('mock-pod-card-2')
    const podCardBye = screen.getByTestId('mock-pod-card-3')

    expect(podCard1).toHaveAttribute('data-is-bye', 'false')
    expect(podCard2).toHaveAttribute('data-is-bye', 'false')
    expect(podCardBye).toHaveAttribute('data-is-bye', 'true')

    // Verify ordering: non-bye pods appear before bye pod in the DOM
    const roundSection = screen.getByTestId('previous-round-1')
    const allPodCards = roundSection.querySelectorAll('[data-testid^="mock-pod-card-"]')
    expect(allPodCards).toHaveLength(3)
    expect(allPodCards[0]).toHaveAttribute('data-is-bye', 'false')
    expect(allPodCards[1]).toHaveAttribute('data-is-bye', 'false')
    expect(allPodCards[2]).toHaveAttribute('data-is-bye', 'true')
  })

  // -------------------------------------------------------------------------
  // 17. Independent expand state per round
  // -------------------------------------------------------------------------
  it('maintains independent expand state per round section', async () => {
    const user = userEvent.setup()

    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    const podsMap = new Map([
      [
        'r1',
        {
          data: [
            makePod({
              id: 'pod-r1',
              round_id: 'r1',
              pod_number: 1,
              pod_players: [
                makePodPlayer({
                  id: 'pp-r1',
                  pod_id: 'pod-r1',
                  player_id: 'p1',
                  players: { id: 'p1', event_id: 'event-1', name: 'Alice', status: 'active', created_at: '' },
                }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
      [
        'r2',
        {
          data: [
            makePod({
              id: 'pod-r2',
              round_id: 'r2',
              pod_number: 2,
              pod_players: [
                makePodPlayer({
                  id: 'pp-r2',
                  pod_id: 'pod-r2',
                  player_id: 'p2',
                  players: { id: 'p2', event_id: 'event-1', name: 'Bob', status: 'active', created_at: '' },
                }),
              ],
            }),
          ],
          isLoading: false,
        },
      ],
    ])
    setupPodsMap(podsMap)

    render(<PreviousRounds {...defaultProps} currentRoundNumber={3} />)

    // Expand round 1 only
    await user.click(screen.getByTestId('previous-round-toggle-1'))

    // Round 1 is expanded -- shows its pod card
    expect(screen.getByTestId('mock-pod-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('mock-pod-player-p1')).toHaveTextContent('Alice')

    // Round 2 stays collapsed -- no pod card for round 2
    expect(screen.queryByTestId('mock-pod-card-2')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 18. data-testid pattern verification
  // -------------------------------------------------------------------------
  it('uses data-testid pattern previous-round-{roundNumber} and previous-round-toggle-{roundNumber}', () => {
    mockUseRounds.mockReturnValue({
      data: [
        makeRound({ id: 'r4', round_number: 4 }),
        makeRound({ id: 'r3', round_number: 3 }),
        makeRound({ id: 'r2', round_number: 2 }),
        makeRound({ id: 'r1', round_number: 1 }),
      ],
    })

    render(<PreviousRounds {...defaultProps} currentRoundNumber={4} />)

    // Verify container testids
    expect(screen.getByTestId('previous-round-3')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-2')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-1')).toBeInTheDocument()

    // Verify toggle button testids
    expect(screen.getByTestId('previous-round-toggle-3')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-toggle-2')).toBeInTheDocument()
    expect(screen.getByTestId('previous-round-toggle-1')).toBeInTheDocument()

    // Current round should not be present
    expect(screen.queryByTestId('previous-round-4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('previous-round-toggle-4')).not.toBeInTheDocument()
  })
})
