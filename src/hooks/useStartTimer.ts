import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface StartTimerParams {
  passphrase: string
}

export function useStartTimer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase }: StartTimerParams) => {
      const { error } = await supabase.rpc('start_timer', {
        p_event_id: eventId,
        p_passphrase: passphrase,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', eventId] })
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('invalid passphrase')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to start timer')
      }
    },
  })
}
