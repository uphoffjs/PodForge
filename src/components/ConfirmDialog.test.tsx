import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

const defaultProps = {
  isOpen: true,
  title: 'Leave Event',
  message: 'Are you sure you want to leave?',
  confirmLabel: 'Leave',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} isOpen={false} />
    )

    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('renders title, message, and confirmLabel when open', () => {
    render(<ConfirmDialog {...defaultProps} />)

    expect(screen.getByText('Leave Event')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to leave?')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toHaveTextContent(
      'Leave'
    )
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

    await user.click(screen.getByTestId('confirm-dialog-cancel-btn'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)

    await user.click(screen.getByTestId('confirm-dialog-confirm-btn'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when overlay background is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

    await user.click(screen.getByTestId('confirm-dialog'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onCancel when inner dialog content is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

    // Click on the title text inside the inner dialog div
    await user.click(screen.getByText('Leave Event'))

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('disables both buttons when isLoading is true', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)

    expect(screen.getByTestId('confirm-dialog-cancel-btn')).toBeDisabled()
    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toBeDisabled()
  })

  it('shows "Leaving..." instead of confirmLabel when isLoading', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)

    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toHaveTextContent(
      'Leaving...'
    )
    expect(
      screen.getByTestId('confirm-dialog-confirm-btn')
    ).not.toHaveTextContent('Leave')
  })

  it('shows confirmLabel when isLoading is false', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={false} />)

    expect(screen.getByTestId('confirm-dialog-confirm-btn')).toHaveTextContent(
      'Leave'
    )
    expect(
      screen.getByTestId('confirm-dialog-confirm-btn')
    ).not.toHaveTextContent('Leaving...')
  })
})
