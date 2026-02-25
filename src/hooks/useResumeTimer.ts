import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface ResumeTimerParams {
  passphrase: string
}

export function useResumeTimer(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase }: ResumeTimerParams) => {
      const { error } = await supabase.rpc('resume_timer', {
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
      if (message.includes('passphrase') || message.includes('invalid')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to resume timer')
      }
    },
  })
}
