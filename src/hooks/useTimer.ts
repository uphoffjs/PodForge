import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RoundTimer } from '@/types/database'

export function useTimer(eventId: string) {
  return useQuery<RoundTimer | null>({
    queryKey: ['timer', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_timers')
        .select('*')
        .eq('event_id', eventId)
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return (data as RoundTimer) ?? null
    },
    enabled: !!eventId,
    staleTime: 5_000,
  })
}
