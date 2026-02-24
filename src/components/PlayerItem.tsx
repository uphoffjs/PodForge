import type { Player } from '@/types/database'

type PlayerItemProps = {
  player: Player
  isSelf: boolean
  isNew?: boolean
  adminActions?: React.ReactNode
}

export function PlayerItem({ player, isSelf, isNew = false, adminActions }: PlayerItemProps) {
  const isDropped = player.status === 'dropped'
  const flashClass = isNew ? 'animate-flash' : ''

  if (isDropped) {
    return (
      <div className="flex items-center py-2 px-3 text-text-muted opacity-60" data-testid={`player-item-${player.id}`}>
        <span>{player.name}</span>
        {adminActions}
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className={`flex items-center py-2 px-3 bg-self-highlight/20 border-l-2 border-self-highlight rounded-r ${flashClass}`} data-testid={`player-item-${player.id}`}>
        <span className="font-bold text-text-primary">{player.name}</span>
        {adminActions}
      </div>
    )
  }

  return (
    <div className={`flex items-center py-2 px-3 text-text-primary ${flashClass}`} data-testid={`player-item-${player.id}`}>
      <span>{player.name}</span>
      {adminActions}
    </div>
  )
}
