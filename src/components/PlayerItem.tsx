import type { Player } from '@/types/database'

type PlayerItemProps = {
  player: Player
  isSelf: boolean
}

export function PlayerItem({ player, isSelf }: PlayerItemProps) {
  const isDropped = player.status === 'dropped'

  if (isDropped) {
    return (
      <div className="py-2 px-3 text-text-muted opacity-60">
        {player.name}
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className="py-2 px-3 bg-self-highlight/20 border-l-2 border-self-highlight rounded-r">
        <span className="font-bold text-text-primary">{player.name}</span>
      </div>
    )
  }

  return (
    <div className="py-2 px-3 text-text-primary">
      {player.name}
    </div>
  )
}
