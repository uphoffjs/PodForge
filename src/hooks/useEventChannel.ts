import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEventChannel(eventId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['players', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rounds', eventId] })
          queryClient.invalidateQueries({ queryKey: ['currentRound', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pods',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pods'] })
          queryClient.invalidateQueries({ queryKey: ['allRoundsPods', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pod_players',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pods'] })
          queryClient.invalidateQueries({ queryKey: ['allRoundsPods', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_timers',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['timer', eventId] })
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useEventChannel] Realtime channel error:', err?.message)
        }
        if (status === 'TIMED_OUT') {
          console.warn('[useEventChannel] Realtime channel subscription timed out')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, queryClient])
}
