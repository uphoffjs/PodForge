import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPassphraseModal } from './AdminPassphraseModal'

const defaultProps = {
  isOpen: true,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}

describe('AdminPassphraseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <AdminPassphraseModal {...defaultProps} isOpen={false} />
    )

    expect(container.innerHTML).toBe('')
    expect(
      screen.queryByTestId('admin-passphrase-modal')
    ).not.toBeInTheDocument()
  })

  it('renders modal with data-testid="admin-passphrase-modal" when open', () => {
    render(<AdminPassphraseModal {...defaultProps} />)

    expect(screen.getByTestId('admin-passphrase-modal')).toBeInTheDocument()
    expect(screen.getByText('Admin Authentication')).toBeInTheDocument()
    expect(
      screen.getByText('Enter the admin passphrase to continue.')
    ).toBeInTheDocument()
  })

  it('resets input to empty when modal opens (re-render isOpen false then true)', async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <AdminPassphraseModal {...defaultProps} isOpen={true} />
    )

    const input = screen.getByTestId('admin-passphrase-input')
    await user.type(input, 'some-passphrase')
    expect(input).toHaveValue('some-passphrase')

    // Close the modal
    rerender(<AdminPassphraseModal {...defaultProps} isOpen={false} />)

    // Re-open the modal - input should be cleared
    rerender(<AdminPassphraseModal {...defaultProps} isOpen={true} />)

    expect(screen.getByTestId('admin-passphrase-input')).toHaveValue('')
  })

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onCancel on Escape when modal is closed', () => {
    const onCancel = vi.fn()

    render(
      <AdminPassphraseModal
        {...defaultProps}
        isOpen={false}
        onCancel={onCancel}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when overlay background is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onCancel={onCancel} />)

    await user.click(screen.getByTestId('admin-passphrase-modal'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onCancel when inner dialog content is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onCancel={onCancel} />)

    // Click on the heading text inside the inner dialog div
    await user.click(screen.getByText('Admin Authentication'))

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onSubmit with the passphrase when form is submitted with trimmed content', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByTestId('admin-passphrase-input'), 'secret123')
    await user.click(screen.getByTestId('admin-passphrase-submit'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('secret123')
  })

  it('does NOT call onSubmit when passphrase is whitespace-only', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByTestId('admin-passphrase-input'), '   ')

    // Submit button should be disabled because '   '.trim() is empty
    expect(screen.getByTestId('admin-passphrase-submit')).toBeDisabled()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does NOT call onSubmit when passphrase is empty', () => {
    const onSubmit = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onSubmit={onSubmit} />)

    // Submit button should be disabled when input is empty
    expect(screen.getByTestId('admin-passphrase-submit')).toBeDisabled()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables submit button when isLoading is true', async () => {
    const user = userEvent.setup()

    render(<AdminPassphraseModal {...defaultProps} isLoading={true} />)

    // Type something first so we can isolate the isLoading disable from the empty-trim disable
    // But the input is also disabled when isLoading, so we render with existing content
    // Instead, just verify the button is disabled
    expect(screen.getByTestId('admin-passphrase-submit')).toBeDisabled()

    // Verify clicking does nothing
    await user.click(screen.getByTestId('admin-passphrase-submit'))

    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('disables cancel button when isLoading is true', () => {
    render(<AdminPassphraseModal {...defaultProps} isLoading={true} />)

    expect(screen.getByTestId('admin-passphrase-cancel')).toBeDisabled()
  })

  it('disables input when isLoading is true', () => {
    render(<AdminPassphraseModal {...defaultProps} isLoading={true} />)

    expect(screen.getByTestId('admin-passphrase-input')).toBeDisabled()
  })

  it('shows "Verifying..." when isLoading is true', () => {
    render(<AdminPassphraseModal {...defaultProps} isLoading={true} />)

    expect(screen.getByTestId('admin-passphrase-submit')).toHaveTextContent(
      'Verifying...'
    )
    expect(
      screen.getByTestId('admin-passphrase-submit')
    ).not.toHaveTextContent('Confirm')
  })

  it('shows "Confirm" when isLoading is false', () => {
    render(<AdminPassphraseModal {...defaultProps} isLoading={false} />)

    expect(screen.getByTestId('admin-passphrase-submit')).toHaveTextContent(
      'Confirm'
    )
    expect(
      screen.getByTestId('admin-passphrase-submit')
    ).not.toHaveTextContent('Verifying...')
  })

  it('displays error message when error prop is provided', () => {
    render(
      <AdminPassphraseModal {...defaultProps} error="Invalid passphrase" />
    )

    expect(screen.getByTestId('admin-passphrase-error')).toBeInTheDocument()
    expect(screen.getByTestId('admin-passphrase-error')).toHaveTextContent(
      'Invalid passphrase'
    )
  })

  it('does not render error element when error is null', () => {
    render(<AdminPassphraseModal {...defaultProps} error={null} />)

    expect(
      screen.queryByTestId('admin-passphrase-error')
    ).not.toBeInTheDocument()
  })

  it('handleSubmit does not call onSubmit when passphrase is empty (form submit bypass)', () => {
    const onSubmit = vi.fn()

    render(<AdminPassphraseModal {...defaultProps} onSubmit={onSubmit} />)

    // Directly submit the form (bypasses disabled button check)
    const form = screen.getByTestId('admin-passphrase-submit').closest('form')!
    fireEvent.submit(form)

    // passphrase is '' which trims to '', so onSubmit should NOT be called
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
