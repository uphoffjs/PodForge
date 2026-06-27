---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
refreshed: 2026-06-27
---

# Codebase Concerns

**Analysis Date:** 2026-06-27

---

## Unfinished Sections

### FUTURE-01: Multiple Simultaneous Admins

**Status:** Not started. Explicitly deferred.
**Files:** `.planning/REQUIREMENTS.md` (line 42), `.planning/PROJECT.md` (line 55)
**Current state:** Only one admin passphrase per event. Admin state is per-tab sessionStorage. Two browser sessions with the same passphrase both get admin controls, but there is no coordination or conflict prevention between them.
**What's missing:** Any server-side admin session model, optimistic locking, or last-write-wins conflict resolution on concurrent generate-round calls.

---

### FUTURE-02: Player Joining Mid-Event

**Status:** Not started. Explicitly deferred.
**Files:** `.planning/REQUIREMENTS.md` (line 43), `.planning/PROJECT.md` (line 56)
**Current state:** Players who join after round 1 have `buildOpponentHistory` correctly return 0 for all their pairs (they were never in a pod), and `buildByeCounts` initializes them with 0 byes. So the algorithm already handles mid-join players correctly by accident — the missing piece is a UX flag or admin confirmation that new players start with empty history.
**What's missing:** Documented UX behavior, possibly a confirmation step for the admin, or a "joined mid-event" indicator in the player list.

---

### Fault Injection Campaign: 21 Faults Never Investigated

**Status:** Incomplete investigation.
**Files:** `.planning/debug/fault-injection-batch1.md` (untracked)
**Current state:** A batch-1 fault injection campaign was started and documented in `.planning/debug/fault-injection-batch1.md`. Only fault 2.1 was verified KILLED. Faults 2.2–5.6 (21 total) are all marked PENDING and were never executed.
**What's missing:** Running the remaining 21 fault injections to verify E2E test coverage for event-creation (5 faults), player-join (5 faults), admin-add-player (4 faults), and admin-player-management (7 faults).

---

### ROADMAP.md Phase 7 Checkbox Stale

**Status:** Documentation drift.
**Files:** `.planning/ROADMAP.md` (lines 51, 84–86, 107)
**Current state:** The progress table at the bottom of `ROADMAP.md` shows Phase 7 as `0/3 | Not started`. `STATE.md` and `v4.0-MILESTONE-AUDIT.md` confirm Phase 7 (pods-of-3) is complete. The ROADMAP phase 7 plan bullets still show `[ ]` checkboxes.
**What's missing:** Updating ROADMAP.md Phase 7 progress table to `3/3 | Complete` and ticking plan checkboxes.

---

### `passphraseError` State: Wired But Never Populated

**Status:** Incomplete UI flow.
**Files:** `src/pages/EventPage.tsx` (lines 32, 145, 153, 158, 327)
**Current state:** `passphraseError` state is declared and passed as the `error` prop to `AdminPassphraseModal`. However, `setPassphraseError(...)` is only ever called with `null` — it is never set to an actual error string after a failed mutation. The modal is capable of displaying an inline error but receives no signal from failed passphrase attempts.
**What's missing:** When a generate-round, end-event, or timer mutation fails with "Invalid passphrase", the error should propagate back to set `passphraseError` with a human-readable message and re-open the modal, completing the validation feedback loop.

---

### `clearPassphrase` Exported But Never Called

**Status:** Dead export.
**Files:** `src/hooks/useAdminAuth.ts` (lines 24–27, 33)
**Current state:** `useAdminAuth` exports `clearPassphrase` but no component or hook in the app ever calls it. There is no "Log out admin" button or passphrase revocation flow.
**What's missing:** Either a UI affordance to clear admin status (logout button), or removal of the export if the capability is intentionally absent.

---

### `createRealEvent` Cypress Command: Defined But Unused

**Status:** Dead test infrastructure.
**Files:** `cypress/support/commands.js` (lines 66–80)
**Current state:** A `cy.createRealEvent(name, passphrase)` custom command is defined that hits the real Supabase `create_event` RPC. No E2E spec calls this command — all tests use intercepted mock data.
**What's missing:** Real integration E2E tests that run against a live Supabase test project, or deletion of this command if mocked-only tests are the intended approach.

---

## Security Considerations

### Passphrase Never Validated Before Granting Admin UI

