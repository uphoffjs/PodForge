import { useState } from 'react'
import { useJoinEvent } from '@/hooks/useJoinEvent'

type JoinEventFormProps = {
  eventId: string
  onJoined: (playerId: string) => void
}

export function JoinEventForm({ eventId, onJoined }: JoinEventFormProps) {
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const joinMutation = useJoinEvent(eventId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setValidationError('Name must be at least 2 characters.')
      return
    }

    joinMutation.mutate(trimmed, {
      onSuccess: (data) => {
        onJoined(data.id)
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
      <label htmlFor="player-name" className="block text-lg font-semibold text-text-primary">
        Enter your name to join
      </label>

      <input
        id="player-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        autoComplete="off"
        className="w-full px-4 py-3 text-lg bg-surface-raised border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />

      {validationError && (
        <p className="text-sm text-error">{validationError}</p>
      )}

      {joinMutation.isError && (
        <p className="text-sm text-error">
          {(joinMutation.error as { code?: string })?.code === '23505'
            ? 'That name is already taken. Try another!'
            : 'Failed to join. Please try again.'}
        </p>
      )}

      <button
        type="submit"
        disabled={joinMutation.isPending}
        className="w-full py-3 text-lg font-semibold bg-accent text-surface rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {joinMutation.isPending ? 'Joining...' : 'Join Event'}
      </button>
    </form>
  )
}
