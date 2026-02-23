import { useParams } from 'react-router'

export function EventPage() {
  const { eventId } = useParams()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-2xl font-display font-bold text-accent mb-4">
        Event: {eventId}
      </h1>
      <p className="text-text-secondary">
        Event page placeholder
      </p>
    </div>
  )
}
