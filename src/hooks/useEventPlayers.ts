import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types/database'

export function useEventPlayers(eventId: string) {
  return useQuery<Player[]>({
    queryKey: ['players', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Player[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })
}
