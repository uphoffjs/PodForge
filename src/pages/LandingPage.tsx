import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, ArrowRight } from 'lucide-react'
import { CreateEventModal } from '@/components/CreateEventModal'

function extractEventId(input: string): string {
  const trimmed = input.trim()

  // Check if it's a URL containing /event/
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/event\/(.+)/)
    if (match) {
      return match[1]
    }
  } catch {
    // Not a valid URL -- check if it's a relative path with /event/
    const pathMatch = trimmed.match(/\/event\/(.+)/)
    if (pathMatch) {
      return pathMatch[1]
    }
  }

  // Otherwise treat it as a bare event ID
  return trimmed
}

export function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const navigate = useNavigate()

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    const eventId = extractEventId(joinInput)
    if (eventId) {
      navigate(`/event/${eventId}`)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-accent leading-tight">
            Commander Pod Pairer
          </h1>
          <p className="mt-3 text-text-secondary text-lg">
            Organize your Commander pods in seconds
          </p>
        </div>

        {/* Create Event */}
        <button
          onClick={() => setIsModalOpen(true)}
          data-testid="landing-create-event-btn"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent py-3.5 px-4 text-surface font-semibold text-lg hover:bg-accent-bright transition-colors min-h-[48px]"
        >
          <Plus size={22} />
          Create Event
        </button>

        {/* Divider */}
        <div className="flex items-center w-full gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-sm">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Join Event */}
        <form onSubmit={handleJoin} className="w-full flex gap-2">
          <input
            type="text"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste event link or enter event ID"
            data-testid="landing-join-input"
            className="flex-1 rounded-lg border border-border bg-surface-raised px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!joinInput.trim()}
            data-testid="landing-join-btn"
            className="rounded-lg bg-surface-raised border border-border px-4 py-3 text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            aria-label="Join event"
          >
            <ArrowRight size={20} />
          </button>
        </form>
      </div>

      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
