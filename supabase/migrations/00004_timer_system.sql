-- PodForge: Timer System — round_timers table, RLS, Realtime, timer RPC functions
-- Server-authoritative timer with pause/resume/extend/cancel via passphrase-gated RPCs

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE round_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE UNIQUE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remaining_seconds INTEGER,   -- NULL when running (calculate from expires_at - now()); set on pause
  paused_at TIMESTAMPTZ,       -- set when paused, cleared on resume
  expires_at TIMESTAMPTZ NOT NULL,  -- server-computed: started_at + duration (adjusted on resume/extend)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE round_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read round_timers"
  ON round_timers FOR SELECT TO anon
  USING (true);

-- =============================================================================
-- REPLICA IDENTITY for Realtime filtering on event_id (non-PK column)
-- =============================================================================

ALTER TABLE round_timers REPLICA IDENTITY FULL;

-- =============================================================================
-- Realtime Publication
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE round_timers;

-- =============================================================================
-- Modify generate_round to accept optional timer duration
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_round(
  p_event_id UUID,
  p_passphrase TEXT,
  p_pod_assignments JSONB,
  p_timer_duration_minutes INTEGER DEFAULT NULL
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

  -- Create timer if duration specified
  IF p_timer_duration_minutes IS NOT NULL AND p_timer_duration_minutes > 0 THEN
    -- Cancel any existing running/paused timer for this event
    UPDATE round_timers SET status = 'cancelled'
    WHERE event_id = p_event_id AND status IN ('running', 'paused');

    INSERT INTO round_timers (round_id, event_id, duration_minutes, expires_at)
    VALUES (v_round_id, p_event_id, p_timer_duration_minutes, now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
  END IF;

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

-- =============================================================================
-- Timer RPC Functions (all SECURITY DEFINER with passphrase validation)
-- =============================================================================

-- Pause timer: sets remaining_seconds from (expires_at - now()), paused_at, status = 'paused'
CREATE OR REPLACE FUNCTION pause_timer(
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
  v_timer_id UUID;
  v_expires_at TIMESTAMPTZ;
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

  -- Find running timer for this event
  SELECT id, expires_at INTO v_timer_id, v_expires_at
  FROM round_timers
  WHERE event_id = p_event_id AND status = 'running'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_timer_id IS NULL THEN
    RAISE EXCEPTION 'No running timer found';
  END IF;

  -- Pause: store remaining seconds, set paused_at, change status
  UPDATE round_timers
  SET
    remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER),
    paused_at = now(),
    status = 'paused'
  WHERE id = v_timer_id;
END;
$$;

-- Resume timer: recalculates expires_at from remaining_seconds, clears pause state
CREATE OR REPLACE FUNCTION resume_timer(
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
  v_timer_id UUID;
  v_remaining INTEGER;
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

  -- Find paused timer for this event
  SELECT id, remaining_seconds INTO v_timer_id, v_remaining
  FROM round_timers
  WHERE event_id = p_event_id AND status = 'paused'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_timer_id IS NULL THEN
    RAISE EXCEPTION 'No paused timer found';
  END IF;

  -- Resume: recalculate expires_at, clear pause state
  UPDATE round_timers
  SET
    expires_at = now() + (v_remaining * INTERVAL '1 second'),
    remaining_seconds = NULL,
    paused_at = NULL,
    status = 'running'
  WHERE id = v_timer_id;
END;
$$;

-- Extend timer: adds minutes to running timer's expires_at or paused timer's remaining_seconds
CREATE OR REPLACE FUNCTION extend_timer(
  p_event_id UUID,
  p_passphrase TEXT,
  p_minutes INTEGER DEFAULT 5
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_timer_id UUID;
  v_timer_status TEXT;
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

  -- Find active (running or paused) timer for this event
  SELECT id, status INTO v_timer_id, v_timer_status
  FROM round_timers
  WHERE event_id = p_event_id AND status IN ('running', 'paused')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_timer_id IS NULL THEN
    RAISE EXCEPTION 'No active timer found';
  END IF;

  IF v_timer_status = 'running' THEN
    -- Running: extend expires_at
    UPDATE round_timers
    SET expires_at = expires_at + (p_minutes || ' minutes')::INTERVAL
    WHERE id = v_timer_id;
  ELSE
    -- Paused: extend remaining_seconds
    UPDATE round_timers
    SET remaining_seconds = remaining_seconds + (p_minutes * 60)
    WHERE id = v_timer_id;
  END IF;
END;
$$;

-- Cancel timer: sets status to 'cancelled'
CREATE OR REPLACE FUNCTION cancel_timer(
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
  v_timer_id UUID;
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

  -- Find active (running or paused) timer for this event
  SELECT id INTO v_timer_id
  FROM round_timers
  WHERE event_id = p_event_id AND status IN ('running', 'paused')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_timer_id IS NULL THEN
    RAISE EXCEPTION 'No active timer found';
  END IF;

  -- Cancel
  UPDATE round_timers
  SET status = 'cancelled'
  WHERE id = v_timer_id;
END;
$$;
