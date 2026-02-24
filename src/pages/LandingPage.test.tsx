import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingPage } from './LandingPage'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/components/CreateEventModal', () => ({
  CreateEventModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean
    onClose: () => void
  }) =>
    isOpen ? (
      <div data-testid="create-event-modal">
        <button onClick={onClose} data-testid="mock-close">
          Close
        </button>
      </div>
    ) : null,
}))

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading "PodForge" and tagline', () => {
    render(<LandingPage />)

    expect(screen.getByText('PodForge')).toBeInTheDocument()
    expect(screen.getByText('Forge your pods in seconds')).toBeInTheDocument()
  })

  it('renders create event button', () => {
    render(<LandingPage />)

    const button = screen.getByTestId('landing-create-event-btn')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Create Event')
  })

  it('join button is disabled when input is empty', () => {
    render(<LandingPage />)

    expect(screen.getByTestId('landing-join-btn')).toBeDisabled()
  })

  it('join button is enabled when input has text', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    await user.type(screen.getByTestId('landing-join-input'), 'abc-123')

    expect(screen.getByTestId('landing-join-btn')).toBeEnabled()
  })

  it('join button remains disabled when input is only whitespace', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    await user.type(screen.getByTestId('landing-join-input'), '   ')

    expect(screen.getByTestId('landing-join-btn')).toBeDisabled()
  })

  it('create event button opens the modal', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    expect(screen.queryByTestId('create-event-modal')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('landing-create-event-btn'))

    expect(screen.getByTestId('create-event-modal')).toBeInTheDocument()
  })

  it('modal can be closed', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    await user.click(screen.getByTestId('landing-create-event-btn'))
    expect(screen.getByTestId('create-event-modal')).toBeInTheDocument()

    await user.click(screen.getByTestId('mock-close'))
    expect(screen.queryByTestId('create-event-modal')).not.toBeInTheDocument()
  })

  describe('extractEventId via join navigation', () => {
    it('navigates with bare UUID', async () => {
      const user = userEvent.setup()
      render(<LandingPage />)

      await user.type(screen.getByTestId('landing-join-input'), 'abc-123')
      await user.click(screen.getByTestId('landing-join-btn'))

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/event/abc-123')
    })

    it('extracts event ID from full URL with /event/ path', async () => {
      const user = userEvent.setup()
      render(<LandingPage />)

      await user.type(
        screen.getByTestId('landing-join-input'),
        'https://podforge.com/event/abc-123'
      )
      await user.click(screen.getByTestId('landing-join-btn'))

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/event/abc-123')
    })

    it('extracts event ID from relative path /event/abc-123', async () => {
      const user = userEvent.setup()
      render(<LandingPage />)

      await user.type(
        screen.getByTestId('landing-join-input'),
        '/event/abc-123'
      )
      await user.click(screen.getByTestId('landing-join-btn'))

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/event/abc-123')
    })

    it('treats URL without /event/ path as bare ID', async () => {
      const user = userEvent.setup()
      render(<LandingPage />)

      await user.type(
        screen.getByTestId('landing-join-input'),
        'https://example.com/other'
      )
      await user.click(screen.getByTestId('landing-join-btn'))

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith(
        '/event/https://example.com/other'
      )
    })

    it('trims whitespace from input before navigating', async () => {
      const user = userEvent.setup()
      render(<LandingPage />)

      await user.type(
        screen.getByTestId('landing-join-input'),
        '  abc-123  '
      )
      await user.click(screen.getByTestId('landing-join-btn'))

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/event/abc-123')
    })

    it('does not navigate when input is empty (button is disabled)', () => {
      render(<LandingPage />)

      const joinBtn = screen.getByTestId('landing-join-btn')
      expect(joinBtn).toBeDisabled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('does not navigate when form is submitted with empty input via programmatic submit', () => {
      render(<LandingPage />)

      // Submit form directly (bypasses disabled button)
      fireEvent.submit(screen.getByTestId('landing-join-input'))

      // extractEventId returns '' for empty input; if(eventId) should block navigate
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
