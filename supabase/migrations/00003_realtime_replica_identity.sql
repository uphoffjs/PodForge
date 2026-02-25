-- PodForge: Fix Realtime subscriptions by setting REPLICA IDENTITY FULL
--
-- Problem: useEventChannel.ts filters postgres_changes on `event_id` (a FK column),
-- but default REPLICA IDENTITY only includes the primary key in WAL records.
-- Supabase Realtime cannot evaluate non-PK filters without REPLICA IDENTITY FULL,
-- causing change events to be silently dropped.
--
-- Affected tables:
--   - players:  filtered by event_id in Realtime subscription
--   - rounds:   filtered by event_id in Realtime subscription
--
-- Tables NOT affected (no non-PK filter or no filter at all):
--   - events:   filtered by id (which IS the PK) -- OK with default
--   - pods:     no filter in subscription -- OK
--   - pod_players: no filter in subscription -- OK

ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE rounds REPLICA IDENTITY FULL;
