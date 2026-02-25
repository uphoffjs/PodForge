import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventInfoBar } from './EventInfoBar'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('@/components/QRCodeDisplay', () => ({
  QRCodeDisplay: ({ eventId }: { eventId: string }) => (
    <div data-testid="qr-code" data-event-id={eventId} />
  ),
}))

// ---------------------------------------------------------------------------
// Clipboard mock helper
// ---------------------------------------------------------------------------
let originalClipboard: Clipboard

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  })
}

function restoreClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    writable: true,
    configurable: true,
  })
}

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------
const defaultProps = {
  eventId: 'evt1',
  eventName: 'Test Event',
  eventStatus: 'active' as const,
  activePlayerCount: 5,
  currentRoundNumber: 2,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('EventInfoBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    originalClipboard = navigator.clipboard
  })

  afterEach(() => {
    restoreClipboard()
  })

  it('renders event name', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.getByTestId('event-info-name')).toHaveTextContent('Test Event')
  })

  it('renders event status badge', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.getByTestId('event-info-status')).toHaveTextContent('active')
  })

  it('renders active player count', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.getByTestId('event-info-player-count')).toHaveTextContent('Players: 5')
  })

  it('renders round number when provided', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.getByTestId('event-info-round-number')).toHaveTextContent('Round: 2')
  })

  it('renders "No rounds yet" when currentRoundNumber is null', () => {
    render(<EventInfoBar {...defaultProps} currentRoundNumber={null} />)

    expect(screen.getByTestId('event-info-round-number')).toHaveTextContent('No rounds yet')
  })

  it('QR code is collapsed by default (QRCodeDisplay not rendered)', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
    expect(screen.queryByTestId('event-info-qr-section')).not.toBeInTheDocument()
    expect(screen.getByTestId('event-info-qr-toggle')).toHaveTextContent('Show QR Code')
  })

  it('clicking QR toggle expands QR section', async () => {
    const user = userEvent.setup()
    render(<EventInfoBar {...defaultProps} />)

    await user.click(screen.getByTestId('event-info-qr-toggle'))

    expect(screen.getByTestId('event-info-qr-section')).toBeInTheDocument()
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-qr-toggle')).toHaveTextContent('Hide QR Code')
  })

  it('clicking QR toggle again collapses QR section', async () => {
    const user = userEvent.setup()
    render(<EventInfoBar {...defaultProps} />)

    // Expand
    await user.click(screen.getByTestId('event-info-qr-toggle'))
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()

    // Collapse
    await user.click(screen.getByTestId('event-info-qr-toggle'))
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
    expect(screen.getByTestId('event-info-qr-toggle')).toHaveTextContent('Show QR Code')
  })

  it('copy button calls navigator.clipboard.writeText with correct URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)

    render(<EventInfoBar {...defaultProps} />)

    await user.click(screen.getByTestId('event-info-copy-btn'))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/event/evt1`
    )
    expect(mockToastSuccess).toHaveBeenCalledWith('Link copied!')
  })

  it('shows error toast when clipboard write fails', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
    mockClipboard(writeText)

    render(<EventInfoBar {...defaultProps} />)

    await user.click(screen.getByTestId('event-info-copy-btn'))

    expect(mockToastError).toHaveBeenCalledWith('Failed to copy link.')
  })

  it('renders share link input with correct URL', () => {
    render(<EventInfoBar {...defaultProps} />)

    const linkInput = screen.getByTestId('event-info-share-link')
    expect(linkInput).toHaveValue(`${window.location.origin}/event/evt1`)
  })

  it('renders all required data-testid attributes', () => {
    render(<EventInfoBar {...defaultProps} />)

    expect(screen.getByTestId('event-info-bar')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-name')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-status')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-player-count')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-round-number')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-qr-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-share-link')).toBeInTheDocument()
    expect(screen.getByTestId('event-info-copy-btn')).toBeInTheDocument()
  })

  it('renders ended status correctly', () => {
    render(<EventInfoBar {...defaultProps} eventStatus="ended" />)

    expect(screen.getByTestId('event-info-status')).toHaveTextContent('ended')
  })

  it('renders zero player count', () => {
    render(<EventInfoBar {...defaultProps} activePlayerCount={0} />)

    expect(screen.getByTestId('event-info-player-count')).toHaveTextContent('Players: 0')
  })
})
