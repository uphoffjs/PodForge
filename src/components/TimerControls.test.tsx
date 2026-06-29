import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerControls } from './TimerControls'
import { INVALID_PASSPHRASE_RETRY_MESSAGE } from '@/lib/passphrase-error'
import type { RoundTimer } from '@/types/database'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const {
  mockPauseMutate,
  mockResumeMutate,
  mockExtendMutate,
  mockCancelMutate,
  mockStartMutate,
  mockPauseHook,
  mockResumeHook,
  mockExtendHook,
  mockCancelHook,
  mockStartHook,
} = vi.hoisted(() => {
  const mockPauseMutate = vi.fn()
  const mockResumeMutate = vi.fn()
  const mockExtendMutate = vi.fn()
  const mockCancelMutate = vi.fn()
  const mockStartMutate = vi.fn()
  return {
    mockPauseMutate,
    mockResumeMutate,
    mockExtendMutate,
    mockCancelMutate,
    mockStartMutate,
    mockPauseHook: vi.fn(() => ({ mutate: mockPauseMutate, isPending: false })),
    mockResumeHook: vi.fn(() => ({ mutate: mockResumeMutate, isPending: false })),
    mockExtendHook: vi.fn(() => ({ mutate: mockExtendMutate, isPending: false })),
    mockCancelHook: vi.fn(() => ({ mutate: mockCancelMutate, isPending: false })),
    mockStartHook: vi.fn(() => ({ mutate: mockStartMutate, isPending: false })),
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/usePauseTimer', () => ({
  usePauseTimer: () => mockPauseHook(),
}))

vi.mock('@/hooks/useResumeTimer', () => ({
  useResumeTimer: () => mockResumeHook(),
}))

vi.mock('@/hooks/useExtendTimer', () => ({
  useExtendTimer: () => mockExtendHook(),
}))

vi.mock('@/hooks/useCancelTimer', () => ({
  useCancelTimer: () => mockCancelHook(),
}))

