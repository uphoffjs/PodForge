import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface ExtendTimerParams {
  passphrase: string
}

export function useExtendTimer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase }: ExtendTimerParams) => {
      const { error } = await supabase.rpc('extend_timer', {
        p_event_id: eventId,
        p_passphrase: passphrase,
        p_minutes: 5,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', eventId] })
      toast.success('+5 minutes added')
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('passphrase') || message.includes('invalid')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to extend timer')
      }
    },
  })
}