**Risk:** Any string typed in the passphrase modal immediately grants the admin UI (admin controls, timer controls, add-player form). The passphrase is only verified at the database level when the first mutation fires.
**Files:** `src/hooks/useAdminAuth.ts` (line 14), `src/pages/EventPage.tsx` (lines 46, 262–271)
**Current mitigation:** All destructive RPCs (`generate_round`, `end_event`, `remove_player`, `reactivate_player`, timer RPCs) validate the passphrase via `crypt(p_passphrase, v_hash) != v_hash` and raise an exception. The admin UI is cosmetic only until a real action is taken.
**Recommendation:** Call the existing `validate_passphrase` RPC (defined in `supabase/migrations/00001_initial_schema.sql` line 107) immediately when the user submits the passphrase modal. Reject and clear the passphrase if it returns false, and set `passphraseError` with a user-facing message.

---

### Admin Add-Player Bypasses Passphrase Gate at DB Level

**Risk:** `AddPlayerForm` inserts directly via `supabase.from('players').insert()` without passphrase verification. The `players` table has an RLS policy `"Anyone can join an event"` that allows any anon user to insert. Any actor with network access can add players to any event without knowing the admin passphrase.
**Files:** `src/hooks/useAddPlayer.ts` (lines 10–14), `src/components/AddPlayerForm.tsx`, `supabase/migrations/00001_initial_schema.sql` (line 63–66)
**Current mitigation:** `AddPlayerForm` is only rendered in `EventPage.tsx` when `isAdmin && !isEventEnded` (line 294), providing UI-level protection only.
**Recommendation:** Create an `add_player(p_event_id, p_passphrase, p_name)` SECURITY DEFINER RPC that validates the passphrase before inserting, matching the pattern used by all other admin operations.

---

### Admin Passphrase Stored Plaintext in sessionStorage

**Risk:** The plaintext passphrase is readable from browser dev tools (Application → Session Storage) and from any JavaScript running in the same origin.
**Files:** `src/hooks/useAdminAuth.ts` (line 18), `src/components/CreateEventModal.tsx` (line 28)
**Current mitigation:** `sessionStorage` is tab-isolated and cleared on tab close. The passphrase is not transmitted except in RPC calls where it's compared against a bcrypt hash server-side.
**Recommendation:** Acceptable risk for the casual-event threat model. Document explicitly as a known tradeoff.

---

### No Brute Force Protection on Passphrase

**Risk:** An attacker can call `generate_round`, `end_event`, or any admin RPC repeatedly with different passphrases. The database will bcrypt-compare on every call. No rate limiting or lockout exists at the application or DB level.
**Files:** All passphrase-gated RPCs in `supabase/migrations/00002_rounds_pods_admin.sql` and `supabase/migrations/00004_timer_system.sql`
**Current mitigation:** Supabase project-level rate limiting (API gateway) applies per-IP.
**Recommendation:** Acceptable risk for casual gaming events. Supabase Pro tier offers more aggressive rate limiting if needed.

---

### Supabase Env Vars Not Validated at Startup

**Risk:** If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are not set, `createClient(undefined, undefined)` is called silently. All API calls will fail with cryptic errors rather than a clear startup message.
**Files:** `src/lib/supabase.ts` (lines 3–6)
**Current mitigation:** Build-time type checking does not catch missing env vars. Supabase client silently accepts `undefined`.
**Recommendation:** Add a startup guard: `if (!supabaseUrl || !supabaseAnonKey) { throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required') }`.

---

## Known Bugs

### DB Minimum Player Check Mismatch with allowPodsOf3

**Symptoms:** When `allowPodsOf3=true` is passed to the frontend `generatePods()` function with exactly 3 active players, the frontend algorithm succeeds (minPlayers relaxes to 3). However, when `generateRound.mutate()` sends the assignments to the `generate_round` RPC, the DB still enforces `IF v_active_count < 4 THEN RAISE EXCEPTION 'Fewer than 4 active players'`. The round creation fails at the DB level even though the client computed valid 3-player pod assignments.
**Files:** `src/lib/pod-algorithm.ts` (line 346), `supabase/migrations/00004_timer_system.sql` (line 90)
**Trigger:** Event with exactly 3 active players + admin enables pods-of-3 toggle + clicks Generate.
**Workaround:** None. The feature advertises 3-player support but the DB rejects it for exactly 3 players.
**Fix:** Update the `generate_round` RPC to accept an optional `p_allow_pods_of_3 BOOLEAN DEFAULT FALSE` parameter and conditionally enforce `v_active_count < 3` vs `v_active_count < 4`.

---

### `useGenerateRound` Error Handler Missing pods-of-3 Message

**Symptoms:** The `onError` handler in `useGenerateRound` checks `message.includes('fewer than 4')` but not `'fewer than 3'`. If the DB were updated to enforce the 3-player minimum, the error string would be `'Fewer than 3 active players'` and fall through to the generic error toast.
**Files:** `src/hooks/useGenerateRound.ts` (line 43)
**Trigger:** DB-level rejection with 3-player minimum error message.
**Workaround:** n/a (latent until DB fix applied).

---

## Tech Debt

