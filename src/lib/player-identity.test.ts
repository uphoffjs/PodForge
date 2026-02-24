import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredPlayerId, storePlayerId, clearPlayerId } from './player-identity'

describe('player-identity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getStoredPlayerId', () => {
    it('returns the stored player ID for a given event', () => {
      localStorage.setItem('podforge_player_event-123', 'player-abc')

      const result = getStoredPlayerId('event-123')

      expect(result).toBe('player-abc')
    })

    it('returns null when no player ID is stored for the event', () => {
      const result = getStoredPlayerId('nonexistent-event')

      expect(result).toBeNull()
    })
  })

  describe('storePlayerId', () => {
    it('saves the player ID with the correct key format podforge_player_{eventId}', () => {
      storePlayerId('event-456', 'player-xyz')

      expect(localStorage.getItem('podforge_player_event-456')).toBe('player-xyz')
    })

    it('overwrites a previously stored player ID for the same event', () => {
      storePlayerId('event-456', 'player-first')
      storePlayerId('event-456', 'player-second')

      expect(localStorage.getItem('podforge_player_event-456')).toBe('player-second')
    })
  })

  describe('clearPlayerId', () => {
    it('removes the player ID for the specified event', () => {
      localStorage.setItem('podforge_player_event-789', 'player-toremove')

      clearPlayerId('event-789')

      expect(localStorage.getItem('podforge_player_event-789')).toBeNull()
    })

    it('does not throw when clearing a key that does not exist', () => {
      expect(() => clearPlayerId('no-such-event')).not.toThrow()
    })
  })

  describe('key isolation between events', () => {
    it('uses separate keys for different eventIds', () => {
      storePlayerId('event-A', 'player-1')
      storePlayerId('event-B', 'player-2')

      expect(getStoredPlayerId('event-A')).toBe('player-1')
      expect(getStoredPlayerId('event-B')).toBe('player-2')
    })

    it('clearing one event does not affect another', () => {
      storePlayerId('event-A', 'player-1')
      storePlayerId('event-B', 'player-2')

      clearPlayerId('event-A')

      expect(getStoredPlayerId('event-A')).toBeNull()
      expect(getStoredPlayerId('event-B')).toBe('player-2')
    })
  })
})
