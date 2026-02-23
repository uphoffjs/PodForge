import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateEvent } from '@/hooks/useCreateEvent'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateEventModal({ isOpen, onClose }: CreateEventModalProps) {
  const [eventName, setEventName] = useState('')
  const [passphrase, setPassphrase] = useState('')

  const navigate = useNavigate()
  const createEvent = useCreateEvent()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    createEvent.mutate(
      { name: eventName, passphrase },
      {
        onSuccess: (eventId: string) => {
          // Store passphrase in sessionStorage for admin actions
          // Uses same key format as useAdminAuth: pod_pairer_admin_{eventId}
          sessionStorage.setItem(`pod_pairer_admin_${eventId}`, passphrase)
          toast.success('Event created!')
          navigate(`/event/${eventId}`)
        },
      }
    )
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md bg-surface-raised border border-border rounded-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-display font-bold text-text-primary mb-6">
          Create Event
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="event-name"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Event Name
            </label>
            <input
              id="event-name"
              type="text"
              required
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Friday Night Commander"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="passphrase"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Admin Passphrase
            </label>
            <input
              id="passphrase"
              type="password"
              required
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Admin passphrase"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-text-muted mt-1.5">
              You'll need this to manage the event
            </p>
          </div>

          <button
            type="submit"
            disabled={createEvent.isPending}
            className="mt-2 w-full rounded-lg bg-accent py-3 px-4 text-surface font-semibold text-base hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {createEvent.isPending ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
