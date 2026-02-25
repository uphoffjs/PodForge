export type Event = {
  id: string
  name: string
  status: 'active' | 'ended'
  created_at: string
}

export type Player = {
  id: string
  event_id: string
  name: string
  status: 'active' | 'dropped'
  created_at: string
}

export type Round = {
  id: string
  event_id: string
  round_number: number
  created_at: string
}

export type Pod = {
  id: string
  round_id: string
  pod_number: number
  is_bye: boolean
}

export type PodPlayer = {
  id: string
  pod_id: string
  player_id: string
  seat_number: number | null
}

export type RoundTimer = {
  id: string
  round_id: string
  event_id: string
  duration_minutes: number
  status: 'running' | 'paused' | 'cancelled'
  started_at: string
  remaining_seconds: number | null
  paused_at: string | null
  expires_at: string
  created_at: string
}