### No 404 / Catch-All Route

**Issue:** `app.tsx` router defines only two routes (`/` and `/event/:eventId`). Navigating to any other path (e.g., `/foo`) renders a blank `<Layout>` with no content or error message.
**Files:** `src/app.tsx` (lines 10–19)
**Impact:** Poor UX for mistyped URLs or stale shared links; no error telemetry.
**Fix approach:** Add a catch-all route with a `path: '*'` entry returning a "Page Not Found" component, or add `errorElement` to the root route.

---

### No React Error Boundary

**Issue:** No `ErrorBoundary` component wraps the app or any subtree. An unexpected render-time exception will crash the entire UI with a blank screen.
**Files:** `src/app.tsx`, `src/main.tsx`
**Impact:** Any unhandled component-level error is unrecoverable without a page refresh.
**Fix approach:** Wrap the `RouterProvider` (or at minimum `EventPage`) in a React error boundary with a user-friendly fallback UI.

---

### `package.json` Version Never Updated

**Issue:** `package.json` version field is `"0.0.0"`. The project has shipped v1.0 through v4.0.
**Files:** `package.json` (line 4)
**Impact:** Minor — version is unused beyond tooling display.
**Fix approach:** Update to `"4.0.0"` to match the current milestone.

---

### `pods` and `pod_players` Realtime Subscriptions Lack `event_id` Filter

**Issue:** `useEventChannel` subscribes to `postgres_changes` on `pods` and `pod_players` tables without an `event_id` filter (lines 51–72 of `src/hooks/useEventChannel.ts`). Any pod change in any event triggers a `queryClient.invalidateQueries` call for the current viewer's `['pods']` and `['allRoundsPods', eventId]` query keys.
**Files:** `src/hooks/useEventChannel.ts` (lines 51–72), `supabase/migrations/00003_realtime_replica_identity.sql` (lines 13–15)
**Impact:** In a low-traffic single-event scenario, harmless — only one event is active at a time. At scale with many simultaneous events, every client would re-fetch pod data on every pod change anywhere in the system.
**Current mitigation:** Documented in migration 00003 as intentional because `pods` has no `event_id` column to filter on. The `round_id` FK to `rounds` could be used as a bridge.
**Fix approach:** Add an `event_id` column to the `pods` table (denormalized) and set REPLICA IDENTITY FULL to enable filtered subscription, or accept the current behavior as sufficient for the target scale.

---

### Realtime WebSocket Reconnect Logic Not User-Visible

**Issue:** `useEventChannel` logs `console.error` / `console.warn` for `CHANNEL_ERROR` and `TIMED_OUT` subscription states but provides no user-visible feedback. A user with a broken Realtime connection would see stale data silently.
**Files:** `src/hooks/useEventChannel.ts` (lines 87–92)
**Impact:** Users don't know when real-time updates have stopped working.
**Fix approach:** Show a dismissible toast or banner when subscription enters `CHANNEL_ERROR` or `TIMED_OUT`. The `useVisibilityRefetch` hook provides a backstop on tab refocus, but doesn't cover mid-session disconnects.

---

## Performance Bottlenecks

### `swapPass` Quadratic Complexity with Large Player Counts

**Problem:** `swapPass` in `pod-algorithm.ts` uses a `while (improved)` loop over all cross-pod player pairs. For N players in K pods, the per-pass cost is O(N²×K²). With `NUM_STARTS=20`, this runs 20 times per round generation. For the current target (4–20 players) performance is acceptable, but would degrade for larger events.
**Files:** `src/lib/pod-algorithm.ts` (lines 220–264)
**Cause:** Exhaustive pairwise swap search, restart on first improvement.
**Improvement path:** Use a priority queue of candidate swaps, or cap max swap-pass iterations. For 20 players / 5 pods this is imperceptible; flag if player counts grow.

---

### `allPods` Fetched Eagerly for All Rounds

**Problem:** `AdminControls` calls `useAllRoundsPods(eventId, roundIds)` to build the full opponent history on every render. For a 10-round event with 4 pods each, this is 40+ pod records. No pagination or incremental fetch.
**Files:** `src/components/AdminControls.tsx` (lines 60–61), `src/hooks/useAllRoundsPods.ts`
**Cause:** Complete opponent history is required to compute good pod assignments for the next round.
**Improvement path:** Cache the history in a query key that only refetches when `rounds` changes; the data is already `staleTime: 30_000` in the query client.

---

## Fragile Areas

### `justJoinedRef` Race Condition Guard

