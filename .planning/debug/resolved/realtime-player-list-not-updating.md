---
status: resolved
trigger: "realtime-player-list-not-updating: Player list does not update in real time when a new player joins from another browser"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:08:00Z
---

## Current Focus

hypothesis: CONFIRMED - Missing REPLICA IDENTITY FULL on tables with non-PK filter columns
test: Migration created, code updated, all 303 tests pass. Need to apply migration to hosted DB.
expecting: After applying migration, Realtime subscriptions will deliver change events matching non-PK filters
next_action: User must apply migration to hosted Supabase instance (database password required)

## Symptoms

expected: When a player joins from another browser, the player list on all connected clients should update automatically in real time via Supabase Realtime subscriptions
actual: Player list stays stale until manual page refresh. New player appears after refresh, confirming data is saved correctly. No console errors.
errors: None visible in browser console
reproduction: 1) Open app in browser, create event. 2) Open same event URL in incognito, join with name. 3) Regular window does NOT update until manual refresh.
started: First time testing real-time functionality

## Eliminated

- hypothesis: Supabase client config (worker: true, heartbeatCallback) causing silent failures
  evidence: Both options are valid in @supabase/realtime-js v2.97.0 - confirmed by reading source types and official docs
  timestamp: 2026-02-25T00:02:00Z

- hypothesis: RLS blocking Realtime event delivery
  evidence: Migration has `USING (true)` SELECT policy for anon on players table - fully permissive
  timestamp: 2026-02-25T00:02:00Z

- hypothesis: Publication not including players table
  evidence: Migration SQL has `ALTER PUBLICATION supabase_realtime ADD TABLE players;` - correctly configured
  timestamp: 2026-02-25T00:02:00Z

- hypothesis: Query key mismatch between subscription invalidation and query
  evidence: useEventChannel invalidates ['players', eventId], useEventPlayers uses queryKey ['players', eventId] - exact match
  timestamp: 2026-02-25T00:02:00Z

## Evidence

- timestamp: 2026-02-25T00:01:00Z
  checked: Migration 00001 - publication setup
  found: `ALTER PUBLICATION supabase_realtime ADD TABLE events;` and `ALTER PUBLICATION supabase_realtime ADD TABLE players;` present
  implication: Publication is correctly configured in migration SQL

- timestamp: 2026-02-25T00:01:00Z
  checked: Migration 00001 - RLS policies
  found: `CREATE POLICY "Anyone can read players" ON players FOR SELECT TO anon USING (true);` present
  implication: RLS allows anon SELECT on players - should not block Realtime

- timestamp: 2026-02-25T00:01:00Z
  checked: useEventChannel.ts - subscription code
  found: Subscribes to postgres_changes on players table filtered by event_id, invalidates ['players', eventId] query key
  implication: Subscription structure looks correct, query key matches useEventPlayers

- timestamp: 2026-02-25T00:01:00Z
  checked: useEventPlayers.ts - query key
  found: Uses queryKey ['players', eventId] with staleTime 30_000
  implication: Query key matches what useEventChannel invalidates

- timestamp: 2026-02-25T00:01:00Z
  checked: Supabase client config (lib/supabase.ts)
  found: Uses `worker: true` in realtime config and a `heartbeatCallback` - both valid options for @supabase/realtime-js v2.97.0
  implication: Client config is correct, not the issue

- timestamp: 2026-02-25T00:03:00Z
  checked: useEventChannel.ts filter columns vs table primary keys
  found: players table PK is `id` (UUID), but filter uses `event_id=eq.${eventId}` which is a FK, NOT the PK. rounds table similarly filtered by event_id (not PK).
  implication: CRITICAL - Default replica identity (DEFAULT) only includes PK columns in WAL. Supabase Realtime cannot match the event_id filter because event_id is not in the WAL record. Events are silently dropped.

- timestamp: 2026-02-25T00:04:00Z
  checked: Supabase docs and community discussions on postgres_changes filters
  found: Official docs confirm: "If you're filtering on a non-PK column, you need: ALTER TABLE ... REPLICA IDENTITY FULL; Otherwise Realtime can't see that column's value in the change event to apply your filter."
  implication: ROOT CAUSE CONFIRMED - Missing REPLICA IDENTITY FULL on players and rounds tables

- timestamp: 2026-02-25T00:04:30Z
  checked: All filter columns in useEventChannel.ts
  found: players -> filter event_id (NOT PK, NEEDS FULL), events -> filter id (IS PK, OK), rounds -> filter event_id (NOT PK, NEEDS FULL), pods -> no filter (OK), pod_players -> no filter (OK)
  implication: Fix needed on players and rounds tables only

- timestamp: 2026-02-25T00:06:00Z
  checked: Full test suite after code change
  found: 303/303 tests pass across 26 test files
  implication: Code change (subscribe status callback) is safe, no regressions

- timestamp: 2026-02-25T00:07:00Z
  checked: Supabase CLI push attempt
  found: CLI authenticated and project linked (mhzgbchytmwduikejmio), but database password required for push
  implication: User must provide database password or apply migration manually via Dashboard SQL Editor

## Resolution

root_cause: Tables `players` and `rounds` use default REPLICA IDENTITY (primary key only), but useEventChannel.ts filters Realtime subscriptions on `event_id` which is a foreign key column. PostgreSQL WAL only includes PK columns by default, so Supabase Realtime cannot evaluate the `event_id=eq.{eventId}` filter and silently drops all change events. This explains why: (1) no errors are visible, (2) data saves correctly, (3) realtime events never arrive, and (4) manual refresh works fine.
fix: Created migration 00003_realtime_replica_identity.sql with REPLICA IDENTITY FULL on players and rounds tables. Also added subscribe() status callback to useEventChannel.ts for better observability.
verification: PENDING - Migration needs to be applied to hosted database
files_changed:
  - supabase/migrations/00003_realtime_replica_identity.sql (NEW)
  - src/hooks/useEventChannel.ts (MODIFIED - added subscribe status callback)
