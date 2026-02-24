import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinEventForm } from './JoinEventForm'

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}))

let hookState: {
  mutate: typeof mockMutate
  isPending: boolean
  isError: boolean
  error: unknown
}

vi.mock('@/hooks/useJoinEvent', () => ({
  useJoinEvent: () => hookState,
}))

describe('JoinEventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    }
  })

  it('renders form with input, label, and submit button', () => {
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-form')).toBeInTheDocument()
    expect(screen.getByTestId('join-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('join-submit-btn')).toHaveTextContent('Join Event')
    expect(screen.getByLabelText('Enter your name to join')).toBeInTheDocument()
  })

  it('shows validation error for name shorter than 2 characters', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    await user.type(screen.getByTestId('join-name-input'), 'A')
    await user.click(screen.getByTestId('join-submit-btn'))

    expect(screen.getByTestId('join-validation-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('shows validation error for empty submit', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    await user.click(screen.getByTestId('join-submit-btn'))

    expect(screen.getByTestId('join-validation-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('trims whitespace before validation - "  a  " is too short', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    await user.type(screen.getByTestId('join-name-input'), '  a  ')
    await user.click(screen.getByTestId('join-submit-btn'))

    expect(screen.getByTestId('join-validation-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('trims whitespace before validation - " ab " is valid', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    await user.type(screen.getByTestId('join-name-input'), ' ab ')
    await user.click(screen.getByTestId('join-submit-btn'))

    expect(screen.queryByTestId('join-validation-error')).not.toBeInTheDocument()
    expect(mockMutate).toHaveBeenCalledWith('ab', expect.objectContaining({
      onSuccess: expect.any(Function),
    }))
  })

  it('calls joinMutation.mutate with trimmed name on valid submit', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    await user.type(screen.getByTestId('join-name-input'), '  Alice  ')
    await user.click(screen.getByTestId('join-submit-btn'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith('Alice', expect.objectContaining({
      onSuccess: expect.any(Function),
    }))
  })

  it('shows "Joining..." and disables button when isPending', () => {
    hookState.isPending = true

    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    const button = screen.getByTestId('join-submit-btn')
    expect(button).toHaveTextContent('Joining...')
    expect(button).toBeDisabled()
  })

  it('shows duplicate name error when isError with code 23505', () => {
    hookState.isError = true
    hookState.error = { code: '23505', message: 'duplicate key' }

    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-mutation-error')).toHaveTextContent(
      'That name is already taken. Try another!'
    )
  })

  it('shows generic error when isError with other code', () => {
    hookState.isError = true
    hookState.error = { code: '500', message: 'server error' }

    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-mutation-error')).toHaveTextContent(
      'Failed to join. Please try again.'
    )
  })

  it('shows generic error when error is null (optional chaining safety)', () => {
    hookState.isError = true
    hookState.error = null

    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-mutation-error')).toHaveTextContent(
      'Failed to join. Please try again.'
    )
  })

  it('shows generic error when isError with no code property', () => {
    hookState.isError = true
    hookState.error = { message: 'unknown error' }

    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-mutation-error')).toHaveTextContent(
      'Failed to join. Please try again.'
    )
  })

  it('calls onJoined callback when mutation succeeds', async () => {
    const user = userEvent.setup()
    const onJoined = vi.fn()

    mockMutate.mockImplementation((_name: string, options: { onSuccess: (data: { id: string }) => void }) => {
      options.onSuccess({ id: 'player-123' })
    })

    render(<JoinEventForm eventId="evt1" onJoined={onJoined} />)

    await user.type(screen.getByTestId('join-name-input'), 'Alice')
    await user.click(screen.getByTestId('join-submit-btn'))

    expect(onJoined).toHaveBeenCalledTimes(1)
    expect(onJoined).toHaveBeenCalledWith('player-123')
  })

  it('clears validation error on valid resubmit', async () => {
    const user = userEvent.setup()
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    // First trigger validation error with empty submit
    await user.click(screen.getByTestId('join-submit-btn'))
    expect(screen.getByTestId('join-validation-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )

    // Now type a valid name and submit
    await user.type(screen.getByTestId('join-name-input'), 'Alice')
    await user.click(screen.getByTestId('join-submit-btn'))

    // Validation error should be cleared
    expect(screen.queryByTestId('join-validation-error')).not.toBeInTheDocument()
  })

  it('has maxLength=20 on input', () => {
    render(<JoinEventForm eventId="evt1" onJoined={vi.fn()} />)

    expect(screen.getByTestId('join-name-input')).toHaveAttribute('maxlength', '20')
  })
})
