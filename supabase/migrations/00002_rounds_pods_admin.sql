-- PodForge: Rounds, Pods, Pod Players Schema + Admin RPC Functions
-- Tables, RLS, Realtime Publication, RPC Functions for admin actions

-- =============================================================================
-- Tables
-- =============================================================================

-- Rounds table
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, round_number)
);

-- Pods table
CREATE TABLE pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  pod_number INTEGER NOT NULL,
  is_bye BOOLEAN DEFAULT false
);

-- Pod Players table
CREATE TABLE pod_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seat_number INTEGER
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_players ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies (public read only; all writes via SECURITY DEFINER RPCs)
-- =============================================================================

CREATE POLICY "Anyone can read rounds"
  ON rounds FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can read pods"
  ON pods FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can read pod_players"
  ON pod_players FOR SELECT TO anon
  USING (true);

-- =============================================================================
-- Update players RLS policy for admin operations (reactivate requires 'active')
-- =============================================================================

-- Drop old policy that only allows updating to 'dropped'
DROP POLICY "Players can drop themselves via RPC" ON players;

-- New policy allows updating to 'active' or 'dropped' (for both self-drop and admin reactivate)
CREATE POLICY "Admin can update player status via RPC"
  ON players FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status IN ('active', 'dropped'));

-- =============================================================================
-- Realtime Publication
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE pods;
ALTER PUBLICATION supabase_realtime ADD TABLE pod_players;

-- =============================================================================
-- RPC Functions (all SECURITY DEFINER with correct search_path for pgcrypto)
-- =============================================================================

-- Generate round: creates round + pods + pod_players atomically
CREATE OR REPLACE FUNCTION generate_round(
  p_event_id UUID,
  p_passphrase TEXT,
  p_pod_assignments JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_event_status TEXT;
  v_active_count INTEGER;
  v_round_number INTEGER;
  v_round_id UUID;
  v_pod JSONB;
  v_pod_id UUID;
  v_player JSONB;
BEGIN
  -- Validate passphrase
  SELECT passphrase_hash, status INTO v_hash, v_event_status
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF crypt(p_passphrase, v_hash) != v_hash THEN
    RAISE EXCEPTION 'Invalid passphrase';
  END IF;

  -- Validate event is active
  IF v_event_status != 'active' THEN
    RAISE EXCEPTION 'Event has ended';
  END IF;

  -- Count active players
  SELECT COUNT(*) INTO v_active_count
  FROM players
  WHERE event_id = p_event_id AND status = 'active';

  IF v_active_count < 4 THEN
    RAISE EXCEPTION 'Fewer than 4 active players';
  END IF;

  -- Determine next round number
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_round_number
  FROM rounds
  WHERE event_id = p_event_id;

  -- Insert round
  INSERT INTO rounds (event_id, round_number)
  VALUES (p_event_id, v_round_number)
  RETURNING id INTO v_round_id;

  -- Iterate pod assignments
  FOR v_pod IN SELECT * FROM jsonb_array_elements(p_pod_assignments)
  LOOP
    -- Insert pod
    INSERT INTO pods (round_id, pod_number, is_bye)
    VALUES (v_round_id, (v_pod->>'pod_number')::INTEGER, (v_pod->>'is_bye')::BOOLEAN)
    RETURNING id INTO v_pod_id;

    -- Insert pod players
    FOR v_player IN SELECT * FROM jsonb_array_elements(v_pod->'players')
    LOOP
      INSERT INTO pod_players (pod_id, player_id, seat_number)
      VALUES (
        v_pod_id,
        (v_player->>'player_id')::UUID,
        CASE WHEN v_player->>'seat_number' IS NULL THEN NULL
             ELSE (v_player->>'seat_number')::INTEGER
        END
      );
    END LOOP;
  END LOOP;

  RETURN v_round_number;
END;
$$;

-- Remove player: admin drops a player
CREATE OR REPLACE FUNCTION remove_player(
  p_event_id UUID,
  p_passphrase TEXT,
  p_player_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Validate passphrase
  SELECT passphrase_hash INTO v_hash
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF crypt(p_passphrase, v_hash) != v_hash THEN
    RAISE EXCEPTION 'Invalid passphrase';
  END IF;

  -- Update player status to dropped
  UPDATE players
  SET status = 'dropped'
  WHERE id = p_player_id AND event_id = p_event_id AND status = 'active';
END;
$$;

-- Reactivate player: admin restores a dropped player
CREATE OR REPLACE FUNCTION reactivate_player(
  p_event_id UUID,
  p_passphrase TEXT,
  p_player_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Validate passphrase
  SELECT passphrase_hash INTO v_hash
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF crypt(p_passphrase, v_hash) != v_hash THEN
    RAISE EXCEPTION 'Invalid passphrase';
  END IF;

  -- Update player status to active
  UPDATE players
  SET status = 'active'
  WHERE id = p_player_id AND event_id = p_event_id AND status = 'dropped';
END;
$$;

-- End event: admin ends the event
CREATE OR REPLACE FUNCTION end_event(
  p_event_id UUID,
  p_passphrase TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Validate passphrase
  SELECT passphrase_hash INTO v_hash
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF crypt(p_passphrase, v_hash) != v_hash THEN
    RAISE EXCEPTION 'Invalid passphrase';
  END IF;

  -- End the event
  UPDATE events
  SET status = 'ended'
  WHERE id = p_event_id AND status = 'active';
END;
$$;
