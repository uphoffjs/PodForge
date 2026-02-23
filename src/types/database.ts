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
