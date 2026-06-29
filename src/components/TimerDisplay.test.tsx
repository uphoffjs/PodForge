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
    overtime_seconds: 0,
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
  phase: 'main' | 'overtime' | 'countup' | 'not-started'
}> = {}) {
  return {
    remainingSeconds: 1200,
    display: '20:00',
    isOvertime: false,
    isPaused: false,
    isCancelled: false,
    urgency: 'normal' as const,
    phase: 'main' as const,
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

  it('shows "OVERTIME" status label when phase is overtime', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'overtime', isOvertime: true, isPaused: false })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-status')).toHaveTextContent('OVERTIME')
  })

  it('shows "ROUND TIMER" status label for normal main-phase countdown', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'main', isPaused: false, isOvertime: false })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    expect(screen.getByTestId('timer-status')).toHaveTextContent('ROUND TIMER')
  })

  // --- Phase-first band selection (Phase 9 UI-SPEC) ---

  it('main + normal: data-phase=main, ROUND TIMER, neutral band', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'main', urgency: 'normal' })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'main')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('ROUND TIMER')
    expect(el.className).toContain('bg-surface-raised')
  })

  it('main + warning: keeps yellow urgency band (no regression)', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'main', urgency: 'warning' })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'main')
    expect(el.className).toContain('bg-yellow-900/30')
    expect(el.className).toContain('text-yellow-400')
    expect(el.className).toContain('border-yellow-700')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('ROUND TIMER')
  })

  it('main + danger: keeps red urgency band (no regression)', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'main', urgency: 'danger' })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'main')
    expect(el.className).toContain('bg-red-900/30')
    expect(el.className).toContain('text-red-400')
    expect(el.className).toContain('border-red-700')
  })

  it('overtime: data-phase=overtime, OVERTIME label, accent band', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'overtime', urgency: 'danger', isOvertime: true })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'overtime')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('OVERTIME')
    expect(el.className).toContain('bg-accent/15')
    expect(el.className).toContain('text-accent-bright')
    expect(el.className).toContain('border-accent')
  })

  it('countup: data-phase=countup, OVERRUN label, pulsing red band', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'countup', urgency: 'expired', isOvertime: true })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'countup')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('OVERRUN')
    expect(el.className).toContain('bg-red-900/50')
    expect(el.className).toContain('text-red-300')
    expect(el.className).toContain('border-red-500')
    expect(el.className).toContain('animate-pulse')
  })

  it('not-started: data-phase=not-started, READY TO START, static 80:00', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'not-started', display: '80:00', urgency: 'normal' })
    )

    render(<TimerDisplay timer={makeTimer({ status: 'pending', duration_minutes: 80 })} />)

    const el = screen.getByTestId('timer-display')
    expect(el).toHaveAttribute('data-phase', 'not-started')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('READY TO START')
    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('80:00')
    expect(el.className).toContain('bg-surface-raised')
    expect(el.className).toContain('text-text-secondary')
    expect(el.className).toContain('border-border')
  })

  it('non-paused timer has no dim class and no stray fallback token', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'main', urgency: 'normal', isPaused: false })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(el.className).not.toContain('opacity-70')
    // The dimmed slot is empty when not paused: the class list must end on the
    // band's last token, never a stray fallback string.
    expect(el.className.replace(/\s+/g, ' ').trim()).toBe(
      'sticky top-0 z-40 w-full max-w-lg border rounded-xl p-4 text-center bg-surface-raised text-text-primary border-border'
    )
  })

  it('paused (overtime phase): PAUSED label, keeps accent band, adds opacity-70', () => {
    mockUseCountdown.mockReturnValue(
      makeCountdown({ phase: 'overtime', isPaused: true })
    )

    render(<TimerDisplay timer={makeTimer()} />)

    const el = screen.getByTestId('timer-display')
    expect(screen.getByTestId('timer-status')).toHaveTextContent('PAUSED')
    expect(el.className).toContain('bg-accent/15')
    expect(el.className).toContain('opacity-70')
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