vi.mock('@/hooks/useStartTimer', () => ({
  useStartTimer: () => mockStartHook(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTimer(overrides: Partial<RoundTimer> = {}): RoundTimer {
  return {
    id: 'timer-1',
    round_id: 'round-1',
    event_id: 'event-1',
    duration_minutes: 50,
    status: 'running',
    started_at: '2026-01-01T00:00:00Z',
    remaining_seconds: null,
    overtime_seconds: 0,
    paused_at: null,
    expires_at: '2026-01-01T00:50:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const defaultProps = {
  eventId: 'evt1',
  passphrase: 'secret123',
  timer: makeTimer(),
  onPassphraseNeeded: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TimerControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPauseHook.mockReturnValue({ mutate: mockPauseMutate, isPending: false })
    mockResumeHook.mockReturnValue({ mutate: mockResumeMutate, isPending: false })
    mockExtendHook.mockReturnValue({ mutate: mockExtendMutate, isPending: false })
    mockCancelHook.mockReturnValue({ mutate: mockCancelMutate, isPending: false })
    mockStartHook.mockReturnValue({ mutate: mockStartMutate, isPending: false })
  })

  it('returns null when timer status is cancelled', () => {
    const { container } = render(
      <TimerControls {...defaultProps} timer={makeTimer({ status: 'cancelled' })} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('shows Pause button when timer status is running', () => {
    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'running' })} />)

    expect(screen.getByTestId('timer-pause-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-resume-btn')).not.toBeInTheDocument()
  })

  it('shows Resume button when timer status is paused', () => {
    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'paused' })} />)

    expect(screen.getByTestId('timer-resume-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-pause-btn')).not.toBeInTheDocument()
  })

  it('calls onPassphraseNeeded when Pause is clicked with empty passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <TimerControls
        {...defaultProps}
        passphrase=""
        onPassphraseNeeded={onPassphraseNeeded}
        timer={makeTimer({ status: 'running' })}
      />
    )

    await user.click(screen.getByTestId('timer-pause-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockPauseMutate).not.toHaveBeenCalled()
  })

  it('calls onPassphraseNeeded when Resume is clicked with empty passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <TimerControls
        {...defaultProps}
        passphrase=""
        onPassphraseNeeded={onPassphraseNeeded}
        timer={makeTimer({ status: 'paused' })}
      />
    )

    await user.click(screen.getByTestId('timer-resume-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockResumeMutate).not.toHaveBeenCalled()
  })

  it('calls onPassphraseNeeded when Extend is clicked with empty passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <TimerControls
        {...defaultProps}
        passphrase=""
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('timer-extend-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockExtendMutate).not.toHaveBeenCalled()
  })

  it('calls onPassphraseNeeded when Cancel is clicked with empty passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <TimerControls
        {...defaultProps}
        passphrase=""
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('timer-cancel-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockCancelMutate).not.toHaveBeenCalled()
  })

  it('calls pauseTimer.mutate with passphrase when Pause is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TimerControls {...defaultProps} timer={makeTimer({ status: 'running' })} />
    )

    await user.click(screen.getByTestId('timer-pause-btn'))

    expect(mockPauseMutate).toHaveBeenCalledTimes(1)
    expect(mockPauseMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it('calls resumeTimer.mutate with passphrase when Resume is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TimerControls {...defaultProps} timer={makeTimer({ status: 'paused' })} />
    )

    await user.click(screen.getByTestId('timer-resume-btn'))

    expect(mockResumeMutate).toHaveBeenCalledTimes(1)
    expect(mockResumeMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it('calls extendTimer.mutate with passphrase when Extend is clicked', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} />)

    await user.click(screen.getByTestId('timer-extend-btn'))

    expect(mockExtendMutate).toHaveBeenCalledTimes(1)
    expect(mockExtendMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it('opens ConfirmDialog when Cancel is clicked with passphrase', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} />)

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('timer-cancel-btn'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('calls cancelTimer.mutate when confirm dialog is confirmed', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockCancelMutate).toHaveBeenCalledTimes(1)
    expect(mockCancelMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )
  })

  it('dismisses cancel dialog without calling mutate when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} />)

    // Open the dialog
    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    // Dismiss the dialog
    await user.click(screen.getByTestId('confirm-dialog-cancel-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockCancelMutate).not.toHaveBeenCalled()
  })

  it('disables Pause button when pauseTimer.isPending is true', () => {
    mockPauseHook.mockReturnValue({ mutate: mockPauseMutate, isPending: true })

    render(
      <TimerControls {...defaultProps} timer={makeTimer({ status: 'running' })} />
    )

    expect(screen.getByTestId('timer-pause-btn')).toBeDisabled()
  })

  it('disables Extend button when extendTimer.isPending is true', () => {
    mockExtendHook.mockReturnValue({ mutate: mockExtendMutate, isPending: true })

    render(<TimerControls {...defaultProps} />)

    expect(screen.getByTestId('timer-extend-btn')).toBeDisabled()
  })

  it('disables Cancel button when cancelTimer.isPending is true', () => {
    mockCancelHook.mockReturnValue({ mutate: mockCancelMutate, isPending: true })

    render(<TimerControls {...defaultProps} />)

    expect(screen.getByTestId('timer-cancel-btn')).toBeDisabled()
  })

  it('onSuccess callback closes cancel confirm dialog', async () => {
    const user = userEvent.setup()
    mockCancelMutate.mockImplementation((_params: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.()
    })

    render(<TimerControls {...defaultProps} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('onError callback closes cancel confirm dialog', async () => {
    const user = userEvent.setup()
    mockCancelMutate.mockImplementation((_params: unknown, options: { onError?: () => void }) => {
      options.onError?.()
    })

    render(<TimerControls {...defaultProps} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('handleCancelConfirm returns early when passphrase is empty', async () => {
    const user = userEvent.setup()

    const { rerender } = render(<TimerControls {...defaultProps} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    // Rerender with empty passphrase
    rerender(<TimerControls {...defaultProps} passphrase="" />)

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockCancelMutate).not.toHaveBeenCalled()
  })

  // --- Passphrase feedback loop (invalid passphrase re-opens modal) ---

  it('Pause onError re-opens passphrase modal on invalid passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()
    mockPauseMutate.mockImplementation(
      (_params: unknown, options: { onError?: (e: unknown) => void }) => {
        options.onError?.(new Error('invalid passphrase provided'))
      }
    )

    render(
      <TimerControls
        {...defaultProps}
        timer={makeTimer({ status: 'running' })}
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('timer-pause-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(onPassphraseNeeded).toHaveBeenCalledWith(INVALID_PASSPHRASE_RETRY_MESSAGE)
  })

  it('Pause onError does NOT re-open modal on a non-passphrase error', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()
    mockPauseMutate.mockImplementation(
      (_params: unknown, options: { onError?: (e: unknown) => void }) => {
        options.onError?.(new Error('network down'))
      }
    )

    render(
      <TimerControls
        {...defaultProps}
        timer={makeTimer({ status: 'running' })}
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('timer-pause-btn'))

    expect(onPassphraseNeeded).not.toHaveBeenCalled()
  })

  it('Cancel timer onError re-opens passphrase modal on invalid passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()
    mockCancelMutate.mockImplementation(
      (_params: unknown, options: { onError?: (e: unknown) => void }) => {
        options.onError?.(new Error('invalid passphrase provided'))
      }
    )

    render(
      <TimerControls {...defaultProps} onPassphraseNeeded={onPassphraseNeeded} />
    )

    await user.click(screen.getByTestId('timer-cancel-btn'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(onPassphraseNeeded).toHaveBeenCalledWith(INVALID_PASSPHRASE_RETRY_MESSAGE)
    // Confirm dialog also closes on error
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  // --- Pending (not-started) branch: Start Timer + Cancel ---

  it('renders Start Timer and Cancel (not pause/resume/+5) when timer is pending', () => {
    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'pending' })} />)

    const startBtn = screen.getByTestId('timer-start-btn')
    expect(startBtn).toBeInTheDocument()
    expect(startBtn).toHaveTextContent('Start Timer')
    expect(startBtn.className).toContain('bg-accent')
    expect(screen.getByTestId('timer-cancel-btn')).toBeInTheDocument()

    expect(screen.queryByTestId('timer-pause-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timer-resume-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timer-extend-btn')).not.toBeInTheDocument()
  })

  it('calls startTimer.mutate with passphrase when Start is clicked', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'pending' })} />)

    await user.click(screen.getByTestId('timer-start-btn'))

    expect(mockStartMutate).toHaveBeenCalledTimes(1)
    expect(mockStartMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it('calls onPassphraseNeeded when Start is clicked with empty passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <TimerControls
        {...defaultProps}
        passphrase=""
        onPassphraseNeeded={onPassphraseNeeded}
        timer={makeTimer({ status: 'pending' })}
      />
    )

    await user.click(screen.getByTestId('timer-start-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockStartMutate).not.toHaveBeenCalled()
  })

  it('disables Start button when startTimer.isPending is true', () => {
    mockStartHook.mockReturnValue({ mutate: mockStartMutate, isPending: true })

    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'pending' })} />)

    expect(screen.getByTestId('timer-start-btn')).toBeDisabled()
  })

  it('Cancel on a pending timer opens ConfirmDialog and confirm calls cancelTimer.mutate', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'pending' })} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockCancelMutate).toHaveBeenCalledTimes(1)
    expect(mockCancelMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )
  })

  it('dismissing the pending Cancel dialog closes it without calling mutate', async () => {
    const user = userEvent.setup()

    render(<TimerControls {...defaultProps} timer={makeTimer({ status: 'pending' })} />)

    await user.click(screen.getByTestId('timer-cancel-btn'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-cancel-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockCancelMutate).not.toHaveBeenCalled()
  })

  it('Start onError re-opens passphrase modal on invalid passphrase', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()
    mockStartMutate.mockImplementation(
      (_params: unknown, options: { onError?: (e: unknown) => void }) => {
        options.onError?.(new Error('invalid passphrase provided'))
      }
    )

    render(
      <TimerControls
        {...defaultProps}
        timer={makeTimer({ status: 'pending' })}
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('timer-start-btn'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(onPassphraseNeeded).toHaveBeenCalledWith(INVALID_PASSPHRASE_RETRY_MESSAGE)
  })
})
