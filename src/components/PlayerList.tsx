import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Player } from '@/types/database'
import { PlayerItem } from '@/components/PlayerItem'

type PlayerListProps = {
  players: Player[]
  currentPlayerId: string | null
  newPlayerIds?: Set<string>
}

export function PlayerList({ players, currentPlayerId, newPlayerIds }: PlayerListProps) {
  const [showDropped, setShowDropped] = useState(false)

  const activePlayers = players.filter((p) => p.status === 'active')
  const droppedPlayers = players.filter((p) => p.status === 'dropped')

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary" data-testid="player-list-empty">
        No players yet. Share the QR code or link to invite players.
      </div>
    )
  }

  return (
    <div className="w-full" data-testid="player-list">
      <h2 className="text-lg font-semibold text-text-primary mb-3" data-testid="player-list-heading">
        Players ({activePlayers.length} active
        {droppedPlayers.length > 0 && `, ${droppedPlayers.length} dropped`})
      </h2>

      <div className="space-y-1">
        {activePlayers.map((player) => (
          <PlayerItem
            key={player.id}
            player={player}
            isSelf={player.id === currentPlayerId}
            isNew={newPlayerIds?.has(player.id) ?? false}
          />
        ))}
      </div>

      {droppedPlayers.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDropped(!showDropped)}
            data-testid="player-list-dropped-toggle"
            className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            {showDropped ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Dropped ({droppedPlayers.length})
          </button>

          {showDropped && (
            <div className="mt-2 space-y-1">
              {droppedPlayers.map((player) => (
                <PlayerItem
                  key={player.id}
                  player={player}
                  isSelf={player.id === currentPlayerId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
