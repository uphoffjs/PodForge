import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerItem } from './PlayerItem'
import type { Player } from '@/types/database'

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

describe('PlayerItem', () => {
  it('renders the player name', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders with correct data-testid using player id', () => {
    render(
      <PlayerItem player={makePlayer({ id: 'abc-123' })} isSelf={false} />
    )

    expect(screen.getByTestId('player-item-abc-123')).toBeInTheDocument()
  })

  it('renders dropped player with opacity-60 class', () => {
    render(
      <PlayerItem
        player={makePlayer({ status: 'dropped' })}
        isSelf={false}
      />
    )

    const el = screen.getByTestId('player-item-player-1')
    expect(el).toHaveClass('opacity-60')
    expect(el).toHaveClass('text-text-muted')
  })

  it('renders self player with bold name and self-highlight classes', () => {
    render(<PlayerItem player={makePlayer()} isSelf={true} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).toHaveClass('bg-self-highlight/20')
    expect(el).toHaveClass('border-self-highlight')

    const nameSpan = screen.getByText('Alice')
    expect(nameSpan).toHaveClass('font-bold')
    expect(nameSpan).toHaveClass('text-text-primary')
  })

  it('renders regular (non-self, active) player with text-text-primary class', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).toHaveClass('text-text-primary')
  })

  it('applies animate-flash class when isNew is true', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} isNew={true} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).toHaveClass('animate-flash')
  })

  it('does NOT apply animate-flash class when isNew is false', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} isNew={false} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).not.toHaveClass('animate-flash')
  })

  it('does NOT apply animate-flash class by default when isNew is omitted', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).not.toHaveClass('animate-flash')
  })

  it('dropped player does NOT get animate-flash even when isNew is true', () => {
    render(
      <PlayerItem
        player={makePlayer({ status: 'dropped' })}
        isSelf={false}
        isNew={true}
      />
    )

    const el = screen.getByTestId('player-item-player-1')
    expect(el).not.toHaveClass('animate-flash')
  })

  it('self player receives animate-flash when isNew is true', () => {
    render(<PlayerItem player={makePlayer()} isSelf={true} isNew={true} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el).toHaveClass('animate-flash')
  })

  it('flashClass is empty string when isNew is false for regular player', () => {
    render(<PlayerItem player={makePlayer()} isSelf={false} isNew={false} />)

    const el = screen.getByTestId('player-item-player-1')
    // The className should contain text-text-primary but NOT animate-flash
    // and also not contain any "Stryker" artifacts
    expect(el.className).not.toContain('animate-flash')
    expect(el.className).toContain('text-text-primary')
  })

  it('flashClass is empty string when isNew is false for self player', () => {
    render(<PlayerItem player={makePlayer()} isSelf={true} isNew={false} />)

    const el = screen.getByTestId('player-item-player-1')
    expect(el.className).not.toContain('animate-flash')
    expect(el).toHaveClass('bg-self-highlight/20')
    // Verify no extra unexpected classes from mutation (the class list should be clean)
    const classes = el.className.split(/\s+/)
    classes.forEach((cls) => {
      expect(cls).not.toContain('Stryker')
    })
  })

  it('dropped player status check uses exact string "dropped"', () => {
    // Render with status 'active' - should NOT have opacity-60
    render(<PlayerItem player={makePlayer({ status: 'active' })} isSelf={false} />)
    const activeEl = screen.getByTestId('player-item-player-1')
    expect(activeEl).not.toHaveClass('opacity-60')
    expect(activeEl).not.toHaveClass('text-text-muted')
  })
})
