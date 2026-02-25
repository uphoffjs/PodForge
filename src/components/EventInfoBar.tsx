import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { QRCodeDisplay } from '@/components/QRCodeDisplay'

type EventInfoBarProps = {
  eventId: string
  eventName: string
  eventStatus: 'active' | 'ended'
  activePlayerCount: number
  currentRoundNumber: number | null
}

export function EventInfoBar({
  eventId,
  eventName,
  eventStatus,
  activePlayerCount,
  currentRoundNumber,
}: EventInfoBarProps) {
  const [qrExpanded, setQrExpanded] = useState(false)

  const shareUrl = `${window.location.origin}/event/${eventId}`

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied!')
    } catch {
      toast.error('Failed to copy link.')
    }
  }, [shareUrl])

  return (
    <div
      className="w-full max-w-lg bg-surface-raised border border-border rounded-xl p-4 mb-6"
      data-testid="event-info-bar"
    >
      {/* Event name */}
      <h1
        className="text-3xl font-display font-bold text-accent text-center"
        data-testid="event-info-name"
      >
        {eventName}
      </h1>

      {/* Status badge */}
      <div className="flex justify-center mt-2">
        <span
          className="inline-block px-3 py-1 text-xs font-semibold uppercase rounded-full bg-surface-raised border border-border text-text-secondary"
          data-testid="event-info-status"
        >
          {eventStatus}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex justify-center gap-6 mt-4 text-sm text-text-secondary">
        <span data-testid="event-info-player-count">
          Players: {activePlayerCount}
        </span>
        <span data-testid="event-info-round-number">
          {currentRoundNumber !== null
            ? `Round: ${currentRoundNumber}`
            : 'No rounds yet'}
        </span>
      </div>

      {/* QR code toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setQrExpanded((prev) => !prev)}
          data-testid="event-info-qr-toggle"
          className="flex items-center justify-center gap-1 w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          {qrExpanded ? (
            <>
              Hide QR Code
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show QR Code
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
        {qrExpanded && (
          <div
            className="flex justify-center mt-2"
            data-testid="event-info-qr-section"
          >
            <QRCodeDisplay eventId={eventId} />
          </div>
        )}
      </div>

      {/* Share link row */}
      <div className="flex items-center gap-2 mt-4">
        <input
          type="text"
          readOnly
          value={shareUrl}
          data-testid="event-info-share-link"
          className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-secondary truncate"
        />
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="event-info-copy-btn"
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-accent text-surface rounded-lg hover:bg-accent-bright transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
      </div>
    </div>
  )
}
