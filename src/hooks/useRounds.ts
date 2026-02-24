import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Round } from '@/types/database'

export function useRounds(eventId: string) {
  return useQuery<Round[]>({
    queryKey: ['rounds', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('event_id', eventId)
        .order('round_number', { ascending: false })

      if (error) throw error
      return data as Round[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })
}
