import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventPage } from './EventPage'
import type { Player } from '@/types/database'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const {
  mockUseEvent,
  mockUseEventPlayers,
  mockUseAdminAuth,
  mockDropMutate,
  mockGetStoredPlayerId,
  mockClearPlayerId,
  mockStorePlayerId,
  mockUseParams,
  mockUseEventChannel,
  mockUseVisibilityRefetch,
  mockUseDropPlayer,
  mockUseCurrentRound,
  mockUseTimer,
} = vi.hoisted(() => ({
  mockUseEvent: vi.fn(),
  mockUseEventPlayers: vi.fn(),
  mockUseAdminAuth: vi.fn(),
  mockDropMutate: vi.fn(),
  mockGetStoredPlayerId: vi.fn(),
  mockClearPlayerId: vi.fn(),
  mockStorePlayerId: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseEventChannel: vi.fn(),
  mockUseVisibilityRefetch: vi.fn(),
  mockUseDropPlayer: vi.fn(),
  mockUseCurrentRound: vi.fn(),
  mockUseTimer: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('react-router', () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
}))

vi.mock('@/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => mockUseEvent(...args),
}))

vi.mock('@/hooks/useEventPlayers', () => ({
  useEventPlayers: (...args: unknown[]) => mockUseEventPlayers(...args),
}))

vi.mock('@/hooks/useAdminAuth', () => ({
  useAdminAuth: (...args: unknown[]) => mockUseAdminAuth(...args),
}))

vi.mock('@/hooks/useEventChannel', () => ({
  useEventChannel: (...args: unknown[]) => mockUseEventChannel(...args),
}))

vi.mock('@/hooks/useVisibilityRefetch', () => ({
  useVisibilityRefetch: (...args: unknown[]) => mockUseVisibilityRefetch(...args),
}))

vi.mock('@/hooks/useDropPlayer', () => ({
  useDropPlayer: (...args: unknown[]) => mockUseDropPlayer(...args),
}))

vi.mock('@/hooks/useCurrentRound', () => ({
  useCurrentRound: (...args: unknown[]) => mockUseCurrentRound(...args),
}))

vi.mock('@/hooks/useTimer', () => ({
  useTimer: (...args: unknown[]) => mockUseTimer(...args),
}))

vi.mock('@/lib/player-identity', () => ({
  getStoredPlayerId: (...args: unknown[]) => mockGetStoredPlayerId(...args),
  clearPlayerId: (...args: unknown[]) => mockClearPlayerId(...args),
  storePlayerId: (...args: unknown[]) => mockStorePlayerId(...args),
}))

// ---------------------------------------------------------------------------
// Mock child components to isolate page logic
// ---------------------------------------------------------------------------
vi.mock('@/components/JoinEventForm', () => ({
  JoinEventForm: ({
    onJoined,
  }: {
    eventId: string
    onJoined: (id: string) => void
  }) => (
    <div data-testid="join-form">
      <button data-testid="mock-join" onClick={() => onJoined('p-new')}>
        Join
      </button>
    </div>
  ),
}))

vi.mock('@/components/PlayerList', () => ({
  PlayerList: ({
    newPlayerIds,
    players,
    currentPlayerId,
  }: {
    players: Player[]
    currentPlayerId: string | null
    newPlayerIds?: Set<string>
  }) => (
    <div
      data-testid="player-list"
      data-new-player-ids={
        newPlayerIds ? JSON.stringify([...newPlayerIds]) : '[]'
      }
      data-player-count={players.length}
      data-current-player-id={currentPlayerId ?? ''}
    />
  ),
}))

vi.mock('@/components/AddPlayerForm', () => ({
  AddPlayerForm: () => <div data-testid="add-player-form" />,
}))

vi.mock('@/components/EventInfoBar', () => ({
  EventInfoBar: ({
    eventName,
    eventStatus,
    activePlayerCount,
    currentRoundNumber,
  }: {
    eventId: string
    eventName: string
    eventStatus: string
    activePlayerCount: number
    currentRoundNumber: number | null
  }) => (
    <div
      data-testid="event-info-bar"
      data-event-name={eventName}
      data-event-status={eventStatus}
      data-active-player-count={activePlayerCount}
      data-current-round-number={currentRoundNumber ?? ''}
    />
  ),
}))

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <button data-testid="mock-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="mock-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

vi.mock('@/components/RoundDisplay', () => ({
  RoundDisplay: ({ roundNumber }: { roundId: string; roundNumber: number; currentPlayerId: string | null }) => (
    <div data-testid="round-display" data-round-number={roundNumber} />
  ),
}))

