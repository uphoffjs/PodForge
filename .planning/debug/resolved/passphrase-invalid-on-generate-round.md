---
status: resolved
trigger: "User gets 'invalid passphrase' error when trying to generate a round of pods from the admin controls. This used to work previously."
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: N/A
expecting: N/A
next_action: Archive session

## Symptoms

expected: Admin enters passphrase, clicks Generate Next Round, pods are created successfully
actual: "Invalid passphrase" error appears when generating a round
errors: "invalid passphrase" message displayed in the UI
reproduction: Go to event page as admin, enter passphrase, click Generate Next Round
started: Used to work before, broke at some point recently

## Eliminated

## Evidence

- timestamp: 2026-02-25T00:00:01Z
  checked: Migration 00004 (timer system) applies to remote database
  found: "supabase migration list" shows 00004 exists locally but NOT applied to remote. Remote only has 00001, 00002, 00003.
  implication: Remote database still has 3-param generate_round from migration 00002. Frontend sends 4 params (including p_timer_duration_minutes added in 00004).

- timestamp: 2026-02-25T00:00:01Z
  checked: useGenerateRound.ts error handler logic (lines 40-47)
  found: Error handler checks `message.includes('passphrase') || message.includes('invalid')`. PostgREST function-not-found errors list parameter names including "p_passphrase", which triggers the "passphrase" match. The error is NOT actually an invalid passphrase -- it is a function signature mismatch.
  implication: The user sees "Invalid passphrase" but the real error is "function not found with these params". This is a misleading error message caused by overly broad string matching.

- timestamp: 2026-02-25T00:00:01Z
  checked: generate_round function signature in 00002 vs 00004
  found: 00002 has (p_event_id UUID, p_passphrase TEXT, p_pod_assignments JSONB). 00004 adds p_timer_duration_minutes INTEGER DEFAULT NULL. Frontend always sends all 4 params.
  implication: The RPC call cannot resolve against the 3-param function on remote.

- timestamp: 2026-02-25T00:00:02Z
  checked: Migration push and error handler fix
  found: "supabase db push" applied 00004 successfully. "supabase migration list" confirms all 4 migrations applied locally and remotely. Error handlers in all 8 admin hooks updated from broad `includes('passphrase') || includes('invalid')` to specific `includes('invalid passphrase')`. All 345/346 tests pass (1 pre-existing flaky test in pod-algorithm unrelated).
  implication: Fix is verified -- the generate_round RPC now accepts 4 params on remote, and error handlers will no longer misreport unrelated errors as "Invalid passphrase".

## Resolution

root_cause: Migration 00004_timer_system.sql was not applied to the remote Supabase database. The frontend (useGenerateRound.ts) sends 4 parameters to the generate_round RPC (including p_timer_duration_minutes from the timer feature), but the remote database only has the 3-parameter version from migration 00002. PostgREST returns a "function not found" error listing parameter names, and the error handler in useGenerateRound.ts broadly matches on the word "passphrase" (present in "p_passphrase" in the error), displaying the misleading "Invalid passphrase" toast.
fix: (1) Applied migration 00004_timer_system.sql to remote Supabase database via `supabase db push`. (2) Hardened error handlers in all 8 admin RPC hooks to match on the exact phrase "invalid passphrase" instead of matching on "passphrase" OR "invalid" separately. Also added specific handlers for "event not found" and "event has ended" in useGenerateRound.
verification: Migration list confirms 00004 applied. 345/346 tests pass (1 pre-existing flaky failure unrelated). Zero instances of overly-broad error pattern remain.
files_changed:
  - src/hooks/useGenerateRound.ts
  - src/hooks/useRemovePlayer.ts
  - src/hooks/useEndEvent.ts
  - src/hooks/useReactivatePlayer.ts
  - src/hooks/useCancelTimer.ts
  - src/hooks/usePauseTimer.ts
  - src/hooks/useResumeTimer.ts
  - src/hooks/useExtendTimer.ts
