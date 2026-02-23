import { useState, useCallback } from 'react'

const STORAGE_KEY_PREFIX = 'podforge_admin_'

function getStorageKey(eventId: string): string {
  return `${STORAGE_KEY_PREFIX}${eventId}`
}

export function useAdminAuth(eventId: string) {
  const [passphrase, setPassphraseState] = useState<string | null>(() => {
    return sessionStorage.getItem(getStorageKey(eventId))
  })

  const isAdmin = passphrase !== null

  const setPassphrase = useCallback(
    (newPassphrase: string) => {
      sessionStorage.setItem(getStorageKey(eventId), newPassphrase)
      setPassphraseState(newPassphrase)
    },
    [eventId]
  )

  const clearPassphrase = useCallback(() => {
    sessionStorage.removeItem(getStorageKey(eventId))
    setPassphraseState(null)
  }, [eventId])

  return {
    isAdmin,
    passphrase,
    setPassphrase,
    clearPassphrase,
  }
}
