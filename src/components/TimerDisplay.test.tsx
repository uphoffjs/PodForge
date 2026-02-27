import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerDisplay } from './TimerDisplay'
import type { RoundTimer } from '@/types/database'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const { mockUseCountdown, mockUseTimerNotification } = vi.hoisted(() => ({
  mockUseCountdown: vi.fn(),
  mockUseTimerNotification: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/useCountdown', () => ({
  useCountdown: (...args: unknown[]) => mockUseCountdown(...args),
}))

vi.mock('@/hooks/useTimerNotification', () => ({
  useTimerNotification: (...args: unknown[]) => mockUseTimerNotification(...args),
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
    paused_at: null,
    expires_at: '2026-01-01T00:50:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCountdown(overrides: Partial<{
  remainingSeconds: number
  display: string
  isOvertime: boolean
  isPaused: boolean
  isCancelled: boolean
  urgency: 'normal' | 'warning' | 'danger' | 'expired'
}> = {}) {
  return {
    remainingSeconds: 1200,
    display: '20:00',
    isOvertime: false,
    isPaused: false,
    isCancelled: false,
    urgency: 'normal' as const,
    ...overrides,
  }
}

const defaultNotification = {
  isSupported: true,
  permission: 'granted' as NotificationPermission | 'unsupported',
  requestPermission: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TimerDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCountdown.mockReturnValue(makeCountdown())
    mockUseTimerNotification.mockReturnValue({ ...defaultNotification })
  })

  it('returns null when countdown is null', () => {
    mockUseCountdown.mockReturnValue(null)

    const { container } = render(<TimerDisplay timer={makeTimer()} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders timer-display when countdown exists', () => {
    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-display')).toBeInTheDocument()
  })

  it('displays countdown.display in timer-countdown', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ display: '45:30' }))

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('45:30')
  })

  it('shows "PAUSED" status label when countdown.isPaused is true', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ isPaused: true }))

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-status')).toHaveTextContent('PAUSED')
  })

  it('shows "OVERTIME" status label when countdown.isOvertime is true', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ isOvertime: true, isPaused: false })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-status')).toHaveTextContent('OVERTIME')
  })

  it('shows "Round Timer" status label for normal countdown', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ isPaused: false, isOvertime: false })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-status')).toHaveTextContent('Round Timer')
  })

  it('applies normal urgency classes', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ urgency: 'normal' }))

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el.className).toContain('bg-surface-raised')
    expect(el.className).toContain('text-text-primary')
    expect(el.className).toContain('border-border')
  })

  it('applies warning urgency classes', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ urgency: 'warning' }))

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el.className).toContain('bg-yellow-900/30')
    expect(el.className).toContain('text-yellow-400')
    expect(el.className).toContain('border-yellow-700')
  })

  it('applies danger urgency classes', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ urgency: 'danger' }))

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el.className).toContain('bg-red-900/30')
    expect(el.className).toContain('text-red-400')
    expect(el.className).toContain('border-red-700')
  })

  it('applies expired urgency classes including animate-pulse', () => {
    mockUseCountdown.mockReturnValue(makeCountdown({ urgency: 'expired' }))

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el.className).toContain('bg-red-900/50')
    expect(el.className).toContain('text-red-300')
    expect(el.className).toContain('border-red-500')
    expect(el.className).toContain('animate-pulse')
  })

  it('shows notification prompt when isSupported and permission is default', () => {
    mockUseTimerNotification.mockReturnValue({
      isSupported: true,
      permission: 'default',
      requestPermission: vi.fn(),
    })

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-notification-prompt')).toBeInTheDocument()
    expect(screen.getByText('Get alerted when time is up')).toBeInTheDocument()
    expect(screen.getByTestId('timer-notification-enable-btn')).toBeInTheDocument()
  })

  it('shows "Notifications blocked" when isSupported and permission is denied', () => {
    mockUseTimerNotification.mockReturnValue({
      isSupported: true,
      permission: 'denied',
      requestPermission: vi.fn(),
    })

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByText('Notifications blocked')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-notification-prompt')).not.toBeInTheDocument()
  })

  it('hides notification UI when permission is granted', () => {
    mockUseTimerNotification.mockReturnValue({
      isSupported: true,
      permission: 'granted',
      requestPermission: vi.fn(),
    })

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.queryByTestId('timer-notification-prompt')).not.toBeInTheDocument()
    expect(screen.queryByText('Notifications blocked')).not.toBeInTheDocument()
  })

  it('hides notification UI when isSupported is false', () => {
    mockUseTimerNotification.mockReturnValue({
      isSupported: false,
      permission: 'default',
      requestPermission: vi.fn(),
    })

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.queryByTestId('timer-notification-prompt')).not.toBeInTheDocument()
    expect(screen.queryByText('Notifications blocked')).not.toBeInTheDocument()
  })

  it('calls requestPermission when Enable button is clicked', async () => {
    const user = userEvent.setup()
    const mockRequestPermission = vi.fn()
    mockUseTimerNotification.mockReturnValue({
      isSupported: true,
      permission: 'default',
      requestPermission: mockRequestPermission,
    })

    render(<TimerDisplay timer={makeTimer()} />)

    await user.click(screen.getByTestId('timer-notification-enable-btn'))

    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  })
})
