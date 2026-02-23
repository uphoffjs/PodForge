-- Commander Pod Pairer: Initial Schema
-- Tables, RLS, Column-Level Security, Realtime Publication, RPC Functions

-- =============================================================================
-- Extensions
-- =============================================================================

-- Enable pgcrypto for passphrase hashing (Supabase installs it in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================================
-- Tables
-- =============================================================================

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  passphrase_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 20),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, name)
);

-- =============================================================================
-- Row Level Security (CRITICAL: must be enabled at creation time, not retrofittable)
-- =============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Column-Level Security: hide passphrase_hash from anon role
-- =============================================================================

-- Revoke all SELECT access, then grant only safe columns
REVOKE SELECT ON events FROM anon;
GRANT SELECT (id, name, status, created_at) ON events TO anon;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Events: public read (required for Realtime to deliver change events to anon)
CREATE POLICY "Anyone can read events"
  ON events FOR SELECT TO anon
  USING (true);

-- Players: public read (required for Realtime)
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT TO anon
  USING (true);

-- Players: anyone can join an event (insert with active status)
CREATE POLICY "Anyone can join an event"
  ON players FOR INSERT TO anon
  WITH CHECK (status = 'active');

-- Players: can update own status to dropped (self-drop via RPC)
CREATE POLICY "Players can drop themselves via RPC"
  ON players FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'dropped');

-- =============================================================================
-- Realtime Publication (CRITICAL: without this, subscriptions silently get nothing)
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- =============================================================================
-- RPC Functions (all SECURITY DEFINER with correct search_path for pgcrypto)
-- =============================================================================

-- Create event with hashed passphrase
CREATE OR REPLACE FUNCTION create_event(
  p_name TEXT,
  p_passphrase TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (name, passphrase_hash)
  VALUES (p_name, crypt(p_passphrase, gen_salt('bf')))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Validate passphrase (used before admin actions)
CREATE OR REPLACE FUNCTION validate_passphrase(
  p_event_id UUID,
  p_passphrase TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT passphrase_hash INTO v_hash
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN v_hash = crypt(p_passphrase, v_hash);
END;
$$;

-- Self-drop: player updates own status to dropped
CREATE OR REPLACE FUNCTION drop_player(
  p_player_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players SET status = 'dropped'
  WHERE id = p_player_id AND status = 'active';
END;
$$;
