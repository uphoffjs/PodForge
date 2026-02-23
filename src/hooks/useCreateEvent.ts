import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface CreateEventParams {
  name: string
  passphrase: string
}

export function useCreateEvent() {
  return useMutation({
    mutationFn: async ({ name, passphrase }: CreateEventParams) => {
      const { data, error } = await supabase.rpc('create_event', {
        p_name: name,
        p_passphrase: passphrase,
      })

      if (error) throw error

      // RPC returns the UUID directly as a string
      return data as string
    },
    onError: () => {
      toast.error('Failed to create event. Please try again.')
    },
  })
}
