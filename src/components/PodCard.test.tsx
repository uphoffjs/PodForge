import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PodCard } from './PodCard'

interface PodCardPlayer {
  playerId: string
  playerName: string
  seatNumber: number | null
}

function makePlayer(overrides: Partial<PodCardPlayer> = {}): PodCardPlayer {
  return {
    playerId: 'player-1',
    playerName: 'Alice',
    seatNumber: 1,
    ...overrides,
  }
}

describe('PodCard', () => {
  describe('bye pod', () => {
    it('renders with data-testid="pod-card-bye" when isBye is true', () => {
      render(
        <PodCard
          podNumber={1}
          isBye={true}
          players={[makePlayer()]}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-card-bye')).toBeInTheDocument()
    })

    it('displays "Sitting Out" heading', () => {
      render(
        <PodCard
          podNumber={1}
          isBye={true}
          players={[makePlayer()]}
          currentPlayerId={null}
        />
      )

      expect(screen.getByText('Sitting Out')).toBeInTheDocument()
    })

    it('lists all players by name', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice' }),
        makePlayer({ playerId: 'p2', playerName: 'Bob' }),
        makePlayer({ playerId: 'p3', playerName: 'Charlie' }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={true}
          players={players}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-player-p1')).toHaveTextContent('Alice')
      expect(screen.getByTestId('pod-player-p2')).toHaveTextContent('Bob')
      expect(screen.getByTestId('pod-player-p3')).toHaveTextContent('Charlie')
    })
  })

  describe('normal pod', () => {
    it('renders with data-testid="pod-card-{podNumber}"', () => {
      render(
        <PodCard
          podNumber={3}
          isBye={false}
          players={[makePlayer()]}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-card-3')).toBeInTheDocument()
    })

    it('displays "Pod {podNumber}" heading', () => {
      render(
        <PodCard
          podNumber={2}
          isBye={false}
          players={[makePlayer()]}
          currentPlayerId={null}
        />
      )

      expect(screen.getByText('Pod 2')).toBeInTheDocument()
    })

    it('displays ordinal seat labels 1st, 2nd, 3rd, 4th correctly', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: 1 }),
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
        makePlayer({ playerId: 'p3', playerName: 'Charlie', seatNumber: 3 }),
        makePlayer({ playerId: 'p4', playerName: 'Diana', seatNumber: 4 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-seat-1')).toHaveTextContent('1st')
      expect(screen.getByTestId('pod-seat-2')).toHaveTextContent('2nd')
      expect(screen.getByTestId('pod-seat-3')).toHaveTextContent('3rd')
      expect(screen.getByTestId('pod-seat-4')).toHaveTextContent('4th')
    })

    it('displays "{n}th" for seat numbers greater than 4', () => {
      const players = [
        makePlayer({ playerId: 'p5', playerName: 'Eve', seatNumber: 5 }),
        makePlayer({ playerId: 'p6', playerName: 'Frank', seatNumber: 6 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-seat-5')).toHaveTextContent('5th')
      expect(screen.getByTestId('pod-seat-6')).toHaveTextContent('6th')
    })

    it('sorts players by seat number in ascending order', () => {
      const players = [
        makePlayer({ playerId: 'p3', playerName: 'Charlie', seatNumber: 3 }),
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: 1 }),
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      const listItems = screen.getByTestId('pod-card-1').querySelectorAll('li')
      expect(listItems).toHaveLength(3)
      expect(listItems[0]).toHaveTextContent('Alice')
      expect(listItems[1]).toHaveTextContent('Bob')
      expect(listItems[2]).toHaveTextContent('Charlie')
    })

    it('shows "(You)" text for the current player', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: 1 }),
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId="p1"
        />
      )

      expect(screen.getByTestId('pod-player-p1')).toHaveTextContent('(You)')
      expect(screen.getByTestId('pod-player-p2')).not.toHaveTextContent('(You)')
    })

    it('applies accent styling class to the current player row', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: 1 }),
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId="p1"
        />
      )

      expect(screen.getByTestId('pod-player-p1')).toHaveClass('bg-accent/10')
      expect(screen.getByTestId('pod-player-p2')).not.toHaveClass('bg-accent/10')
    })

    it('pod 2 has green border color (#10b981)', () => {
      render(
        <PodCard podNumber={2} isBye={false} players={[makePlayer()]} currentPlayerId={null} />
      )
      expect(screen.getByTestId('pod-card-2')).toHaveStyle({ borderLeftColor: '#10b981' })
    })

    it('pod 3 has amber border color (#f59e0b)', () => {
      render(
        <PodCard podNumber={3} isBye={false} players={[makePlayer()]} currentPlayerId={null} />
      )
      expect(screen.getByTestId('pod-card-3')).toHaveStyle({ borderLeftColor: '#f59e0b' })
    })

    it('pod 4 has red border color (#ef4444)', () => {
      render(
        <PodCard podNumber={4} isBye={false} players={[makePlayer()]} currentPlayerId={null} />
      )
      expect(screen.getByTestId('pod-card-4')).toHaveStyle({ borderLeftColor: '#ef4444' })
    })

    it('cycles border color through POD_COLORS so pod 5 matches pod 1 (blue)', () => {
      const players = [makePlayer()]

      const { unmount } = render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      const pod1 = screen.getByTestId('pod-card-1')
      expect(pod1).toHaveStyle({ borderLeftColor: '#3b82f6', borderLeftWidth: '4px' })

      unmount()

      render(
        <PodCard
          podNumber={5}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      const pod5 = screen.getByTestId('pod-card-5')
      expect(pod5).toHaveStyle({ borderLeftColor: '#3b82f6', borderLeftWidth: '4px' })
    })

    it('non-current player has no bg-accent/10 class and has text-text-primary', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: 1 }),
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId="p1"
        />
      )

      // Non-current player row should NOT have bg-accent/10
      const nonCurrentRow = screen.getByTestId('pod-player-p2')
      expect(nonCurrentRow.className).not.toContain('bg-accent/10')

      // Non-current player name span should have text-text-primary
      const nameSpan = nonCurrentRow.querySelector('span.text-text-primary')
      expect(nameSpan).not.toBeNull()
      expect(nameSpan).toHaveTextContent('Bob')

      // Current player name span should have text-accent
      const currentRow = screen.getByTestId('pod-player-p1')
      const currentNameSpan = currentRow.querySelector('span.text-accent')
      expect(currentNameSpan).not.toBeNull()
      expect(currentNameSpan).toHaveTextContent('Alice')
    })

    it('does not render seat badge when seatNumber is null', () => {
      const players = [
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: null }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      expect(screen.getByTestId('pod-player-p1')).toBeInTheDocument()
      expect(screen.getByTestId('pod-player-p1')).toHaveTextContent('Alice')
      // No seat badge should be rendered at all
      expect(screen.queryByTestId('pod-seat-0')).not.toBeInTheDocument()
      // Verify there are no seat spans inside the player item
      const playerLi = screen.getByTestId('pod-player-p1')
      const seatSpans = playerLi.querySelectorAll('[data-testid^="pod-seat-"]')
      expect(seatSpans).toHaveLength(0)
    })

    it('sorts players with null seatNumbers using the ?? 0 fallback', () => {
      const players = [
        makePlayer({ playerId: 'p2', playerName: 'Bob', seatNumber: 2 }),
        makePlayer({ playerId: 'p1', playerName: 'Alice', seatNumber: null }),
        makePlayer({ playerId: 'p3', playerName: 'Charlie', seatNumber: 1 }),
      ]

      render(
        <PodCard
          podNumber={1}
          isBye={false}
          players={players}
          currentPlayerId={null}
        />
      )

      // Alice has null seatNumber (treated as 0), so should be first
      const listItems = screen.getByTestId('pod-card-1').querySelectorAll('li')
      expect(listItems).toHaveLength(3)
      expect(listItems[0]).toHaveTextContent('Alice')
      expect(listItems[1]).toHaveTextContent('Charlie')
      expect(listItems[2]).toHaveTextContent('Bob')
    })
  })
})
