import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { clearPlayerId } from '@/lib/player-identity'

export function useDropPlayer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase.rpc('drop_player', {
        p_player_id: playerId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      clearPlayerId(eventId)
      queryClient.invalidateQueries({ queryKey: ['players', eventId] })
      toast.success("You've left the event")
    },
    onError: () => {
      toast.error('Failed to leave event. Please try again.')
    },
  })
}
