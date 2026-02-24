import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Player } from '@/types/database'
import { PlayerItem } from '@/components/PlayerItem'
import { AdminPlayerActions } from '@/components/AdminPlayerActions'

type PlayerListProps = {
  players: Player[]
  currentPlayerId: string | null
  newPlayerIds?: Set<string>
  isAdmin?: boolean
  eventId?: string
  passphrase?: string | null
  onPassphraseNeeded?: () => void
}

export function PlayerList({
  players,
  currentPlayerId,
  newPlayerIds,
  isAdmin,
  eventId,
  passphrase,
  onPassphraseNeeded,
}: PlayerListProps) {
  const [showDropped, setShowDropped] = useState(false)

  const activePlayers = players.filter((p) => p.status === 'active')
  const droppedPlayers = players.filter((p) => p.status === 'dropped')

  const canShowAdminActions = isAdmin && eventId && onPassphraseNeeded

  if (players.length === 0) {
    return (
      <div className="text-center py-8" data-testid="player-list-empty">
        <p className="text-text-primary font-semibold text-lg mb-2">No players yet</p>
        <p className="text-text-secondary text-sm">
          Share the QR code or event link below to invite players.
          Once they join, they'll appear here automatically.
        </p>
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
            adminActions={
              canShowAdminActions ? (
                <AdminPlayerActions
                  eventId={eventId}
                  playerId={player.id}
                  playerName={player.name}
                  playerStatus={player.status}
                  passphrase={passphrase ?? null}
                  onPassphraseNeeded={onPassphraseNeeded}
                />
              ) : undefined
            }
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
                  adminActions={
                    canShowAdminActions ? (
                      <AdminPlayerActions
                        eventId={eventId}
                        playerId={player.id}
                        playerName={player.name}
                        playerStatus={player.status}
                        passphrase={passphrase ?? null}
                        onPassphraseNeeded={onPassphraseNeeded}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
