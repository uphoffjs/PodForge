import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateEventModal } from './CreateEventModal'

const { mockMutate, mockNavigate, mockToastSuccess } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

let hookState: {
  mutate: typeof mockMutate
  isPending: boolean
}

vi.mock('@/hooks/useCreateEvent', () => ({
  useCreateEvent: () => hookState,
}))

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: vi.fn() },
}))

describe('CreateEventModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    hookState = {
      mutate: mockMutate,
      isPending: false,
    }
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <CreateEventModal isOpen={false} onClose={vi.fn()} />
    )

    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('create-event-modal')).not.toBeInTheDocument()
  })

  it('renders modal with heading, inputs, and submit button when open', () => {
    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByTestId('create-event-modal')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument()
    expect(screen.getByTestId('create-event-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('create-event-passphrase-input')).toBeInTheDocument()
    expect(screen.getByTestId('create-event-submit-btn')).toHaveTextContent('Create Event')
    expect(screen.getByTestId('create-event-close-btn')).toBeInTheDocument()
  })

  it('close button calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CreateEventModal isOpen={true} onClose={onClose} />)

    await user.click(screen.getByTestId('create-event-close-btn'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('overlay click calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CreateEventModal isOpen={true} onClose={onClose} />)

    await user.click(screen.getByTestId('create-event-modal'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('inner content click does NOT call onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CreateEventModal isOpen={true} onClose={onClose} />)

    // Click on the "Event Name" label inside the inner content div
    await user.click(screen.getByText('Event Name'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls mutation with eventName and passphrase on submit', async () => {
    const user = userEvent.setup()

    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    await user.type(screen.getByTestId('create-event-name-input'), 'Friday Night Commander')
    await user.type(screen.getByTestId('create-event-passphrase-input'), 'secret123')
    await user.click(screen.getByTestId('create-event-submit-btn'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Friday Night Commander', passphrase: 'secret123' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    )
  })

  it('on success: stores passphrase in sessionStorage with correct key', async () => {
    const user = userEvent.setup()

    mockMutate.mockImplementation(
      (_params: { name: string; passphrase: string }, options: { onSuccess: (eventId: string) => void }) => {
        options.onSuccess('evt-abc-123')
      }
    )

    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    await user.type(screen.getByTestId('create-event-name-input'), 'Test Event')
    await user.type(screen.getByTestId('create-event-passphrase-input'), 'mypass')
    await user.click(screen.getByTestId('create-event-submit-btn'))

    expect(sessionStorage.getItem('podforge_admin_evt-abc-123')).toBe('mypass')
  })

  it('on success: calls toast.success', async () => {
    const user = userEvent.setup()

    mockMutate.mockImplementation(
      (_params: { name: string; passphrase: string }, options: { onSuccess: (eventId: string) => void }) => {
        options.onSuccess('evt-abc-123')
      }
    )

    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    await user.type(screen.getByTestId('create-event-name-input'), 'Test Event')
    await user.type(screen.getByTestId('create-event-passphrase-input'), 'mypass')
    await user.click(screen.getByTestId('create-event-submit-btn'))

    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Event created!')
  })

  it('on success: navigates to /event/{eventId}', async () => {
    const user = userEvent.setup()

    mockMutate.mockImplementation(
      (_params: { name: string; passphrase: string }, options: { onSuccess: (eventId: string) => void }) => {
        options.onSuccess('evt-abc-123')
      }
    )

    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    await user.type(screen.getByTestId('create-event-name-input'), 'Test Event')
    await user.type(screen.getByTestId('create-event-passphrase-input'), 'mypass')
    await user.click(screen.getByTestId('create-event-submit-btn'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/event/evt-abc-123')
  })

  it('shows "Creating..." and disables button when isPending', () => {
    hookState.isPending = true

    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    const button = screen.getByTestId('create-event-submit-btn')
    expect(button).toHaveTextContent('Creating...')
    expect(button).toBeDisabled()
  })

  it('shows "Create Event" and enables button when not isPending', () => {
    render(<CreateEventModal isOpen={true} onClose={vi.fn()} />)

    const button = screen.getByTestId('create-event-submit-btn')
    expect(button).toHaveTextContent('Create Event')
    expect(button).not.toBeDisabled()
  })
})
