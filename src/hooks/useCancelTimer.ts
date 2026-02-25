import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface CancelTimerParams {
  passphrase: string
}

export function useCancelTimer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase }: CancelTimerParams) => {
      const { error } = await supabase.rpc('cancel_timer', {
        p_event_id: eventId,
        p_passphrase: passphrase,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', eventId] })
      toast.success('Timer cancelled')
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('invalid passphrase')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to cancel timer')
      }
    },
  })
}