**Component:** `EventPage`
**Files:** `src/pages/EventPage.tsx` (lines 55–88)
**Why fragile:** The `justJoinedRef` pattern guards against a race where the validation effect fires before the player list refetches after joining. The guard is a boolean ref toggled by joining and cleared when the player appears in the list. If the refetch is delayed beyond one render cycle (slow network), the ref may clear before the player appears, causing the identity to be cleared immediately.
**Test coverage:** Unit-tested in `src/pages/EventPage.test.tsx` but the timing edge case is not covered by E2E tests.
**Safe modification:** Do not change the `justJoinedRef` guard without also updating `EventPage.test.tsx` tests that cover the join race condition scenarios.

---

### `useEventChannel` Single Instance Assumption

**Component:** `useEventChannel`
**Files:** `src/hooks/useEventChannel.ts`
**Why fragile:** The channel name is `event:${eventId}`. If multiple `useEventChannel` hooks were mounted simultaneously (e.g., two `EventPage` instances), they would create two separate subscriptions to the same channel. Currently, only one `EventPage` can be mounted at a time, but this is an implicit constraint.
**Safe modification:** Safe as long as `EventPage` remains a singleton per browser tab.

---

## Test Coverage Gaps

### Timer Urgency Colors and Overtime Not Tested in E2E

**What's not tested:** The urgency color transitions (yellow < 10 min, red < 5 min, flashing red at 0:00) and overtime (counting up past 0:00) are unit-tested in `src/components/TimerDisplay.test.tsx` and `src/hooks/useCountdown.test.ts` but never exercised in Cypress E2E tests. The E2E timer tests use `expires_at: Date.now() + 45 minutes` always — a "safe" value that never triggers urgency.
**Files:** `cypress/e2e/timer.cy.js` (all test cases use 45-minute offsets)
**Risk:** A CSS class name change or threshold logic regression could break the urgency UX with no E2E detection.
**Priority:** Medium — unit tests do cover the logic; E2E gap is UI/visual only.

---

### Browser Notification Flow Not Tested in E2E

**What's not tested:** `useTimerNotification` (notification permission request, notification firing at timer expiry, dedup via `lastNotifiedTimerId` ref) has comprehensive unit tests but zero E2E coverage. The Cypress browser used in CI supports `Notification.requestPermission` but it isn't exercised.
**Files:** `src/hooks/useTimerNotification.ts`, `cypress/e2e/timer.cy.js`
**Risk:** Notification permission prompt regression or iOS PWA fallback breakage would go undetected in E2E.
**Priority:** Low — unit tests at 100% coverage provide strong signal.

---

### `createRealEvent` Cypress Command Has No Callers

**What's not tested:** All 14 E2E spec files mock Supabase via `cy.intercept`. The `createRealEvent` custom command exists to support real integration tests but is never called.
**Files:** `cypress/support/commands.js` (lines 66–80), all `cypress/e2e/*.cy.js` files
**Risk:** The real Supabase integration path (app → PostgREST → DB RPC → Realtime) is not covered by automated tests. The E2E suite tests component behavior with stubbed responses.
**Priority:** Medium — real DB integration tests would catch the `allowPodsOf3` / DB minimum-4-player mismatch described above.

---

### Fault Injection Campaign Incomplete

**What's not tested:** 21 out of 22 planned fault injection cases in `.planning/debug/fault-injection-batch1.md` were never executed. These cover E2E test quality for event-creation, player-join, admin-add-player, and admin-player-management specs.
**Files:** `.planning/debug/fault-injection-batch1.md` (untracked), `cypress/e2e/event-creation.cy.js`, `cypress/e2e/player-join.cy.js`, `cypress/e2e/admin-add-player.cy.js`, `cypress/e2e/admin-player-management.cy.js`
**Risk:** E2E tests for these flows may be false positives (pass even with broken behavior). Quick Task 5 addressed the generate-round and previous-rounds specs but not these four.
**Priority:** Medium.

---

## Scaling Limits

### Event Data Is Never Purged

**Current capacity:** Supabase free tier applies row-level storage limits. Events, players, rounds, pods, pod_players, and round_timers all accumulate indefinitely. A single ended event is small but there is no deletion or archival mechanism.
**Limit:** Supabase free tier (500MB database). At typical event sizes (20 players, 8 rounds, 4 pods each), each event uses ~500 rows. Capacity is effectively thousands of events before hitting limits.
**Scaling path:** Add a TTL or manual cleanup RPC for ended events; or rely on Supabase Pro for more storage.

---

## Dependencies at Risk

No direct dependency concerns identified. All dependencies are current, actively maintained packages:
- `@supabase/supabase-js@^2.97.0` — stable
- `@tanstack/react-query@^5.90.21` — stable
- `react@^19.2.0`, `react-router@^7.13.0` — on latest major
- `cypress@^15.10.0` — on latest major
- `vitest@^4.0.18` — on latest major
- `stryker@^9.5.1` — on latest major

---

*Concerns audit: 2026-06-27*
