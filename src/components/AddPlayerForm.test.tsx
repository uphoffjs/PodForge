import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPlayerForm } from './AddPlayerForm'

// Mock supabase
const mockSingle = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: mockSingle,
        }),
      }),
    }),
  },
}))

// Mock sonner (toast calls)
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('AddPlayerForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the form with input, button, and heading', () => {
    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    expect(screen.getByTestId('add-player-form')).toBeInTheDocument()
    expect(screen.getByTestId('add-player-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('add-player-submit-btn')).toHaveTextContent('Add Player')
    expect(screen.getByText('Add Player', { selector: 'h2' })).toBeInTheDocument()
  })

  it('shows validation error when name is too short', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    const input = screen.getByTestId('add-player-name-input')
    const button = screen.getByTestId('add-player-submit-btn')

    await user.type(input, 'A')
    await user.click(button)

    expect(screen.getByTestId('add-player-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
  })

  it('shows validation error for empty input', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.click(screen.getByTestId('add-player-submit-btn'))

    expect(screen.getByTestId('add-player-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
  })

  it('shows validation error when name is only whitespace', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), '   ')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    expect(screen.getByTestId('add-player-error')).toHaveTextContent(
      'Name must be at least 2 characters.'
    )
  })

  it('trims whitespace before validation - " ab " is valid', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'ab', event_id: 'evt1' },
      error: null,
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), ' ab ')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    // No validation error should appear
    expect(screen.queryByTestId('add-player-error')).not.toBeInTheDocument()
  })

  it('clears input on successful submission', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Alice', event_id: 'evt1' },
      error: null,
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    const input = screen.getByTestId('add-player-name-input')
    await user.type(input, 'Alice')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    // Wait for the mutation to complete and input to clear
    await vi.waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('clears validation error when submitting a valid name', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Alice', event_id: 'evt1' },
      error: null,
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    // First trigger validation error
    await user.click(screen.getByTestId('add-player-submit-btn'))
    expect(screen.getByTestId('add-player-error')).toBeInTheDocument()

    // Now type valid name and submit
    await user.type(screen.getByTestId('add-player-name-input'), 'Alice')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    // Validation error should be cleared immediately
    await vi.waitFor(() => {
      expect(screen.queryByTestId('add-player-error')).not.toBeInTheDocument()
    })
  })

  it('shows duplicate name error from mutation', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), 'Existing')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('add-player-error')).toHaveTextContent(
        'That name is already taken. Try another!'
      )
    })
  })

  it('shows generic error from mutation for non-duplicate errors', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '500', message: 'server error' },
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), 'Player')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('add-player-error')).toHaveTextContent(
        'Failed to add player. Please try again.'
      )
    })
  })

  it('shows generic error when mutation error is null (optional chaining safety)', async () => {
    const user = userEvent.setup()
    // Rejecting with null makes addMutation.error = null.
    // With ?. on the cast, null?.code is undefined → generic error.
    // Without ?., null.code would crash.
    mockSingle.mockRejectedValue(null)

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), 'Player')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('add-player-error')).toHaveTextContent(
        'Failed to add player. Please try again.'
      )
    })
  })

  it('shows generic error when error object has no code property', async () => {
    const user = userEvent.setup()
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'unknown error' },
    })

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), 'Player')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('add-player-error')).toHaveTextContent(
        'Failed to add player. Please try again.'
      )
    })
  })

  it('has maxLength of 20 on the input', () => {
    renderWithQuery(<AddPlayerForm eventId="evt1" />)
    expect(screen.getByTestId('add-player-name-input')).toHaveAttribute('maxlength', '20')
  })

  it('disables submit button while mutation is pending', async () => {
    const user = userEvent.setup()
    // Never resolve - keeps mutation pending
    mockSingle.mockReturnValue(new Promise(() => {}))

    renderWithQuery(<AddPlayerForm eventId="evt1" />)

    await user.type(screen.getByTestId('add-player-name-input'), 'Alice')
    await user.click(screen.getByTestId('add-player-submit-btn'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('add-player-submit-btn')).toBeDisabled()
      expect(screen.getByTestId('add-player-submit-btn')).toHaveTextContent('Adding...')
    })
  })
})
