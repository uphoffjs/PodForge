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

// Mock hooks - configurable
const mockMutate = vi.fn()
const mockEndMutate = vi.fn()

let mockGenerateRoundIsPending = false
vi.mock('@/hooks/useGenerateRound', () => ({
  useGenerateRound: () => ({ mutate: mockMutate, isPending: mockGenerateRoundIsPending }),
}))

let mockEndEventIsPending = false
vi.mock('@/hooks/useEndEvent', () => ({
  useEndEvent: () => ({ mutate: mockEndMutate, isPending: mockEndEventIsPending }),
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
    mockGenerateRoundIsPending = false
    mockEndEventIsPending = false
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

  it('handleGenerateRound returns early when event is ended (defensive guard)', async () => {
    // Render with isEventEnded=false first (buttons are enabled)
    const wrapper = createWrapper()
    const { rerender } = render(
      <AdminControls {...defaultProps} isEventEnded={false} />,
      { wrapper }
    )

    // Now rerender with isEventEnded=true -- buttons become disabled,
    // but the timer duration section is hidden. The generate button is still in DOM.
    rerender(<AdminControls {...defaultProps} isEventEnded={true} />)

    // Use fireEvent which doesn't respect disabled in testing-library
    const generateBtn = screen.getByTestId('generate-round-btn')
    // Workaround: directly invoke onClick from React's internal props
    const reactPropsKey = Object.keys(generateBtn).find(k => k.startsWith('__reactProps'))
    if (reactPropsKey) {
      const onClick = (generateBtn as unknown as Record<string, unknown>)[reactPropsKey] as { onClick?: () => void }
      onClick?.onClick?.()
    }

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

  // --- End Event button ---

  it('calls onPassphraseNeeded when clicking End Event with null passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <AdminControls {...defaultProps} passphrase={null} onPassphraseNeeded={onPassphraseNeeded} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('end-event-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockEndMutate).not.toHaveBeenCalled()
  })

  it('handleEndEvent returns early when event is ended (defensive guard)', () => {
    const onPassphraseNeeded = vi.fn()

    render(
      <AdminControls {...defaultProps} isEventEnded={true} onPassphraseNeeded={onPassphraseNeeded} />,
      { wrapper: createWrapper() }
    )

    const btn = screen.getByTestId('end-event-btn')
    // Directly invoke React's onClick handler bypassing disabled check
    const reactPropsKey = Object.keys(btn).find(k => k.startsWith('__reactProps'))
    if (reactPropsKey) {
      const props = (btn as unknown as Record<string, unknown>)[reactPropsKey] as { onClick?: () => void }
      props?.onClick?.()
    }

    expect(onPassphraseNeeded).not.toHaveBeenCalled()
    expect(mockEndMutate).not.toHaveBeenCalled()
  })

  it('opens ConfirmDialog when clicking End Event with valid passphrase', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('end-event-btn'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  // --- End Event confirm flow ---

  it('calls endEvent.mutate on confirm with passphrase', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('end-event-btn'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockEndMutate).toHaveBeenCalledTimes(1)
    expect(mockEndMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )
  })

  it('endEvent onSuccess closes the confirm dialog', async () => {
    const user = userEvent.setup()
    mockEndMutate.mockImplementation(
      (_params: unknown, options: { onSuccess?: () => void }) => {
        options.onSuccess?.()
      }
    )

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('end-event-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('endEvent onError closes the confirm dialog', async () => {
    const user = userEvent.setup()
    mockEndMutate.mockImplementation(
      (_params: unknown, options: { onError?: () => void }) => {
        options.onError?.()
      }
    )

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('end-event-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('handleEndEventConfirm returns early when passphrase becomes null', async () => {
    const user = userEvent.setup()
    const wrapper = createWrapper()

    const { rerender } = render(
      <AdminControls {...defaultProps} />,
      { wrapper }
    )

    // Open dialog
    await user.click(screen.getByTestId('end-event-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    // Rerender with null passphrase (simulate race condition)
    rerender(<AdminControls {...defaultProps} passphrase={null} />)

    // Click confirm - should bail out early
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockEndMutate).not.toHaveBeenCalled()
  })

  it('cancel button closes the end event confirm dialog', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('end-event-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-cancel-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  // --- Timer duration picker ---

  it('renders timer duration buttons when event is not ended', () => {
    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('timer-duration-60')).toBeInTheDocument()
    expect(screen.getByTestId('timer-duration-90')).toBeInTheDocument()
    expect(screen.getByTestId('timer-duration-120')).toBeInTheDocument()
  })

  it('hides timer duration buttons when event is ended', () => {
    render(
      <AdminControls {...defaultProps} isEventEnded={true} />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByTestId('timer-duration-60')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timer-duration-90')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timer-duration-120')).not.toBeInTheDocument()
  })

  it('clicking a duration button selects it', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    const btn60 = screen.getByTestId('timer-duration-60')
    expect(btn60.className).toContain('bg-surface')

    await user.click(btn60)

    expect(btn60.className).toContain('bg-accent')
  })

  it('clicking the same duration button again deselects it (toggle)', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    const btn60 = screen.getByTestId('timer-duration-60')

    await user.click(btn60)
    expect(btn60.className).toContain('bg-accent')

    await user.click(btn60)
    expect(btn60.className).toContain('bg-surface')
  })

  it('passes selected duration to generateRound.mutate as timerDurationMinutes', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [{ playerIds: ['p1', 'p2', 'p3', 'p4'], isBye: false }], warnings: [] })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('timer-duration-90'))
    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ timerDurationMinutes: 90 }),
      expect.any(Object)
    )
  })

  it('passes undefined timerDurationMinutes when no duration selected', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ timerDurationMinutes: undefined }),
      expect.any(Object)
    )
  })

  // --- Generate round success/error callbacks ---

  it('onSuccess callback shows toast, resets isGenerating, and resets selectedDuration', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockRoundsData = [
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })
    mockMutate.mockImplementation(
      (_params: unknown, options: { onSuccess?: () => void }) => {
        options.onSuccess?.()
      }
    )

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    // Select a duration first
    await user.click(screen.getByTestId('timer-duration-60'))

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.success).toHaveBeenCalledWith('Round 2 generated!')
    // Duration should be reset (back to unselected style)
    expect(screen.getByTestId('timer-duration-60').className).toContain('bg-surface')
  })

  it('onError callback resets isGenerating', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })
    mockMutate.mockImplementation(
      (_params: unknown, options: { onError?: () => void }) => {
        options.onError?.()
      }
    )

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    // After error, button should go back to normal (not "Generating...")
    expect(screen.getByTestId('generate-round-btn')).toHaveTextContent('Generate Next Round')
  })

  it('generatePods throwing shows toast.error with the error message', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockGeneratePods.mockImplementation(() => {
      throw new Error('Not enough players')
    })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.error).toHaveBeenCalledWith('Not enough players')
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('algorithm warnings are shown via toast.warning', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({
      assignments: [],
      warnings: ['Some players will be repeated opponents'],
    })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.warning).toHaveBeenCalledWith('Some players will be repeated opponents')
  })

  // --- Edge case: generatePods throws non-Error ---

  it('generatePods throwing a non-Error does not call toast.error', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockGeneratePods.mockImplementation(() => {
      throw 'string error'  
    })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.error).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  // --- Edge case: buildRoundHistoryFromData with missing pods for a round ---

  it('handles round with no pods in the pods map (fallback to empty array)', async () => {
    const user = userEvent.setup()

    mockRoundsData = [
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]
    // allPods is defined but has no pods for round r1
    mockAllPodsData = []

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, previousRounds] = mockGeneratePods.mock.calls[0]
    expect(previousRounds).toHaveLength(1)
    expect(previousRounds[0].pods).toHaveLength(0) // empty because no pods matched r1
  })

  // --- isPending state ---

  it('filters out dropped players from generatePods call', async () => {
    const user = userEvent.setup()
    const playersWithDropped: Player[] = [
      ...mockPlayers,
      { id: 'p9', event_id: 'evt1', name: 'Igor', status: 'dropped', created_at: '2026-01-01T00:00:00Z' },
    ]
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })

    render(
      <AdminControls {...defaultProps} players={playersWithDropped} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [activePlayers] = mockGeneratePods.mock.calls[0]
    expect(activePlayers).toHaveLength(8)
    expect(activePlayers.every((p: { id: string }) => p.id !== 'p9')).toBe(true)
  })

  it('buildRoundHistoryFromData preserves isBye flag', async () => {
    const user = userEvent.setup()

    mockRoundsData = [
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]

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
        id: 'pod-r1-bye', round_id: 'r1', pod_number: 2, is_bye: true,
        pod_players: [
          { id: 'pp5', pod_id: 'pod-r1-bye', player_id: 'p5', seat_number: null, players: { id: 'p5', event_id: 'evt1', name: 'Eve', status: 'active', created_at: '' } },
        ],
      },
    ]

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, previousRounds] = mockGeneratePods.mock.calls[0]
    expect(previousRounds).toHaveLength(1)
    expect(previousRounds[0].pods[0].isBye).toBe(false)
    expect(previousRounds[0].pods[1].isBye).toBe(true)
  })

  it('displays "No rounds yet" when rounds is undefined', () => {
    mockRoundsData = undefined

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('No rounds yet')).toBeInTheDocument()
  })

  it('displays "Round 1" when exactly 1 round exists', () => {
    mockRoundsData = [
      { id: 'r1', event_id: 'evt1', round_number: 1, created_at: '2026-01-01T00:00:00Z' },
    ]

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('Round 1')).toBeInTheDocument()
  })

  it('generate button shows "Generating..." immediately after click (local isGenerating state)', async () => {
    const user = userEvent.setup()
    // Make mutate a no-op (never calls onSuccess/onError)
    mockMutate.mockImplementation(() => {})
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    // Button should show Generating... from local isGenerating state
    expect(screen.getByTestId('generate-round-btn')).toHaveTextContent('Generating...')
  })

  it('shows "Generating..." text with Loader icon when isPending', () => {
    mockGenerateRoundIsPending = true

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('generate-round-btn')).toHaveTextContent('Generating...')
  })

  it('shows "Ending..." text when endEvent.isPending', () => {
    mockEndEventIsPending = true

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('end-event-btn')).toHaveTextContent('Ending...')
  })

  // --- Allow pods of 3 checkbox ---

  it('renders pods-of-3 checkbox when event is not ended', () => {
    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('pods-of-3-checkbox')).toBeInTheDocument()
  })

  it('hides pods-of-3 checkbox when event is ended', () => {
    render(
      <AdminControls {...defaultProps} isEventEnded={true} />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByTestId('pods-of-3-checkbox')).not.toBeInTheDocument()
  })

  it('clicking pods-of-3 checkbox toggles its checked state', async () => {
    const user = userEvent.setup()

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    const checkbox = screen.getByTestId('pods-of-3-checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    await user.click(checkbox)
    expect(checkbox.checked).toBe(true)

    await user.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('passes allowPodsOf3=true to generatePods when checkbox is checked', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('pods-of-3-checkbox'))
    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, , allowPodsOf3] = mockGeneratePods.mock.calls[0]
    expect(allowPodsOf3).toBe(true)
  })

  it('passes allowPodsOf3=false to generatePods when checkbox is unchecked', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('generate-round-btn'))

    expect(mockGeneratePods).toHaveBeenCalledTimes(1)
    const [, , allowPodsOf3] = mockGeneratePods.mock.calls[0]
    expect(allowPodsOf3).toBe(false)
  })

  it('resets pods-of-3 checkbox to unchecked after successful generation', async () => {
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({ assignments: [], warnings: [] })
    mockMutate.mockImplementation(
      (_params: unknown, options: { onSuccess?: () => void }) => {
        options.onSuccess?.()
      }
    )

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    // Check the checkbox
    const checkbox = screen.getByTestId('pods-of-3-checkbox') as HTMLInputElement
    await user.click(checkbox)
    expect(checkbox.checked).toBe(true)

    // Generate round
    await user.click(screen.getByTestId('generate-round-btn'))

    // Checkbox should be reset to unchecked
    expect(checkbox.checked).toBe(false)
  })

  it('error handling still works with pods-of-3 checkbox enabled', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockGeneratePods.mockImplementation(() => {
      throw new Error('Not enough players for pods of 3')
    })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('pods-of-3-checkbox'))
    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.error).toHaveBeenCalledWith('Not enough players for pods of 3')
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('algorithm warnings display via toast.warning with pods-of-3 enabled', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockGeneratePods.mockReturnValue({
      assignments: [],
      warnings: ['5 players: 1 pod of 4 + 1 bye (no valid 3-player split)'],
    })

    render(<AdminControls {...defaultProps} />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('pods-of-3-checkbox'))
    await user.click(screen.getByTestId('generate-round-btn'))

    expect(toast.warning).toHaveBeenCalledWith('5 players: 1 pod of 4 + 1 bye (no valid 3-player split)')
  })
})
