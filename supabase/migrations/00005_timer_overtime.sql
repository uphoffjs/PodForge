-- PodForge: Timer Overtime — 80+20 three-phase timer, server-authoritative
-- Additive, backward compatible. Three edits only:
--   1. Add round_timers.overtime_seconds (0 = plain timer; 1200 = 80+20)
--   2. Redefine generate_round (dropping the stale 00002/00004 overloads) to persist overtime_seconds
--   3. Remove the GREATEST(0, …) clamp in pause_timer so paused remaining is SIGNED (preserves overtime/count-up position)
-- resume_timer / extend_timer / cancel_timer need NO change once remaining_seconds is signed.

-- =============================================================================
-- 1. Add overtime_seconds column (additive — existing rows backfill to 0)
-- =============================================================================

ALTER TABLE round_timers
  ADD COLUMN overtime_seconds INTEGER NOT NULL DEFAULT 0;  -- 0 = plain timer (today's behavior); 1200 = 80+20

-- No publication/replica change needed — round_timers already has REPLICA IDENTITY FULL
-- and is in the supabase_realtime publication (00004:35,41); the new column rides it.

-- =============================================================================
-- 2. Redefine generate_round — drop stale overloads first (prevents PGRST203)
-- =============================================================================

-- CREATE OR REPLACE keys on name + arg types, so prior signatures persist as overloads.
-- Drop both before recreating, or PostgREST throws PGRST203 "Could not choose the best
-- candidate function" at runtime.
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb);            -- 00002 overload
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb, integer);  -- 00004 overload

CREATE OR REPLACE FUNCTION generate_round(
  p_event_id UUID,
  p_passphrase TEXT,
  p_pod_assignments JSONB,
  p_timer_duration_minutes INTEGER DEFAULT NULL,
  p_overtime_minutes INTEGER DEFAULT 0
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
  -- Validate overtime bounds (no negative or absurd values)
  IF p_overtime_minutes < 0 OR p_overtime_minutes > 240 THEN
    RAISE EXCEPTION 'Invalid overtime minutes: %', p_overtime_minutes;
  END IF;

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

    INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, expires_at)
    VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
            COALESCE(p_overtime_minutes, 0) * 60,
            now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
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
-- 3. Redefine pause_timer — remove GREATEST(0, …) clamp (store SIGNED remaining)
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

  -- Pause: store SIGNED remaining seconds (no GREATEST(0, …) clamp — preserves
  -- overtime/count-up position; negative means past the main expiry), set paused_at, change status
  UPDATE round_timers
  SET
    remaining_seconds = EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER,
    paused_at = now(),
    status = 'paused'
  WHERE id = v_timer_id;
END;
$$;
