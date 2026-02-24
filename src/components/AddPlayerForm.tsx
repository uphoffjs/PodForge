import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useAddPlayer } from '@/hooks/useAddPlayer'

type AddPlayerFormProps = {
  eventId: string
}

export function AddPlayerForm({ eventId }: AddPlayerFormProps) {
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const addMutation = useAddPlayer(eventId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setValidationError('Name must be at least 2 characters.')
      return
    }

    addMutation.mutate(trimmed, {
      onSuccess: () => {
        setName('')
      },
    })
  }

  return (
    <div
      data-testid="add-player-form"
      className="w-full max-w-lg p-4 bg-surface-raised border border-border rounded-xl"
    >
      <h2 className="text-lg font-semibold text-text-primary mb-3">
        <UserPlus className="w-5 h-5 inline-block mr-2 align-text-bottom" />
        Add Player
      </h2>

      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            maxLength={20}
            autoComplete="off"
            data-testid="add-player-name-input"
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {validationError && (
            <p className="mt-1 text-sm text-error" data-testid="add-player-error">
              {validationError}
            </p>
          )}
          {addMutation.isError && (
            <p className="mt-1 text-sm text-error" data-testid="add-player-error">
              {(addMutation.error as { code?: string })?.code === '23505'
                ? 'That name is already taken. Try another!'
                : 'Failed to add player. Please try again.'}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={addMutation.isPending}
          data-testid="add-player-submit-btn"
          className="px-4 py-2 text-sm font-semibold bg-accent text-surface rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {addMutation.isPending ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  )
}
