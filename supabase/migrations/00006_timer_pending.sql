-- PodForge: Timer Pending — not-started 80+20 lifecycle, server-authoritative
-- Additive, backward compatible. Four edits only:
--   1. Extend the round_timers.status CHECK to allow 'pending'
--   2. Redefine generate_round (identical 00005 signature) so 80+20 (p_overtime_minutes > 0)
--      inserts status='pending'; plain 60/90/120 stay 'running' (unchanged). Cancel sweep
--      also clears prior un-started 'pending' rows.
--   3. Add a passphrase-gated start_timer RPC that flips the latest pending timer to
--      'running', setting started_at = now() and a real expires_at = now() + duration.
--   4. Redefine cancel_timer (identical 00004 body) widening its timer-find to also cancel
--      a not-yet-started 'pending' timer.
-- pause_timer / resume_timer / extend_timer need NO change.

-- =============================================================================
-- 1. Extend the status CHECK to include 'pending' (additive — existing rows unaffected)
-- =============================================================================

-- The inline CHECK from 00004:13 gets the default Postgres name round_timers_status_check
-- (confirmed via `\d round_timers` — Pitfall 4). Drop + re-add to widen the allowed set.
ALTER TABLE round_timers DROP CONSTRAINT round_timers_status_check;
ALTER TABLE round_timers ADD CONSTRAINT round_timers_status_check
  CHECK (status IN ('running', 'paused', 'cancelled', 'pending'));

-- =============================================================================
-- 2. Redefine generate_round — conditional status (CREATE OR REPLACE, identical signature)
-- =============================================================================

-- Signature is IDENTICAL to 00005 (p_event_id, p_passphrase, p_pod_assignments,
-- p_timer_duration_minutes DEFAULT NULL, p_overtime_minutes DEFAULT 0), so CREATE OR REPLACE
-- replaces in place — NO DROP/overload removal needed this phase.
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
    -- Cancel any existing running/paused/pending timer for this event
    -- (Pitfall 1: a prior un-started 'pending' timer must also be swept)
    UPDATE round_timers SET status = 'cancelled'
    WHERE event_id = p_event_id AND status IN ('running', 'paused', 'pending');

    -- Conditional status: 80+20 (p_overtime_minutes > 0) starts 'pending' (admin starts it
    -- explicitly via start_timer); plain 60/90/120 keep today's immediate 'running' behavior.
    -- expires_at stays NOT NULL — a harmless placeholder while pending (the not-started card
    -- renders a static duration_minutes:00 and never reads it); start_timer overwrites it.
    INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, status, expires_at)
    VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
            COALESCE(p_overtime_minutes, 0) * 60,
            CASE WHEN COALESCE(p_overtime_minutes, 0) > 0 THEN 'pending' ELSE 'running' END,
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
-- 3. New start_timer RPC — flip the latest pending timer to running (mirror resume_timer)
-- =============================================================================

-- Structural analog: resume_timer (00004:193-239). Same SECURITY DEFINER header,
-- search_path, passphrase block, and SELECT ... ORDER BY created_at DESC LIMIT 1 + null-guard.
-- Only the status filter ('pending') and the UPDATE body differ.
CREATE OR REPLACE FUNCTION start_timer(p_event_id UUID, p_passphrase TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_timer_id UUID;
  v_duration INTEGER;
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

  -- Find latest pending (not-yet-started) timer for this event
  SELECT id, duration_minutes INTO v_timer_id, v_duration
  FROM round_timers
  WHERE event_id = p_event_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_timer_id IS NULL THEN
    RAISE EXCEPTION 'No pending timer found';
  END IF;

  -- Begin the main countdown: set started_at + a real expires_at, flip to running.
  -- overtime_seconds is left untouched.
  UPDATE round_timers
  SET started_at = now(),
      expires_at = now() + (v_duration || ' minutes')::INTERVAL,
      status = 'running'
  WHERE id = v_timer_id;
END;
$$;

-- =============================================================================
-- 4. Redefine cancel_timer — widen timer-find to also cancel a pending timer
-- =============================================================================

-- Copy of 00004:295-336 with ONE change: the timer-find WHERE now includes 'pending'
-- (locked decision: an admin may cancel a generated-but-not-yet-started round).
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

  -- Find active (running, paused, or pending) timer for this event
  SELECT id INTO v_timer_id
  FROM round_timers
  WHERE event_id = p_event_id AND status IN ('running', 'paused', 'pending')
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
