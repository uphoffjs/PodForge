import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function useJoinEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('players')
        .insert({ event_id: eventId, name })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', eventId] })
      toast.success('Joined the event!')
    },
    onError: (error: { code?: string; message?: string }) => {
      if (error?.code === '23505') {
        toast.error('That name is already taken. Try another!')
      } else {
        toast.error('Failed to join. Please try again.')
      }
    },
  })
}
