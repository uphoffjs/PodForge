---
phase: 09-timer-ui-admin-controls
plan: 01
subsystem: database
tags: [postgres, supabase, plpgsql, migration, timer, rpc, security-definer, pending]

# Dependency graph
requires:
  - phase: 04 (timer-system, migration 00004)
    provides: round_timers table + resume_timer/cancel_timer verbatim bodies this plan mirrors/redefines
  - phase: 08 (timer-migration-core-engine, migration 00005)
    provides: overtime_seconds column + generate_round(p_overtime_minutes) signature this plan redefines in place
provides:
  - "round_timers.status CHECK extended to allow 'pending' (additive; existing rows unaffected)"
  - "generate_round redefined (identical 00005 signature) — inserts status='pending' for 80+20 (p_overtime_minutes > 0), 'running' for plain 60/90/120; cancel sweep widened to clear prior pending rows"
  - "new start_timer(p_event_id, p_passphrase) RPC — passphrase-gated SECURITY DEFINER; flips latest pending timer to 'running', sets started_at = now() and a real expires_at = now() + duration_minutes"
  - "cancel_timer redefined — timer-find widened to also cancel a not-yet-started 'pending' timer"
affects: [phase-09-plan-02-client-data-layer, useStartTimer, useTimer filter, useCountdown not-started branch, database.ts RoundTimer status union, TimerControls pending branch, AdminControls 80+20 preset]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Not-started lifecycle via explicit 'pending' status (not a paused heuristic) — server-authoritative, survives refresh, Realtime-synced; start_timer flips it to running"
    - "Conditional INSERT status discriminator: CASE WHEN COALESCE(p_overtime_minutes,0) > 0 THEN 'pending' ELSE 'running' END — client cannot set status directly"
    - "In-place CREATE OR REPLACE (no DROP) when the signature is unchanged — generate_round keeps its 00005 5-arg signature, so no overload/PGRST203 concern this phase"
    - "Additive CHECK widening via DROP CONSTRAINT + ADD CONSTRAINT on the default-named round_timers_status_check"

key-files:
  created:
    - supabase/migrations/00006_timer_pending.sql
  modified: []

key-decisions:
  - "Chose Option (a) — a new 'pending' status — over pre-paused (b) or deferred-creation (c): smallest correct additive change that stays server-authoritative and persistent, keeps expires_at NOT NULL (no nullable migration), and avoids the not-started/paused ambiguity (RESEARCH)"
  - "generate_round cancel sweep widened to IN ('running','paused','pending') so a prior un-started pending timer is swept (Pitfall 1)"
  - "start_timer mirrors resume_timer verbatim (header, search_path, crypt() passphrase block, ORDER BY created_at DESC LIMIT 1 + null-guard RAISE) — only the status filter ('pending') and UPDATE body differ; overtime_seconds left untouched"
  - "cancel_timer widened to accept 'pending' (locked decision: admin may cancel a generated-but-not-started round); pause/resume/extend deliberately untouched"
  - "SQL behaviors verified via documented manual checkpoint (no pgTAP/SQL harness; supabase.rpc mocked in hook tests) — same approach as Phase 8 08-01"

patterns-established:
  - "Pattern: explicit not-started 'pending' timer status + start_timer RPC (vs pre-paused heuristics)"
  - "Pattern: conditional server-side status discriminator from p_overtime_minutes (no client-set status)"

requirements-contributed: [TIMER-02, TIMER-07]

# Metrics
duration: ~10min
completed: 2026-06-28
---

# Phase 9 Plan 01: Timer Pending Lifecycle Migration Summary

**Additive migration 00006 lands the not-started 80+20 timer lifecycle — extends the `round_timers.status` CHECK to allow `'pending'`, makes `generate_round` insert `pending` for 80+20 (plain 60/90/120 stay `running`), adds a passphrase-gated `start_timer` RPC that flips the latest pending timer to `running` with a real `expires_at`, and widens `cancel_timer` to cancel a not-yet-started timer; applied to the live Supabase DB.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-28 (Tasks 1-2 complete + committed; Task 3 human-verify checkpoint PENDING)
- **Tasks:** 2 of 3 implemented and committed; Task 3 is a BLOCKING human-verify checkpoint awaiting user confirmation
- **Files modified:** 1 created

## Accomplishments
- `round_timers.status` CHECK widened to `('running', 'paused', 'cancelled', 'pending')` via DROP + ADD CONSTRAINT on the default-named `round_timers_status_check` (additive — existing rows unaffected).
- `generate_round` redefined in place (CREATE OR REPLACE, identical 00005 signature — no DROP/overload concern): cancel sweep widened to `IN ('running','paused','pending')`; timer INSERT now supplies a conditional status `CASE WHEN COALESCE(p_overtime_minutes,0) > 0 THEN 'pending' ELSE 'running' END`. Plain 60/90/120 behavior unchanged.
- New `start_timer(p_event_id, p_passphrase)` RPC added — SECURITY DEFINER + `SET search_path = public, extensions`, verbatim `crypt(p_passphrase, v_hash)` passphrase gate, `RAISE EXCEPTION 'No pending timer found'` null-guard; UPDATE sets `started_at = now()`, `expires_at = now() + (duration_minutes || ' minutes')::INTERVAL`, `status = 'running'`. `overtime_seconds` untouched.
- `cancel_timer` redefined with its timer-find WHERE widened to `IN ('running','paused','pending')` — an admin can cancel a generated-but-not-started round.
- `pause_timer`, `resume_timer`, `extend_timer` deliberately NOT restated.
- Migration applied to the live (production, linked) Supabase database via `supabase db push --linked` ("Finished supabase db push"; re-run confirms "Remote database is up to date").

