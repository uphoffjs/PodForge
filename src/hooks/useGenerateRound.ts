import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export type PodAssignment = {
  pod_number: number
  is_bye: boolean
  players: { player_id: string; seat_number: number | null }[]
}

interface GenerateRoundParams {
  passphrase: string
  podAssignments: PodAssignment[]
}

export function useGenerateRound(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ passphrase, podAssignments }: GenerateRoundParams) => {
      const { data, error } = await supabase.rpc('generate_round', {
        p_event_id: eventId,
        p_passphrase: passphrase,
        p_pod_assignments: podAssignments,
      })

      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', eventId] })
      queryClient.invalidateQueries({ queryKey: ['currentRound', eventId] })
      queryClient.invalidateQueries({ queryKey: ['pods'] })
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('passphrase') || message.includes('invalid')) {
        toast.error('Invalid passphrase')
      } else if (message.includes('fewer than 4')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to generate round. Please try again.')
      }
    },
  })
}
