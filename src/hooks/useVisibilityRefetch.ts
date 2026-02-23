import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useVisibilityRefetch(eventId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!eventId) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['players', eventId] })
        queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [eventId, queryClient])
}
