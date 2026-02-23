import { QRCodeSVG } from 'qrcode.react'

type QRCodeDisplayProps = {
  eventId: string
}

export function QRCodeDisplay({ eventId }: QRCodeDisplayProps) {
  const url = `${window.location.origin}/event/${eventId}`

  return (
    <div className="bg-white p-4 rounded-xl inline-block">
      <QRCodeSVG
        value={url}
        size={200}
        level="M"
        marginSize={2}
      />
    </div>
  )
}