## Task Commits

1. **Task 1: Write migration 00006 (status CHECK + generate_round conditional status + start_timer RPC + cancel_timer widen)** — `5eef415` (feat). Passes the plan grep gate (CHECK extension, `start_timer` with `crypt`, conditional status, cancel widen, no restated pause/resume/extend).
2. **Task 2: [BLOCKING] Apply migration 00006 to the live database** — no file artifact (DB side-effect only; migration file committed under Task 1). `supabase db push --linked` applied `00006` cleanly; idempotent re-run reports "Remote database is up to date."
3. **Task 3: [CHECKPOINT] Verify migration 00006 SQL behaviors on the live DB** — PENDING human-verify (see Next Phase Readiness). Autonomous: false; not machine-testable here.

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `supabase/migrations/00006_timer_pending.sql` — Additive migration: status CHECK widened to `pending`; `generate_round` conditional-status redefinition (in-place, identical signature); new passphrase-gated `start_timer` RPC; `cancel_timer` widened to pending. pause/resume/extend untouched.

## Decisions Made
- Chose the explicit `'pending'` status (Option a) over pre-paused heuristics (b) or deferred row creation (c) — the smallest correct additive change that stays server-authoritative, keeps `expires_at` NOT NULL, and avoids not-started/paused ambiguity that would be fragile in a 100%-Stryker codebase.
- Widened the `generate_round` cancel sweep to include `'pending'` (Pitfall 1) so two un-started 80+20 generations cannot leave two live pending rows.
- Mirrored `resume_timer` verbatim for `start_timer` (header, search_path, passphrase block, null-guard) — only the status filter and UPDATE differ; minimizes divergence and preserves the established security controls.
- Left `pause_timer`/`resume_timer`/`extend_timer` unmodified — they need no change for the pending lifecycle; restating them would only risk regressions.

## Deviations from Plan

None - plan executed exactly as written (four locked edits; pause/resume/extend untouched).

## Issues Encountered
- `supabase db push --linked` printed an interactive `[Y/n]` prompt but proceeded non-interactively and applied the migration on the first attempt (`SUPABASE_DB_PASSWORD` sourced from `.env`). No destructive retry was needed.

## User Setup Required
None new — `SUPABASE_DB_PASSWORD` already present in `.env` (gitignored) and used for the non-interactive push.

## Threat Surface
All three trust-boundary mitigations from the plan threat register are in place: `start_timer` reuses the verbatim `crypt(p_passphrase, passphrase_hash)` validation + SECURITY DEFINER + fixed `search_path` (T-09-01); status is derived server-side via `CASE … COALESCE(p_overtime_minutes,0) > 0`, not client-set (T-09-02); `cancel_timer`'s existing passphrase gate is unchanged, only the status filter widened — no new write path or bypass (T-09-03). No new security-relevant surface beyond the planned threat model.

## Next Phase Readiness

**BLOCKING human-verify checkpoint (Task 3) — PENDING.** Migration 00006 is applied to the live DB, but the SQL behaviors are not machine-testable in this repo (no pgTAP/SQL harness; `supabase.rpc` is mocked in hook tests). The user must run the six checks below against the database the migration was pushed to (Supabase SQL editor or psql) and confirm:

1. **CHECK constraint:** `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='round_timers_status_check';` → list includes `'pending'`.
2. **Pending insert (80+20):** `generate_round(... p_overtime_minutes => 20)` for a test event with ≥4 active players, then select the newest `round_timers` row → `status='pending'`, `overtime_seconds=1200`.
3. **Plain stays running:** `generate_round(...)` with `p_overtime_minutes` omitted/0 → newest row `status='running'`.
4. **start_timer flips:** `start_timer(<test event>, '<valid passphrase>')`, re-select the pending row → `status='running'`, `expires_at ≈ now() + interval '80 minutes'` (in the future), `started_at` set.
5. **Passphrase gating:** `start_timer(<test event>, 'wrong')` → RAISE `Invalid passphrase`; `start_timer` for an event with no pending timer → RAISE `No pending timer found`.
6. **Cancel-while-pending:** generate a fresh 80+20 round (status `pending`), `cancel_timer(<test event>, '<valid passphrase>')`, re-select → `status='cancelled'`.

On approval, Plan 09-02 (client data layer: `RoundTimer.status` union + `useTimer` filter + `useCountdown` not-started branch + `useStartTimer` hook) can proceed against this confirmed contract.

---
*Phase: 09-timer-ui-admin-controls*
*Completed: 2026-06-28 (Tasks 1-2 done; Task 3 human-verify PENDING)*

## Self-Check: PASSED
- FOUND: supabase/migrations/00006_timer_pending.sql
- FOUND: .planning/phases/09-timer-ui-admin-controls/09-01-SUMMARY.md
- FOUND commit: 5eef415 (Task 1)
