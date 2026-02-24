import { useState, useEffect, type FormEvent } from 'react'

interface AdminPassphraseModalProps {
  isOpen: boolean
  onSubmit: (passphrase: string) => void
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

export function AdminPassphraseModal({
  isOpen,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
}: AdminPassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('')

  // Reset passphrase when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassphrase('')
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (passphrase.trim()) {
      onSubmit(passphrase)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      data-testid="admin-passphrase-modal"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-sm bg-surface-raised border border-border rounded-2xl p-6">
        <h2 className="text-xl font-display font-bold text-text-primary mb-2">
          Admin Authentication
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Enter the admin passphrase to continue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Admin passphrase"
              autoFocus
              disabled={isLoading}
              data-testid="admin-passphrase-input"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {error && (
              <p
                className="text-sm text-error mt-2"
                data-testid="admin-passphrase-error"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              data-testid="admin-passphrase-cancel"
              className="flex-1 rounded-lg border border-border py-2.5 px-4 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !passphrase.trim()}
              data-testid="admin-passphrase-submit"
              className="flex-1 rounded-lg bg-accent py-2.5 px-4 text-sm font-medium text-surface hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isLoading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
