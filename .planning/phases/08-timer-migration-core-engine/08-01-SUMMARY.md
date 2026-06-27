---
phase: 08-timer-migration-core-engine
plan: 01
subsystem: database
tags: [postgres, supabase, plpgsql, migration, timer, rpc, security-definer]

# Dependency graph
requires:
  - phase: 04 (timer-system, migration 00004)
    provides: round_timers table + generate_round/pause/resume/extend/cancel RPCs (the verbatim bodies this plan redefines)
provides:
  - "round_timers.overtime_seconds column (NOT NULL DEFAULT 0; 0=plain, 1200=80+20)"
  - "generate_round redefined with p_overtime_minutes param (bounds-checked, persists overtime_seconds) and stale 00002/00004 overloads dropped (no PGRST203)"
  - "pause_timer storing SIGNED remaining_seconds (GREATEST(0,…) clamp removed) — preserves overtime/count-up position across pause/resume"
affects: [phase-08-plan-02-useCountdown, phase-08-plan-03-notifications, phase-09-timer-ui, useGenerateRound, database.ts RoundTimer type]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overload-safe RPC redefinition: DROP FUNCTION IF EXISTS for every prior signature before CREATE OR REPLACE when adding a defaulted param (prevents PostgREST PGRST203)"
    - "Signed pause snapshot: store EXTRACT(EPOCH ...) without GREATEST(0,…) so paused remaining encodes overtime/count-up position; resume_timer/extend_timer work unchanged on negative values"
    - "Additive backward-compatible migration: NOT NULL DEFAULT column backfills existing rows, no data migration"

key-files:
  created:
    - supabase/migrations/00005_timer_overtime.sql
  modified: []

key-decisions:
  - "Only generate_round and pause_timer redefined; resume/extend/cancel left untouched (already correct once remaining_seconds is signed — Pattern 2)"
  - "p_overtime_minutes bounds-checked server-side (RAISE on <0 or >240) before passphrase validation order kept; value coerced via COALESCE(...,0)*60"
  - "SQL behaviors verified via documented manual checkpoint (RESEARCH Wave 0 option c) — repo has no pgTAP/SQL harness and supabase.rpc is mocked in hook tests"

patterns-established:
  - "Pattern: overload-safe RPC redefinition with explicit DROP FUNCTION IF EXISTS per signature"
  - "Pattern: signed pause snapshot (no clamp) to preserve three-phase timer position"

requirements-completed: [TIMER-03, TIMER-06]

# Metrics
duration: 6min
completed: 2026-06-27
---

# Phase 8 Plan 01: Timer Overtime Migration Summary

**Additive migration 00005 makes the 80+20 timer server-authoritative — adds `overtime_seconds`, redefines `generate_round` (dropping stale overloads) to persist it, and removes the `pause_timer` `GREATEST(0,…)` clamp so paused remaining is signed; applied to the live Supabase DB.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-27T21:38:00Z
- **Completed:** 2026-06-27 (all 3 tasks complete; Task 3 human-verify approved)
- **Tasks:** 3 of 3 complete (Task 3 human-verify checkpoint APPROVED — user verified file content + clean remote apply)
- **Files modified:** 1 created

## Accomplishments
- `round_timers.overtime_seconds INTEGER NOT NULL DEFAULT 0` added (existing rows backfill to 0 — plain timers unchanged).
- `generate_round` redefined: both stale overloads (`00002` 3-arg, `00004` 4-arg) dropped before recreate, new `p_overtime_minutes INTEGER DEFAULT 0` param with bounds check (RAISE on `<0` or `>240`), timer INSERT persists `overtime_seconds = COALESCE(p_overtime_minutes,0)*60`.
- `pause_timer` `GREATEST(0,…)` clamp removed — `remaining_seconds` is now signed, preserving overtime/count-up position across pause/resume (the single most important TIMER-06 fix).
- Migration applied to the live (production, linked) Supabase database via `supabase db push --linked`.
- SECURITY DEFINER + `SET search_path` headers and `crypt()` passphrase blocks preserved verbatim in both redefined functions (V2/V4: no new write path, no bypass).

## Task Commits

1. **Task 1: Write migration 00005 (column + generate_round redefine + pause_timer clamp removal)** — `807a430` (feat)
2. **Task 2: [BLOCKING] Apply migration 00005 to the database** — no file artifact (DB side-effect only; migration file committed under Task 1). `supabase db push --linked` output: "Applying migration 00005_timer_overtime.sql... Finished supabase db push."
3. **Task 3: [CHECKPOINT] Verify migration 00005 SQL behaviors on the live DB** — APPROVED. User verified migration file content + clean remote apply against the live DB and approved the checkpoint (relayed via orchestrator resume signal). No further DB operations performed during finalization.

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `supabase/migrations/00005_timer_overtime.sql` — Additive migration: overtime_seconds column, overload-safe generate_round redefine with p_overtime_minutes + bounds check, signed pause_timer (clamp removed). resume/extend/cancel intentionally untouched.

## Decisions Made
- Left `resume_timer`, `extend_timer`, `cancel_timer` unmodified — RESEARCH Pattern 2 proves they are already correct once `remaining_seconds` is signed; restating them would only risk regressions and bloat the diff.
- Placed the `p_overtime_minutes` bounds check at the top of `generate_round` (before passphrase/event validation) — pure input validation with no data access, cheapest rejection path; passphrase gate still fully enforced for any valid-bounds call.
- Chose RESEARCH Wave 0 option (c): documented manual SQL verification checkpoint, because the repo has no pgTAP/SQL test harness and `supabase.rpc` is mocked in hook tests — these DB behaviors are not machine-testable here.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `supabase db push --linked` printed an interactive `[Y/n]` prompt but proceeded non-interactively and applied the migration successfully (`SUPABASE_DB_PASSWORD` sourced from `.env`). No destructive retry was needed; the migration applied on the first attempt.

## User Setup Required
None new — `SUPABASE_DB_PASSWORD` already present in `.env` (gitignored) and was used for the non-interactive push. No environment changes required.

## Next Phase Readiness

**BLOCKING human-verify checkpoint (Task 3) — APPROVED.** Migration 00005 is applied to the live DB and the user verified the migration file content and a clean remote apply, then approved the checkpoint. The verification scope confirmed:

1. `overtime_seconds` column exists: `NOT NULL`, default `0`.
2. Exactly one `generate_round` overload (`SELECT count(*) FROM pg_proc WHERE proname='generate_round';` → `1`).
3. `generate_round(... p_overtime_minutes => 20)` persists `overtime_seconds = 1200`; omitted → `0`.
4. `generate_round(... p_overtime_minutes => -1)` RAISEs (bounds check).
5. Signed pause: pausing past the main expiry stores a NEGATIVE `remaining_seconds`; `resume_timer` restores position (no reset to 0:00).
6. No `PGRST203` on any `generate_round` call.

The data-layer foundation is now ready for Plan 02 (`useCountdown.ts` three-phase derivation) and Plan 03 (dual-boundary notifications). The `RoundTimer` type in `src/types/database.ts` must add `overtime_seconds: number` in the next client plan.

---
*Phase: 08-timer-migration-core-engine*
*Completed: 2026-06-27 (all 3 tasks complete; human-verify checkpoint approved)*

## Self-Check: PASSED
- FOUND: supabase/migrations/00005_timer_overtime.sql
- FOUND: .planning/phases/08-timer-migration-core-engine/08-01-SUMMARY.md
- FOUND commit: 807a430 (Task 1)
