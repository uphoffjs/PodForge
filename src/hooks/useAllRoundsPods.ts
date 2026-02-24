import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PodWithPlayers } from '@/hooks/usePods'

export function useAllRoundsPods(eventId: string, roundIds: string[]) {
  return useQuery<PodWithPlayers[]>({
    queryKey: ['allRoundsPods', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pods')
        .select('*, pod_players(*, players(*))')
        .in('round_id', roundIds)
        .order('pod_number')

      if (error) throw error
      return data as PodWithPlayers[]
    },
    enabled: roundIds.length > 0,
    staleTime: 30_000,
  })
}
