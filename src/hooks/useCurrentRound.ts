import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Round } from '@/types/database'

export function useCurrentRound(eventId: string) {
  return useQuery<Round | null>({
    queryKey: ['currentRound', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('event_id', eventId)
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return (data as Round) ?? null
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })
}
