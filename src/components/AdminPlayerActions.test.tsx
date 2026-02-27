import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPlayerActions } from './AdminPlayerActions'

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const {
  mockRemoveMutate,
  mockReactivateMutate,
  mockRemoveHook,
  mockReactivateHook,
  mockToastSuccess,
} = vi.hoisted(() => {
  const mockRemoveMutate = vi.fn()
  const mockReactivateMutate = vi.fn()
  return {
    mockRemoveMutate,
    mockReactivateMutate,
    mockRemoveHook: vi.fn(() => ({ mutate: mockRemoveMutate, isPending: false })),
    mockReactivateHook: vi.fn(() => ({ mutate: mockReactivateMutate, isPending: false })),
    mockToastSuccess: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/hooks/useRemovePlayer', () => ({
  useRemovePlayer: () => mockRemoveHook(),
}))

vi.mock('@/hooks/useReactivatePlayer', () => ({
  useReactivatePlayer: () => mockReactivateHook(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const defaultActiveProps = {
  eventId: 'evt1',
  playerId: 'p1',
  playerName: 'Alice',
  playerStatus: 'active' as const,
  passphrase: 'secret123',
  onPassphraseNeeded: vi.fn(),
}

const defaultDroppedProps = {
  ...defaultActiveProps,
  playerStatus: 'dropped' as const,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminPlayerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRemoveHook.mockReturnValue({ mutate: mockRemoveMutate, isPending: false })
    mockReactivateHook.mockReturnValue({ mutate: mockReactivateMutate, isPending: false })
  })

  it('shows remove button for active player', () => {
    render(<AdminPlayerActions {...defaultActiveProps} />)

    expect(screen.getByTestId('admin-remove-player-p1')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-reactivate-player-p1')).not.toBeInTheDocument()
  })

  it('shows reactivate button for dropped player', () => {
    render(<AdminPlayerActions {...defaultDroppedProps} />)

    expect(screen.getByTestId('admin-reactivate-player-p1')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-remove-player-p1')).not.toBeInTheDocument()
  })

  it('calls onPassphraseNeeded when passphrase is null for active player', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <AdminPlayerActions
        {...defaultActiveProps}
        passphrase={null}
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('admin-remove-player-p1'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockRemoveMutate).not.toHaveBeenCalled()
  })

  it('calls onPassphraseNeeded when passphrase is null for dropped player', async () => {
    const user = userEvent.setup()
    const onPassphraseNeeded = vi.fn()

    render(
      <AdminPlayerActions
        {...defaultDroppedProps}
        passphrase={null}
        onPassphraseNeeded={onPassphraseNeeded}
      />
    )

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))

    expect(onPassphraseNeeded).toHaveBeenCalledTimes(1)
    expect(mockReactivateMutate).not.toHaveBeenCalled()
  })

  it('opens ConfirmDialog on click when passphrase exists for active player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('admin-remove-player-p1'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('opens ConfirmDialog on click when passphrase exists for dropped player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('ConfirmDialog shows "Remove Alice?" title for active player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))

    expect(screen.getByText('Remove Alice?')).toBeInTheDocument()
  })

  it('ConfirmDialog shows "Reactivate Alice?" title for dropped player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))

    expect(screen.getByText('Reactivate Alice?')).toBeInTheDocument()
  })

  it('confirming remove calls removePlayer.mutate with correct args', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockRemoveMutate).toHaveBeenCalledTimes(1)
    expect(mockRemoveMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123', playerId: 'p1' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )
  })

  it('confirming reactivate calls reactivatePlayer.mutate with correct args', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockReactivateMutate).toHaveBeenCalledTimes(1)
    expect(mockReactivateMutate).toHaveBeenCalledWith(
      { passphrase: 'secret123', playerId: 'p1' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )
  })

  it('onSuccess shows toast and closes dialog for remove', async () => {
    const user = userEvent.setup()
    mockRemoveMutate.mockImplementation((_params: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.()
    })

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockToastSuccess).toHaveBeenCalledWith('Removed Alice')
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('onError closes dialog for remove', async () => {
    const user = userEvent.setup()
    mockRemoveMutate.mockImplementation((_params: unknown, options: { onError?: () => void }) => {
      options.onError?.()
    })

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('button is disabled when isPending is true', () => {
    mockRemoveHook.mockReturnValue({ mutate: mockRemoveMutate, isPending: true })

    render(<AdminPlayerActions {...defaultActiveProps} />)

    expect(screen.getByTestId('admin-remove-player-p1')).toBeDisabled()
  })

  it('reactivate button is disabled when reactivatePlayer.isPending is true', () => {
    mockReactivateHook.mockReturnValue({ mutate: mockReactivateMutate, isPending: true })

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    expect(screen.getByTestId('admin-reactivate-player-p1')).toBeDisabled()
  })

  it('onSuccess shows toast and closes dialog for reactivate', async () => {
    const user = userEvent.setup()
    mockReactivateMutate.mockImplementation((_params: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.()
    })

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockToastSuccess).toHaveBeenCalledWith('Reactivated Alice')
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('onError closes dialog for reactivate', async () => {
    const user = userEvent.setup()
    mockReactivateMutate.mockImplementation((_params: unknown, options: { onError?: () => void }) => {
      options.onError?.()
    })

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('handleConfirm returns early when passphrase becomes null', async () => {
    const user = userEvent.setup()

    // Render with passphrase so dialog can open
    const { rerender } = render(<AdminPlayerActions {...defaultActiveProps} />)

    // Open the dialog
    await user.click(screen.getByTestId('admin-remove-player-p1'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    // Rerender with null passphrase to simulate race condition
    rerender(<AdminPlayerActions {...defaultActiveProps} passphrase={null} />)

    // Click confirm — handleConfirm should bail out early
    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(mockRemoveMutate).not.toHaveBeenCalled()
  })

  it('confirm button text is "Remove" for active player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))

    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toHaveTextContent('Remove')
  })

  it('confirm button text is "Reactivate" for dropped player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))

    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toHaveTextContent('Reactivate')
  })

  it('ConfirmDialog shows dropped message for active player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    await user.click(screen.getByTestId('admin-remove-player-p1'))

    expect(screen.getByText(/will be marked as dropped/)).toBeInTheDocument()
  })

  it('ConfirmDialog shows re-added message for dropped player', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultDroppedProps} />)

    await user.click(screen.getByTestId('admin-reactivate-player-p1'))

    expect(screen.getByText(/will be re-added to the active player list/)).toBeInTheDocument()
  })

  it('clicking cancel button closes the confirm dialog', async () => {
    const user = userEvent.setup()

    render(<AdminPlayerActions {...defaultActiveProps} />)

    // Open the dialog
    await user.click(screen.getByTestId('admin-remove-player-p1'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    // Click cancel
    await user.click(screen.getByTestId('confirm-dialog-cancel-btn'))

    // Dialog should close
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockRemoveMutate).not.toHaveBeenCalled()
  })
})
