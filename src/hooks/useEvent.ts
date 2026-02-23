import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Event } from '@/types/database'

export function useEvent(eventId: string) {
  return useQuery<Event>({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, status, created_at')
        .eq('id', eventId)
        .single()

      if (error) throw error
      return data as Event
    },
    enabled: !!eventId,
  })
}
