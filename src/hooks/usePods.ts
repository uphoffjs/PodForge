import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Pod, PodPlayer, Player } from '@/types/database'

export type PodWithPlayers = Pod & {
  pod_players: (PodPlayer & { players: Player })[]
}

export function usePods(roundId: string | undefined) {
  return useQuery<PodWithPlayers[]>({
    queryKey: ['pods', roundId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pods')
        .select('*, pod_players(*, players(*))')
        .eq('round_id', roundId!)
        .order('pod_number')

      if (error) throw error
      return data as PodWithPlayers[]
    },
    enabled: !!roundId,
    staleTime: 30_000,
  })
}
