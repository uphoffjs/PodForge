const PLAYER_KEY_PREFIX = 'pod_pairer_player_'

export function getStoredPlayerId(eventId: string): string | null {
  return localStorage.getItem(`${PLAYER_KEY_PREFIX}${eventId}`)
}

export function storePlayerId(eventId: string, playerId: string): void {
  localStorage.setItem(`${PLAYER_KEY_PREFIX}${eventId}`, playerId)
}

export function clearPlayerId(eventId: string): void {
  localStorage.removeItem(`${PLAYER_KEY_PREFIX}${eventId}`)
}
