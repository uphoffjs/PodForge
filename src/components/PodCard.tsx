import { Coffee } from 'lucide-react'

interface PodCardPlayer {
  playerId: string
  playerName: string
  seatNumber: number | null
}

interface PodCardProps {
  podNumber: number
  isBye: boolean
  players: PodCardPlayer[]
  currentPlayerId: string | null
}

const POD_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
]

function getOrdinal(n: number): string {
  switch (n) {
    case 1: return '1st'
    case 2: return '2nd'
    case 3: return '3rd'
    case 4: return '4th'
    default: return `${n}th`
  }
}

export function PodCard({ podNumber, isBye, players, currentPlayerId }: PodCardProps) {
  if (isBye) {
    return (
      <div
        className="bg-surface border border-border/50 rounded-xl p-4"
        data-testid="pod-card-bye"
      >
        <div className="flex items-center gap-2 mb-3">
          <Coffee className="w-5 h-5 text-text-muted" />
          <h3 className="text-lg font-semibold text-text-secondary">
            Sitting Out
          </h3>
        </div>
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.playerId}
              data-testid={`pod-player-${player.playerId}`}
              className="text-base text-text-secondary"
            >
              {player.playerName}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const borderColor = POD_COLORS[(podNumber - 1) % POD_COLORS.length]

  // Sort players by seat number for display
  const sortedPlayers = [...players].sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))

  return (
    <div
      className="bg-surface-raised border border-border rounded-xl p-4"
      style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
      data-testid={`pod-card-${podNumber}`}
    >
      <h3 className="text-lg font-semibold text-text-primary mb-3">
        Pod {podNumber}
      </h3>
      <ul className="flex flex-col gap-2">
        {sortedPlayers.map((player) => {
          const isCurrentPlayer = player.playerId === currentPlayerId
          return (
            <li
              key={player.playerId}
              data-testid={`pod-player-${player.playerId}`}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                isCurrentPlayer ? 'bg-accent/10' : ''
              }`}
            >
              {player.seatNumber !== null && (
                <span
                  data-testid={`pod-seat-${player.seatNumber}`}
                  className="inline-flex items-center justify-center text-xs font-semibold rounded-full bg-surface border border-border px-2 py-0.5 text-text-secondary min-w-[36px]"
                >
                  {getOrdinal(player.seatNumber)}
                </span>
              )}
              <span className={`text-lg font-semibold ${
                isCurrentPlayer ? 'text-accent' : 'text-text-primary'
              }`}>
                {player.playerName}
                {isCurrentPlayer && (
                  <span className="text-sm font-normal text-accent ml-1">(You)</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