vi.mock('@/components/AdminControls', () => ({
  AdminControls: ({ onPassphraseNeeded }: { eventId: string; isAdmin: boolean; passphrase: string | null; onPassphraseNeeded: () => void; players: Player[]; isEventEnded: boolean }) => (
    <div data-testid="admin-controls">
      <button data-testid="mock-passphrase-needed" onClick={onPassphraseNeeded}>
        Need Passphrase
      </button>
    </div>
  ),
}))

vi.mock('@/components/PreviousRounds', () => ({
  PreviousRounds: () => <div data-testid="previous-rounds" />,
}))

vi.mock('@/components/TimerDisplay', () => ({
  TimerDisplay: () => <div data-testid="timer-display" />,
}))

vi.mock('@/components/TimerControls', () => ({
  TimerControls: () => <div data-testid="timer-controls" />,
}))

vi.mock('@/components/AdminPassphraseModal', () => ({
  AdminPassphraseModal: ({
    isOpen,
    onSubmit,
    onCancel,
  }: {
    isOpen: boolean
    onSubmit: (passphrase: string) => void
    onCancel: () => void
    error?: string | null
  }) =>
    isOpen ? (
      <div data-testid="admin-passphrase-modal">
        <button data-testid="mock-passphrase-submit" onClick={() => onSubmit('secret123')}>
          Submit
        </button>
        <button data-testid="mock-passphrase-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

// ---------------------------------------------------------------------------
// Default mock data
// ---------------------------------------------------------------------------
const defaultEvent = {
  id: 'evt1',
  name: 'Test Event',
  status: 'active',
  created_at: '2024-01-01',
}

const defaultPlayers: Player[] = [
  {
    id: 'p1',
    name: 'Alice',
    status: 'active',
    event_id: 'evt1',
    created_at: '2024-01-01',
  },
]

// Players list that includes p-new so the verification effect does not clear it
const playersIncludingNew: Player[] = [
  ...defaultPlayers,
  {
    id: 'p-new',
    name: 'Newcomer',
    status: 'active',
    event_id: 'evt1',
    created_at: '2024-01-02',
  },
]

function setDefaultMocks() {
  mockUseParams.mockReturnValue({ eventId: 'evt1' })
  mockUseEvent.mockReturnValue({
    data: defaultEvent,
    isLoading: false,
    error: null,
  })
  mockUseEventPlayers.mockReturnValue({
    data: defaultPlayers,
    isLoading: false,
  })
  mockUseAdminAuth.mockReturnValue({
    isAdmin: false,
    passphrase: null,
    setPassphrase: vi.fn(),
    clearPassphrase: vi.fn(),
  })
  mockGetStoredPlayerId.mockReturnValue(null)
  mockUseDropPlayer.mockReturnValue({ mutate: mockDropMutate, isPending: false })
  mockUseCurrentRound.mockReturnValue({ data: null, isLoading: false })
  mockUseTimer.mockReturnValue({ data: null, isLoading: false })
}

// ---------------------------------------------------------------------------
// Helper to read newPlayerIds from the PlayerList mock
// ---------------------------------------------------------------------------
function getNewPlayerIds(): string[] {
  const el = screen.getByTestId('player-list')
  return JSON.parse(el.getAttribute('data-new-player-ids') ?? '[]')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('EventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- Loading states ---

  it('shows loading spinner when eventLoading is true', () => {
    mockUseEvent.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<EventPage />)

    expect(screen.getByTestId('event-loading')).toBeInTheDocument()
    expect(screen.getByText('Loading event...')).toBeInTheDocument()
  })

  it('shows loading spinner when playersLoading is true', () => {
    mockUseEventPlayers.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<EventPage />)

    expect(screen.getByTestId('event-loading')).toBeInTheDocument()
  })

  // --- Error states ---

  it('shows error state when eventError is set', () => {
    mockUseEvent.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })

    render(<EventPage />)

    expect(screen.getByTestId('event-error')).toBeInTheDocument()
    expect(screen.getByText('Event Not Found')).toBeInTheDocument()
    expect(
      screen.getByText("This event doesn't exist or has been removed.")
    ).toBeInTheDocument()
  })

  it('shows invalid event when no eventId from params', () => {
    mockUseParams.mockReturnValue({})

    render(<EventPage />)

    expect(screen.getByText('Invalid Event')).toBeInTheDocument()
    expect(screen.getByText('No event ID provided.')).toBeInTheDocument()
  })

  // --- Loaded state: EventInfoBar ---

  it('renders EventInfoBar with correct props when loaded', () => {
    render(<EventPage />)

    const infoBar = screen.getByTestId('event-info-bar')
    expect(infoBar).toBeInTheDocument()
    expect(infoBar).toHaveAttribute('data-event-name', 'Test Event')
    expect(infoBar).toHaveAttribute('data-event-status', 'active')
    expect(infoBar).toHaveAttribute('data-active-player-count', '1')
    expect(infoBar).toHaveAttribute('data-current-round-number', '')
  })

  it('passes active player count excluding dropped players to EventInfoBar', () => {
    mockUseEventPlayers.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alice', status: 'active', event_id: 'evt1', created_at: '2024-01-01' },
        { id: 'p2', name: 'Bob', status: 'dropped', event_id: 'evt1', created_at: '2024-01-02' },
        { id: 'p3', name: 'Charlie', status: 'active', event_id: 'evt1', created_at: '2024-01-03' },
      ],
      isLoading: false,
    })

    render(<EventPage />)

    const infoBar = screen.getByTestId('event-info-bar')
    expect(infoBar).toHaveAttribute('data-active-player-count', '2')
  })

  it('passes current round number to EventInfoBar when round exists', () => {
    mockUseCurrentRound.mockReturnValue({
      data: { id: 'r1', event_id: 'evt1', round_number: 3, created_at: '2024-01-01' },
      isLoading: false,
    })

    render(<EventPage />)

    const infoBar = screen.getByTestId('event-info-bar')
    expect(infoBar).toHaveAttribute('data-current-round-number', '3')
  })

  // --- Join form visibility ---

  it('shows JoinEventForm when player has not joined', () => {
    render(<EventPage />)

    expect(screen.getByTestId('join-form')).toBeInTheDocument()
    expect(screen.getByTestId('join-skip-btn')).toBeInTheDocument()
  })

  it('hides JoinEventForm after player joins via onJoined callback', async () => {
    const user = userEvent.setup()

    // Include p-new in the players list so the verification effect does not
    // clear currentPlayerId after onJoined sets it to 'p-new'.
    mockUseEventPlayers.mockReturnValue({
      data: playersIncludingNew,
      isLoading: false,
    })

    render(<EventPage />)

    expect(screen.getByTestId('join-form')).toBeInTheDocument()

    await user.click(screen.getByTestId('mock-join'))

    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
  })

  it('stores player identity with exact eventId and playerId when joining', async () => {
    const user = userEvent.setup()
    render(<EventPage />)

    await user.click(screen.getByTestId('mock-join'))

    expect(mockStorePlayerId).toHaveBeenCalledTimes(1)
    expect(mockStorePlayerId).toHaveBeenCalledWith('evt1', 'p-new')
  })

  it('hides JoinEventForm when skip button is clicked', async () => {
    const user = userEvent.setup()
    render(<EventPage />)

    expect(screen.getByTestId('join-form')).toBeInTheDocument()

    await user.click(screen.getByTestId('join-skip-btn'))

    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
  })

  it('does not show JoinEventForm when localStorage has stored player', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
  })

  // --- Admin features ---

  it('shows AddPlayerForm when isAdmin is true', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      passphrase: 'secret',
      setPassphrase: vi.fn(),
      clearPassphrase: vi.fn(),
    })

    render(<EventPage />)

    expect(screen.getByTestId('add-player-form')).toBeInTheDocument()
  })

  it('hides AddPlayerForm when isAdmin is false', () => {
    render(<EventPage />)

    expect(screen.queryByTestId('add-player-form')).not.toBeInTheDocument()
  })

  // --- Leave event ---

  it('shows Leave Event button when current player is active', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    expect(screen.getByTestId('leave-event-btn')).toBeInTheDocument()
  })

  it('hides Leave Event button when no currentPlayerId', () => {
    render(<EventPage />)

    expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
  })

  it('hides Leave Event button when current player is dropped', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')
    mockUseEventPlayers.mockReturnValue({
      data: [
        {
          id: 'p1',
          name: 'Alice',
          status: 'dropped',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ],
      isLoading: false,
    })

    render(<EventPage />)

    expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
  })

  it('opens leave confirmation dialog when Leave Event button is clicked', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('leave-event-btn'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('closes leave confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    await user.click(screen.getByTestId('leave-event-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('mock-cancel'))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('calls dropPlayer.mutate when leave is confirmed', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    await user.click(screen.getByTestId('leave-event-btn'))
    await user.click(screen.getByTestId('mock-confirm'))

    expect(mockDropMutate).toHaveBeenCalledTimes(1)
    expect(mockDropMutate).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it('clears player state on successful leave', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayerId.mockReturnValue('p1')
    mockDropMutate.mockImplementation(
      (_id: string, options: { onSuccess: () => void }) => {
        options.onSuccess()
      }
    )

    render(<EventPage />)

    await user.click(screen.getByTestId('leave-event-btn'))
    await user.click(screen.getByTestId('mock-confirm'))

    // After successful leave, confirm dialog should close
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    // Leave button should disappear (no currentPlayerId)
    expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
    // Join form should reappear (skippedJoin reset to false, no currentPlayerId)
    expect(screen.getByTestId('join-form')).toBeInTheDocument()
  })

  // --- Player list always visible ---

  it('always shows player list when event is loaded', () => {
    render(<EventPage />)

    expect(screen.getByTestId('player-list')).toBeInTheDocument()
  })

  // --- localStorage storedId guard (kills if(storedId) → if(true)) ---

  it('does not reset currentPlayerId when storedId is null on eventId change while justJoined is pending', async () => {
    const user = userEvent.setup()
    mockUseParams.mockReturnValue({ eventId: 'evt1' })
    mockGetStoredPlayerId.mockReturnValue(null)

    const { rerender } = render(<EventPage />)

    // Player joins → currentPlayerId = 'p-new', justJoinedRef = true
    await user.click(screen.getByTestId('mock-join'))
    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()

    // Change eventId; getStoredPlayerId returns null for new event
    // justJoinedRef is still true (p-new never appeared in players list)
    mockUseParams.mockReturnValue({ eventId: 'evt2' })
    mockGetStoredPlayerId.mockReturnValue(null)
    mockUseEvent.mockReturnValue({
      data: { id: 'evt2', name: 'Event 2', status: 'active', created_at: '2024-01-01' },
      isLoading: false,
      error: null,
    })
    mockUseEventPlayers.mockReturnValue({
      data: defaultPlayers,
      isLoading: false,
    })

    rerender(<EventPage />)

    // Original: if(null) → skip, currentPlayerId stays 'p-new', join form hidden
    // Mutant: if(true) → setCurrentPlayerId(null), join form appears
    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
  })

  // --- Stored player verification ---

  it('clears stored player if they are not in the players list', () => {
    mockGetStoredPlayerId.mockReturnValue('nonexistent-player')

    render(<EventPage />)

    // The effect should clear the non-existent player
    expect(mockClearPlayerId).toHaveBeenCalledTimes(1)
    expect(mockClearPlayerId).toHaveBeenCalledWith('evt1')
  })

  it('does not clear stored player if they exist in the players list', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')

    render(<EventPage />)

    expect(mockClearPlayerId).not.toHaveBeenCalled()
  })

  // --- isActivePlayer logic with multiple players (Group 2) ---

  describe('isActivePlayer with multiple players', () => {
    it('shows Leave button only when currentPlayerId matches an active player among many', () => {
      // Two players: p1 is active, p2 is active.
      // currentPlayerId is p1. With .some() this works; with .every() it would
      // fail because p2.id !== p1 would make .every() return false.
      const multiplePlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockGetStoredPlayerId.mockReturnValue('p1')
      mockUseEventPlayers.mockReturnValue({
        data: multiplePlayers,
        isLoading: false,
      })

      render(<EventPage />)

      // With .some(), p1 is found among the list -> button visible
      // With .every(), p2.id !== 'p1' would make it false -> button hidden
      expect(screen.getByTestId('leave-event-btn')).toBeInTheDocument()
    })

    it('hides Leave button when currentPlayerId is active but does not match any player id', () => {
      const multiplePlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockGetStoredPlayerId.mockReturnValue('p-nonexistent')
      mockUseEventPlayers.mockReturnValue({
        data: multiplePlayers,
        isLoading: false,
      })

      render(<EventPage />)

      // The verification effect clears nonexistent players, so button should not appear
      expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
    })

    it('hides Leave button when currentPlayerId matches but player status is dropped among multiple', () => {
      const multiplePlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'dropped',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockGetStoredPlayerId.mockReturnValue('p1')
      mockUseEventPlayers.mockReturnValue({
        data: multiplePlayers,
        isLoading: false,
      })

      render(<EventPage />)

      // p1 exists but is dropped; .some() checks both id AND status
      // Mutant `true && p.status === 'active'` would match p2 (wrong player) -> visible
      // Correct code matches only p1 which is dropped -> hidden
      expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
    })
  })

  // --- New player detection effect (Group 1) ---

  describe('new player highlight detection', () => {
    it('does not highlight any players on first render (no previous IDs)', () => {
      // On initial render, prevPlayerIdsRef is empty so the "prevIds.size > 0"
      // guard prevents any highlighting. If mutated to `true`, all initial
      // players would be incorrectly highlighted.
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      render(<EventPage />)

      const highlighted = getNewPlayerIds()
      expect(highlighted).toEqual([])
    })

    it('highlights only the newly added player after rerender', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      // After initial render, no highlights
      expect(getNewPlayerIds()).toEqual([])

      // New player joins
      const updatedPlayers: Player[] = [
        ...initialPlayers,
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: updatedPlayers,
        isLoading: false,
      })

      rerender(<EventPage />)

      // p2 should be highlighted; p1 should NOT be highlighted
      const highlighted = getNewPlayerIds()
      expect(highlighted).toContain('p2')
      expect(highlighted).not.toContain('p1')
      expect(highlighted).toHaveLength(1)
    })

    it('does not highlight when rerendered with the same players', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      // Rerender with the same players (new array reference, same content)
      mockUseEventPlayers.mockReturnValue({
        data: [...initialPlayers],
        isLoading: false,
      })

      rerender(<EventPage />)

      expect(getNewPlayerIds()).toEqual([])
    })

    it('clears highlight after the 400ms animation timeout', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      // Add a new player
      const updatedPlayers: Player[] = [
        ...initialPlayers,
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: updatedPlayers,
        isLoading: false,
      })

      rerender(<EventPage />)

      // Highlighted immediately
      expect(getNewPlayerIds()).toContain('p2')

      // Advance past the 400ms timer
      act(() => {
        vi.advanceTimersByTime(400)
      })

      // Highlight should be cleared
      expect(getNewPlayerIds()).toEqual([])
    })

    it('does not highlight a dropped player appearing in the list', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      // A dropped player appears but should not trigger highlight because
      // only active players are tracked. If filter is mutated to ignore
      // status, this would incorrectly highlight.
      const updatedPlayers: Player[] = [
        ...initialPlayers,
        {
          id: 'p-dropped',
          name: 'Charlie',
          status: 'dropped',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: updatedPlayers,
        isLoading: false,
      })

      rerender(<EventPage />)

      const highlighted = getNewPlayerIds()
      expect(highlighted).not.toContain('p-dropped')
      expect(highlighted).toEqual([])
    })

    it('highlights multiple new players added at once', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-01',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      const updatedPlayers: Player[] = [
        ...initialPlayers,
        {
          id: 'p2',
          name: 'Bob',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-02',
        },
        {
          id: 'p3',
          name: 'Charlie',
          status: 'active',
          event_id: 'evt1',
          created_at: '2024-01-03',
        },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: updatedPlayers,
        isLoading: false,
      })

      rerender(<EventPage />)

      const highlighted = getNewPlayerIds()
      expect(highlighted).toContain('p2')
      expect(highlighted).toContain('p3')
      expect(highlighted).not.toContain('p1')
      expect(highlighted).toHaveLength(2)
    })

    it('does not highlight when players is null/undefined', () => {
      mockUseEventPlayers.mockReturnValue({
        data: undefined,
        isLoading: true,
      })

      render(<EventPage />)

      // When players is undefined, loading state is shown; no highlight logic runs.
      // This just ensures no crash and exercises the early return guard.
      expect(screen.getByTestId('event-loading')).toBeInTheDocument()
    })
  })

  // --- Passphrase modal flow (lines 148-156) ---

  describe('passphrase modal', () => {
    beforeEach(() => {
      mockUseAdminAuth.mockReturnValue({
        isAdmin: true,
        passphrase: null,
        setPassphrase: vi.fn(),
        clearPassphrase: vi.fn(),
      })
    })

    it('opens passphrase modal when admin controls trigger onPassphraseNeeded', async () => {
      const user = userEvent.setup()
      render(<EventPage />)

      // Modal should not be visible initially
      expect(screen.queryByTestId('admin-passphrase-modal')).not.toBeInTheDocument()

      // Click the "Need Passphrase" button from admin-controls mock
      await user.click(screen.getByTestId('mock-passphrase-needed'))

      // Modal should now be visible
      expect(screen.getByTestId('admin-passphrase-modal')).toBeInTheDocument()
    })

    it('closes passphrase modal and clears error when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<EventPage />)

      // Open the modal
      await user.click(screen.getByTestId('mock-passphrase-needed'))
      expect(screen.getByTestId('admin-passphrase-modal')).toBeInTheDocument()

      // Click cancel
      await user.click(screen.getByTestId('mock-passphrase-cancel'))

      // Modal should close
      expect(screen.queryByTestId('admin-passphrase-modal')).not.toBeInTheDocument()
    })

    it('calls setPassphrase and closes modal when passphrase is submitted', async () => {
      const user = userEvent.setup()
      const mockSetPassphrase = vi.fn()
      mockUseAdminAuth.mockReturnValue({
        isAdmin: true,
        passphrase: null,
        setPassphrase: mockSetPassphrase,
        clearPassphrase: vi.fn(),
      })

      render(<EventPage />)

      // Open the modal
      await user.click(screen.getByTestId('mock-passphrase-needed'))
      expect(screen.getByTestId('admin-passphrase-modal')).toBeInTheDocument()

      // Click submit (mock calls onSubmit with 'secret123')
      await user.click(screen.getByTestId('mock-passphrase-submit'))

      // setPassphrase should have been called
      expect(mockSetPassphrase).toHaveBeenCalledWith('secret123')
      // Modal should close
      expect(screen.queryByTestId('admin-passphrase-modal')).not.toBeInTheDocument()
    })
  })

  // --- Event ended state ---

  describe('event ended state', () => {
    beforeEach(() => {
      mockUseEvent.mockReturnValue({
        data: { ...defaultEvent, status: 'ended' },
        isLoading: false,
        error: null,
      })
      mockGetStoredPlayerId.mockReturnValue('p1')
      mockUseAdminAuth.mockReturnValue({
        isAdmin: true,
        passphrase: 'secret',
        setPassphrase: vi.fn(),
        clearPassphrase: vi.fn(),
      })
    })

    it('shows event-ended-banner when event status is ended', () => {
      render(<EventPage />)
      expect(screen.getByTestId('event-ended-banner')).toBeInTheDocument()
    })

    it('hides join form when event is ended', () => {
      mockGetStoredPlayerId.mockReturnValue(null)
      render(<EventPage />)
      expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
    })

    it('hides admin controls when event is ended', () => {
      render(<EventPage />)
      expect(screen.queryByTestId('admin-controls')).not.toBeInTheDocument()
    })

    it('hides add player form when event is ended', () => {
      render(<EventPage />)
      expect(screen.queryByTestId('add-player-form')).not.toBeInTheDocument()
    })

    it('hides leave event button when event is ended', () => {
      render(<EventPage />)
      expect(screen.queryByTestId('leave-event-btn')).not.toBeInTheDocument()
    })
  })

  // --- Timer display visibility ---

  describe('timer display and controls', () => {
    it('shows timer-display when timer has running status', () => {
      mockUseTimer.mockReturnValue({
        data: {
          id: 't1',
          event_id: 'evt1',
          round_id: 'r1',
          status: 'running',
          duration_minutes: 60,
          started_at: '2026-01-01T00:00:00Z',
          expires_at: new Date(Date.now() + 1800 * 1000).toISOString(),
          remaining_seconds: null,
          paused_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        isLoading: false,
      })

      render(<EventPage />)

      expect(screen.getByTestId('timer-display')).toBeInTheDocument()
    })

    it('does NOT show timer-display when timer status is cancelled', () => {
      mockUseTimer.mockReturnValue({
        data: {
          id: 't1',
          event_id: 'evt1',
          round_id: 'r1',
          status: 'cancelled',
          duration_minutes: 60,
          started_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-01-01T01:00:00Z',
          remaining_seconds: null,
          paused_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        isLoading: false,
      })

      render(<EventPage />)

      expect(screen.queryByTestId('timer-display')).not.toBeInTheDocument()
    })

    it('shows timer-controls when admin with passphrase and running timer', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdmin: true,
        passphrase: 'secret',
        setPassphrase: vi.fn(),
        clearPassphrase: vi.fn(),
      })
      mockUseTimer.mockReturnValue({
        data: {
          id: 't1',
          event_id: 'evt1',
          round_id: 'r1',
          status: 'running',
          duration_minutes: 60,
          started_at: '2026-01-01T00:00:00Z',
          expires_at: new Date(Date.now() + 1800 * 1000).toISOString(),
          remaining_seconds: null,
          paused_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        isLoading: false,
      })

      render(<EventPage />)

      expect(screen.getByTestId('timer-controls')).toBeInTheDocument()
    })

    it('does NOT show timer-controls when admin but passphrase is null', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdmin: true,
        passphrase: null,
        setPassphrase: vi.fn(),
        clearPassphrase: vi.fn(),
      })
      mockUseTimer.mockReturnValue({
        data: {
          id: 't1',
          event_id: 'evt1',
          round_id: 'r1',
          status: 'running',
          duration_minutes: 60,
          started_at: '2026-01-01T00:00:00Z',
          expires_at: new Date(Date.now() + 1800 * 1000).toISOString(),
          remaining_seconds: null,
          paused_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        isLoading: false,
      })

      render(<EventPage />)

      // timer-display should be visible (timer exists and not cancelled)
      expect(screen.getByTestId('timer-display')).toBeInTheDocument()
      // timer-controls should NOT be visible (passphrase is null)
      expect(screen.queryByTestId('timer-controls')).not.toBeInTheDocument()
    })
  })

  // --- Fallback branches when event/players data is undefined ---

  it('uses fallback values for EventInfoBar when event data is undefined', () => {
    mockUseEvent.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    })

    render(<EventPage />)

    const infoBar = screen.getByTestId('event-info-bar')
    expect(infoBar).toHaveAttribute('data-event-name', '')
    expect(infoBar).toHaveAttribute('data-event-status', 'active')
  })

  it('passes empty array to player list when players data is undefined', () => {
    mockUseEventPlayers.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<EventPage />)

    const playerList = screen.getByTestId('player-list')
    expect(playerList).toHaveAttribute('data-player-count', '0')
  })

  it('passes empty array to admin controls players prop when players is undefined', () => {
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      passphrase: 'secret',
      setPassphrase: vi.fn(),
      clearPassphrase: vi.fn(),
    })
    mockUseEventPlayers.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<EventPage />)

    // Admin controls should still render (isAdmin=true, event not ended)
    expect(screen.getByTestId('admin-controls')).toBeInTheDocument()
  })

  // Note: handleJoined and handleLeaveConfirm no longer have defensive guards
  // because they are architecturally unreachable (the component returns early
  // before rendering the children that call these callbacks).

  // --- Combination states ---

  it('shows both admin form and leave button when admin is also a player', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')
    mockUseAdminAuth.mockReturnValue({
      isAdmin: true,
      passphrase: 'secret',
      setPassphrase: vi.fn(),
      clearPassphrase: vi.fn(),
    })

    render(<EventPage />)

    expect(screen.getByTestId('add-player-form')).toBeInTheDocument()
    expect(screen.getByTestId('leave-event-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
  })

  // --- Hook argument fallbacks (kills ?? '' → ?? 'Stryker' mutations) ---

  it('passes empty string fallback to hooks when eventId is undefined', () => {
    mockUseParams.mockReturnValue({})

    render(<EventPage />)

    expect(mockUseEvent).toHaveBeenCalledWith('')
    expect(mockUseEventPlayers).toHaveBeenCalledWith('')
    expect(mockUseEventChannel).toHaveBeenCalledWith('')
    expect(mockUseVisibilityRefetch).toHaveBeenCalledWith('')
    expect(mockUseAdminAuth).toHaveBeenCalledWith('')
    expect(mockUseDropPlayer).toHaveBeenCalledWith('')
    expect(mockUseTimer).toHaveBeenCalledWith('')
  })

  // --- justJoinedRef guard (kills BlockStatement, ConditionalExpression, BooleanLiteral, MethodExpression mutations) ---

  describe('justJoinedRef guard', () => {
    it('prevents clearing player identity when player has not yet appeared in list', async () => {
      const user = userEvent.setup()
      mockUseEventPlayers.mockReturnValue({
        data: defaultPlayers,
        isLoading: false,
      })

      render(<EventPage />)

      await user.click(screen.getByTestId('mock-join'))

      expect(mockClearPlayerId).not.toHaveBeenCalled()
      expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
    })

    it('continues to block clearing across multiple renders while player is pending', async () => {
      const user = userEvent.setup()
      mockUseEventPlayers.mockReturnValue({
        data: defaultPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      await user.click(screen.getByTestId('mock-join'))

      mockUseEventPlayers.mockReturnValue({
        data: [...defaultPlayers],
        isLoading: false,
      })
      rerender(<EventPage />)

      expect(mockClearPlayerId).not.toHaveBeenCalled()
      expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
    })

    it('resets after player confirmed in list, allowing clearing on subsequent removal', async () => {
      const user = userEvent.setup()
      mockUseEventPlayers.mockReturnValue({
        data: defaultPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      await user.click(screen.getByTestId('mock-join'))
      expect(mockClearPlayerId).not.toHaveBeenCalled()

      mockUseEventPlayers.mockReturnValue({
        data: playersIncludingNew,
        isLoading: false,
      })
      rerender(<EventPage />)
      expect(mockClearPlayerId).not.toHaveBeenCalled()

      mockUseEventPlayers.mockReturnValue({
        data: defaultPlayers,
        isLoading: false,
      })
      rerender(<EventPage />)

      expect(mockClearPlayerId).toHaveBeenCalledWith('evt1')
      expect(screen.getByTestId('join-form')).toBeInTheDocument()
    })
  })

  // --- Stored player verification with multiple players (kills some→every on line 71) ---

  it('does not clear stored player that exists among multiple players', () => {
    mockGetStoredPlayerId.mockReturnValue('p1')
    mockUseEventPlayers.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alice', status: 'active', event_id: 'evt1', created_at: '2024-01-01' },
        { id: 'p2', name: 'Bob', status: 'active', event_id: 'evt1', created_at: '2024-01-02' },
      ],
      isLoading: false,
    })

    render(<EventPage />)

    expect(mockClearPlayerId).not.toHaveBeenCalled()
  })

  // --- eventId dependency updates (kills [eventId] → [] mutations) ---

  describe('eventId dependency updates', () => {
    it('re-checks localStorage when eventId changes', () => {
      mockUseParams.mockReturnValue({ eventId: 'evt1' })
      mockGetStoredPlayerId.mockReturnValue(null)

      const { rerender } = render(<EventPage />)

      expect(screen.getByTestId('join-form')).toBeInTheDocument()

      mockUseParams.mockReturnValue({ eventId: 'evt2' })
      mockGetStoredPlayerId.mockReturnValue('p-stored')
      mockUseEvent.mockReturnValue({
        data: { id: 'evt2', name: 'Event 2', status: 'active', created_at: '2024-01-01' },
        isLoading: false,
        error: null,
      })
      mockUseEventPlayers.mockReturnValue({
        data: [{ id: 'p-stored', name: 'Stored', status: 'active', event_id: 'evt2', created_at: '2024-01-01' }],
        isLoading: false,
      })

      rerender(<EventPage />)

      expect(screen.queryByTestId('join-form')).not.toBeInTheDocument()
    })

    it('handleJoined uses current eventId after eventId change', async () => {
      const user = userEvent.setup()
      mockUseParams.mockReturnValue({ eventId: 'evt1' })

      const { rerender } = render(<EventPage />)

      mockUseParams.mockReturnValue({ eventId: 'evt2' })
      mockUseEvent.mockReturnValue({
        data: { id: 'evt2', name: 'Event 2', status: 'active', created_at: '2024-01-01' },
        isLoading: false,
        error: null,
      })
      mockUseEventPlayers.mockReturnValue({
        data: defaultPlayers,
        isLoading: false,
      })

      rerender(<EventPage />)

      await user.click(screen.getByTestId('mock-join'))

      expect(mockStorePlayerId).toHaveBeenCalledWith('evt2', 'p-new')
    })

  })

  // --- Highlight detection edge cases (kills added.size > 0 and cleanup mutations) ---

  describe('highlight detection edge cases', () => {
    it('does not start a timer when no new players are detected on rerender', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        { id: 'p1', name: 'Alice', status: 'active', event_id: 'evt1', created_at: '2024-01-01' },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender } = render(<EventPage />)

      mockUseEventPlayers.mockReturnValue({
        data: [...initialPlayers],
        isLoading: false,
      })
      rerender(<EventPage />)

      expect(vi.getTimerCount()).toBe(0)
    })

    it('cleanup clears the highlight timer on unmount', () => {
      vi.useFakeTimers()
      const initialPlayers: Player[] = [
        { id: 'p1', name: 'Alice', status: 'active', event_id: 'evt1', created_at: '2024-01-01' },
      ]
      mockUseEventPlayers.mockReturnValue({
        data: initialPlayers,
        isLoading: false,
      })

      const { rerender, unmount } = render(<EventPage />)

      mockUseEventPlayers.mockReturnValue({
        data: [
          ...initialPlayers,
          { id: 'p2', name: 'Bob', status: 'active', event_id: 'evt1', created_at: '2024-01-02' },
        ],
        isLoading: false,
      })
      rerender(<EventPage />)

      expect(vi.getTimerCount()).toBe(1)

      unmount()

      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
