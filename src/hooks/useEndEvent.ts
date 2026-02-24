import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface EndEventParams {
  passphrase: string
}

export function useEndEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase }: EndEventParams) => {
      const { error } = await supabase.rpc('end_event', {
        p_event_id: eventId,
        p_passphrase: passphrase,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      toast.success('Event ended')
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('passphrase') || message.includes('invalid')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to end event. Please try again.')
      }
    },
  })
}
