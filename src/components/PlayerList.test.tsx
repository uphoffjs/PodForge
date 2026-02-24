import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerList } from './PlayerList'
import type { Player } from '@/types/database'

// Mock PlayerItem so we can inspect the props it receives without coupling
// to its internal rendering. We render a simple div with data attributes.
vi.mock('@/components/PlayerItem', () => ({
  PlayerItem: ({
    player,
    isSelf,
    isNew,
  }: {
    player: Player
    isSelf: boolean
    isNew?: boolean
  }) => (
    <div
      data-testid={`player-item-${player.id}`}
      data-is-self={String(isSelf)}
      data-is-new={String(isNew ?? false)}
      data-status={player.status}
    >
      {player.name}
    </div>
  ),
}))

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    event_id: 'event-1',
    name: 'Alice',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('PlayerList', () => {
  it('shows empty state when no players are provided', () => {
    render(
      <PlayerList players={[]} currentPlayerId={null} />
    )

    expect(screen.getByTestId('player-list-empty')).toBeInTheDocument()
    expect(screen.getByText('No players yet')).toBeInTheDocument()
  })

  it('empty state text mentions QR code and event link', () => {
    render(
      <PlayerList players={[]} currentPlayerId={null} />
    )

    const emptyState = screen.getByTestId('player-list-empty')
    expect(emptyState).toHaveTextContent('QR code')
    expect(emptyState).toHaveTextContent('event link')
  })

  it('renders active players', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
      makePlayer({ id: 'p2', name: 'Bob' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveTextContent('Alice')
    expect(screen.getByTestId('player-item-p2')).toHaveTextContent('Bob')
  })

  it('does not show the player list container when empty', () => {
    render(
      <PlayerList players={[]} currentPlayerId={null} />
    )

    expect(screen.queryByTestId('player-list')).not.toBeInTheDocument()
  })

  it('hides dropped players by default', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    // Active player visible
    expect(screen.getByTestId('player-item-p1')).toBeInTheDocument()
    // Dropped player not visible
    expect(screen.queryByTestId('player-item-p2')).not.toBeInTheDocument()
  })

  it('shows dropped players after clicking the toggle button', async () => {
    const user = userEvent.setup()
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    await user.click(screen.getByTestId('player-list-dropped-toggle'))

    expect(screen.getByTestId('player-item-p2')).toBeInTheDocument()
    expect(screen.getByTestId('player-item-p2')).toHaveTextContent('Bob')
  })

  it('hides dropped players again after toggling twice', async () => {
    const user = userEvent.setup()
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const toggle = screen.getByTestId('player-list-dropped-toggle')

    // Open dropped section
    await user.click(toggle)
    expect(screen.getByTestId('player-item-p2')).toBeInTheDocument()

    // Close dropped section
    await user.click(toggle)
    expect(screen.queryByTestId('player-item-p2')).not.toBeInTheDocument()
  })

  it('shows "X active" format in the heading', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
      makePlayer({ id: 'p2', name: 'Bob' }),
      makePlayer({ id: 'p3', name: 'Charlie' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).toHaveTextContent('3 active')
  })

  it('shows dropped count in the heading when dropped players exist', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
      makePlayer({ id: 'p3', name: 'Charlie', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).toHaveTextContent('1 active')
    expect(heading).toHaveTextContent('2 dropped')
  })

  it('heading text matches exact format with dropped players', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'active' }),
      makePlayer({ id: 'p3', name: 'Charlie', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).toHaveTextContent('Players (2 active, 1 dropped)')
  })

  it('heading text matches exact format without dropped players', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'active' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).toHaveTextContent('Players (2 active)')
  })

  it('does not show dropped count when no dropped players exist', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).not.toHaveTextContent('dropped')
  })

  it('does not show toggle button when no dropped players exist', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    expect(
      screen.queryByTestId('player-list-dropped-toggle')
    ).not.toBeInTheDocument()
  })

  it('passes isSelf=true to PlayerItem matching currentPlayerId', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
      makePlayer({ id: 'p2', name: 'Bob' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId="p1" />
    )

    const aliceItem = screen.getByTestId('player-item-p1')
    const bobItem = screen.getByTestId('player-item-p2')

    expect(aliceItem).toHaveAttribute('data-is-self', 'true')
    expect(bobItem).toHaveAttribute('data-is-self', 'false')
  })

  it('passes isSelf=false to all players when currentPlayerId is null', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
      makePlayer({ id: 'p2', name: 'Bob' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveAttribute(
      'data-is-self',
      'false'
    )
    expect(screen.getByTestId('player-item-p2')).toHaveAttribute(
      'data-is-self',
      'false'
    )
  })

  it('passes isNew=true to PlayerItems whose ids are in newPlayerIds', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
      makePlayer({ id: 'p2', name: 'Bob' }),
      makePlayer({ id: 'p3', name: 'Charlie' }),
    ]
    const newPlayerIds = new Set(['p1', 'p3'])

    render(
      <PlayerList
        players={players}
        currentPlayerId={null}
        newPlayerIds={newPlayerIds}
      />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveAttribute(
      'data-is-new',
      'true'
    )
    expect(screen.getByTestId('player-item-p2')).toHaveAttribute(
      'data-is-new',
      'false'
    )
    expect(screen.getByTestId('player-item-p3')).toHaveAttribute(
      'data-is-new',
      'true'
    )
  })

  it('passes isNew=false to all players when newPlayerIds is undefined', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveAttribute(
      'data-is-new',
      'false'
    )
  })

  it('passes isNew=false when newPlayerIds is defined but does not contain player id', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
    ]
    const newPlayerIds = new Set(['p99'])

    render(
      <PlayerList
        players={players}
        currentPlayerId={null}
        newPlayerIds={newPlayerIds}
      />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveAttribute(
      'data-is-new',
      'false'
    )
  })

  it('passes isNew=true when newPlayerIds is an empty Set (no players marked new)', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice' }),
    ]
    const newPlayerIds = new Set<string>()

    render(
      <PlayerList
        players={players}
        currentPlayerId={null}
        newPlayerIds={newPlayerIds}
      />
    )

    expect(screen.getByTestId('player-item-p1')).toHaveAttribute(
      'data-is-new',
      'false'
    )
  })

  it('passes isSelf=true to dropped PlayerItem matching currentPlayerId', async () => {
    const user = userEvent.setup()
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
      makePlayer({ id: 'p3', name: 'Charlie', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId="p2" />
    )

    await user.click(screen.getByTestId('player-list-dropped-toggle'))

    expect(screen.getByTestId('player-item-p2')).toHaveAttribute('data-is-self', 'true')
    expect(screen.getByTestId('player-item-p3')).toHaveAttribute('data-is-self', 'false')
  })

  it('dropped toggle button shows the dropped player count', async () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'active' }),
      makePlayer({ id: 'p2', name: 'Bob', status: 'dropped' }),
      makePlayer({ id: 'p3', name: 'Charlie', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const toggle = screen.getByTestId('player-list-dropped-toggle')
    expect(toggle).toHaveTextContent('Dropped (2)')
  })

  it('heading shows exactly "0 active" when all players are dropped', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Alice', status: 'dropped' }),
    ]

    render(
      <PlayerList players={players} currentPlayerId={null} />
    )

    const heading = screen.getByTestId('player-list-heading')
    expect(heading).toHaveTextContent('0 active')
    expect(heading).toHaveTextContent('1 dropped')
  })
})
