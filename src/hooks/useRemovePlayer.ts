import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface RemovePlayerParams {
  passphrase: string
  playerId: string
}

export function useRemovePlayer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase, playerId }: RemovePlayerParams) => {
      const { error } = await supabase.rpc('remove_player', {
        p_event_id: eventId,
        p_passphrase: passphrase,
        p_player_id: playerId,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', eventId] })
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('invalid passphrase')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to remove player. Please try again.')
      }
    },
  })
}
