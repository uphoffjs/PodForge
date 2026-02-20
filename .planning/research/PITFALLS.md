# Domain Pitfalls

**Domain:** Real-time event management web app (MTG Commander pod pairing)
**Researched:** 2026-02-20

---

## Critical Pitfalls

Mistakes that cause rewrites, data exposure, or broken core functionality.

---

### Pitfall 1: Supabase Realtime Silent Disconnections on Mobile

**What goes wrong:** When a user backgrounds the app on their phone (switches to another app, locks screen, or even switches browser tabs), the browser throttles JavaScript timers. Supabase Realtime relies on heartbeat signals to maintain WebSocket connections. Throttled timers mean heartbeats stop reaching the server, which silently drops the connection. The client never receives an error -- it just stops getting updates. The player sits down at a table, checks their phone 10 minutes later, and still sees the old round assignment.

**Why it happens:** Mobile browsers aggressively throttle `setInterval`/`setTimeout` in background tabs to once per minute (Chrome) or worse. Supabase's heartbeat mechanism runs on the main thread by default, so it gets throttled along with everything else. The server drops the connection after missing heartbeats, but the client-side status may not update to reflect this.

**Consequences:** Players miss pod assignments. Timer displays freeze at stale values. Admin actions (new round, timer changes) don't propagate. The app appears "working" but is showing stale data with no visible error.

**Prevention:**
1. Enable Web Workers for Supabase Realtime to move heartbeats off the main thread:
   ```typescript
   const supabase = createClient(URL, KEY, {
     realtime: { worker: true }
   })
   ```
2. Implement `heartbeatCallback` as a fallback for network-level disconnections:
   ```typescript
   const supabase = createClient(URL, KEY, {
     realtime: {
       worker: true,
       heartbeatCallback: (status) => {
         if (status === 'disconnected') {
           supabase.realtime.connect()
         }
       },
     },
   })
   ```
3. Use the Page Visibility API (`visibilitychange` event) to force a data re-fetch when the tab becomes visible again. Do NOT rely solely on the subscription reconnecting -- always re-query current state on visibility restore.

**Detection:**
- Test by backgrounding the app on a real phone for 5+ minutes, then returning
- Monitor `channel.on('system', ...)` events for status changes
- Add a "last updated" indicator (even debug-only) showing when the last Realtime message arrived

**Phase relevance:** Must be addressed in the initial Realtime infrastructure setup, not bolted on later. The `worker: true` and `heartbeatCallback` options are client initialization config.

**Confidence:** HIGH -- documented in [Supabase official troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) and confirmed across [multiple](https://github.com/supabase/realtime-js/issues/121) [GitHub](https://github.com/supabase/realtime/issues/1088) [issues](https://github.com/orgs/supabase/discussions/27513).

---

### Pitfall 2: Timer Display Using setInterval Instead of Server-Derived Calculation

**What goes wrong:** Developers build countdown timers by storing a "remaining seconds" value and decrementing it with `setInterval(fn, 1000)`. This breaks in three ways: (1) browser throttles the interval to once per minute in background tabs, so the timer freezes; (2) `setInterval` drifts -- each tick accumulates small timing errors; (3) different clients show different remaining times because they started their local timers at slightly different moments.

**Why it happens:** `setInterval` counting down feels like the obvious implementation. The PROJECT.md spec already addresses this correctly ("Timer state stored server-side: duration, started_at, paused_remaining; clients calculate independently"), but it is extremely common for developers to ignore this pattern and use a local countdown anyway.

**Consequences:** One player sees "12:34 remaining" while another sees "12:28." Timer freezes when the tab is backgrounded. Timer shows negative values or wrong times after pause/resume cycles. Players lose trust in the timer.

**Prevention:**
1. Store timer state server-side as `{ duration_seconds, started_at (UTC timestamp), paused_remaining_seconds | null }`. Never store a "current remaining" value.
2. On every render tick, calculate: `remaining = duration - (Date.now() - started_at)`. If paused, use `paused_remaining` directly.
3. Use `requestAnimationFrame` for display updates (not `setInterval`), falling back to a 1-second `setInterval` only for background awareness.
4. On `visibilitychange` to "visible," immediately recalculate from server state -- the display catches up instantly.
5. Do NOT attempt to synchronize client clocks with NTP-like protocols. For a countdown timer with minute-level granularity, the few hundred milliseconds of client clock variance is irrelevant. The spec calls for mm:ss display, not sub-second precision.

**Detection:**
- Open the app on two phones side by side -- timers should match within 1 second
- Background the app for 5 minutes, return -- timer should immediately show correct remaining time
- Pause/resume the timer -- all clients should show identical values

**Phase relevance:** Timer implementation phase. Get the data model right from the start; refactoring a countdown-based timer to a calculated timer is a rewrite of the timer component.

**Confidence:** HIGH -- browser timer throttling is [well-documented by Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88), [extensively analyzed](https://nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers/), and the server-derived calculation pattern is standard practice.

---

### Pitfall 3: RLS Misconfiguration Exposes All Event Data

**What goes wrong:** With no user authentication (passphrase-only model), developers either: (a) forget to enable RLS entirely, exposing the entire database through the public anon key, or (b) create overly permissive RLS policies that let any client read/write any event's data, or (c) create policies that accidentally block Realtime subscriptions from working.

**Why it happens:** This app intentionally has no Supabase Auth -- no `auth.uid()` to reference in RLS policies. Most Supabase RLS tutorials assume authenticated users. The passphrase model doesn't map to any standard Supabase pattern, so developers wing it and get it wrong. Additionally, Supabase RLS is disabled by default on new tables, and 83% of exposed Supabase databases involve RLS misconfigurations ([CVE-2025-48757](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)).

**Consequences:** Without RLS, anyone with the anon key (which is in client-side JavaScript, trivially extractable) can read every event, every player's name, every pod assignment across all events. They can also INSERT, UPDATE, and DELETE any row. This is not a theoretical risk -- it was exploited in 170+ apps in January 2025.

**Prevention:**
1. Enable RLS on EVERY table immediately upon creation. No exceptions.
2. Design RLS policies that scope access by `event_id`:
   - SELECT: Allow reading any event's public data (player lists, pods, rounds). This is fine -- the data is not sensitive, and the event URL/code is the access gate.
   - INSERT: Allow adding players (with constraints), but NOT creating events without the admin passphrase.
   - UPDATE/DELETE: Restrict to operations that pass a valid admin passphrase via RPC function, not direct table mutation.
3. Move admin actions (generate round, remove player, timer controls) to Supabase Edge Functions or Postgres RPC functions that validate the passphrase server-side. Do NOT validate the passphrase client-side and then do a direct table write.
4. Store the admin passphrase as a bcrypt hash, not plaintext.
5. Critical Realtime gotcha: RLS policies are NOT applied to DELETE events in `postgres_changes`. Deleted records only send primary keys, not full row data. Design your Realtime listeners accordingly.

**Detection:**
- Try accessing the Supabase REST API directly with just the anon key and no filters -- if you get data from other events, RLS is wrong
- Check that every table in the schema has RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
- Attempt admin actions without the passphrase -- they should fail

**Phase relevance:** Database schema and RLS policies must be the FIRST thing built, before any feature code. Retrofitting RLS after building features with permissive access causes widespread breakage.

**Confidence:** HIGH -- based on [official Supabase security docs](https://supabase.com/docs/guides/api/securing-your-api), [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security), and the [documented 2025 Lovable vulnerability](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/).

---

### Pitfall 4: Realtime Subscription Leaks in React Components

**What goes wrong:** Supabase Realtime channels are created in `useEffect` but not properly cleaned up on unmount. Each navigation or re-render creates a new subscription without removing the old one. After a few page transitions, the client has dozens of zombie subscriptions consuming memory and receiving duplicate events, causing state corruption (duplicate players in the list, duplicate pod cards, etc.).

**Why it happens:** React Strict Mode in development calls `useEffect` twice, which doubles the subscriptions if cleanup is not implemented. Additionally, Supabase's channel API requires explicit `unsubscribe()` calls -- subscriptions do not auto-clean on component unmount. Developers forget the cleanup function or implement it incorrectly.

**Consequences:** Memory leaks accumulate over time (significant on a phone held open during a 4-hour event). Duplicate event handlers fire, causing duplicate state updates and UI glitches. Eventually, the client hits Supabase's 100-channel-per-connection limit and stops receiving updates entirely.

**Prevention:**
1. Always return a cleanup function from `useEffect`:
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel(`event-${eventId}`)
       .on('postgres_changes', { ... }, handler)
       .subscribe()

     return () => {
       supabase.removeChannel(channel)
     }
   }, [eventId])
   ```
2. Use `supabase.removeChannel(channel)` (not just `channel.unsubscribe()`) to fully clean up.
3. Centralize subscription management -- create ONE channel per event with multiple `.on()` handlers, rather than one channel per table. This reduces channel count and simplifies cleanup.
4. Test with React Strict Mode enabled to catch double-subscription bugs during development.

**Detection:**
- In browser DevTools, check `supabase.realtime.channels` length -- it should match expected count (typically 1 per event)
- Monitor WebSocket frames in the Network tab for duplicate subscription messages
- Navigate between pages 10 times rapidly, then check for memory growth in the Performance tab

**Phase relevance:** Must be correct from the first Realtime integration. Establish the subscription pattern in the first component that uses Realtime, and every subsequent component follows that pattern.

**Confidence:** HIGH -- documented [Supabase/React Strict Mode issue](https://github.com/supabase/realtime-js/issues/169), confirmed in [multiple](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak) [memory](https://www.codewalnut.com/insights/5-react-memory-leaks-that-kill-performance) leak analyses, and the [100-channel limit is documented](https://supabase.com/docs/guides/realtime/limits).

---

## Moderate Pitfalls

---

### Pitfall 5: Browser Notification Permissions -- iOS Requires PWA Installation

**What goes wrong:** The app requests browser notification permission via `Notification.requestPermission()`, and it works on Android Chrome and desktop browsers. But on iOS Safari -- which is the browser most iPhone users will use -- web push notifications only work when the site is installed as a PWA (added to home screen). A regular Safari tab cannot receive push notifications on iOS. Since the app is accessed via QR code (users scan and open in their browser), virtually no iOS user will have it installed as a PWA.

**Why it happens:** Apple requires PWA installation (display: "standalone" in web manifest) for web push on iOS, a policy in place since iOS 16.4. This is a platform limitation, not a bug. Most developers building web apps don't realize this until they test on an actual iPhone.

**Consequences:** Timer expiry notifications -- described as "critical" in the spec -- will not work for any iPhone user accessing the app via QR code link in Safari. This is likely 40-60% of users at a game store event.

**Prevention:**
1. Accept that push notifications will NOT work for iOS Safari tab users. Design the UX accordingly.
2. Implement visual fallbacks that work WITHOUT notification permission:
   - Full-screen color change when timer expires (red flash/pulse)
   - Large, high-contrast timer that's readable at arm's length
   - Vibration API as a secondary alert (works on Android without notification permission)
3. For notification-capable browsers, request permission at the right moment (after the user joins an event and has context), not on page load. Chrome on Android will permanently deny permission if the user dismisses the prompt, and re-requesting requires the user to manually change settings.
4. Show a clear UI indicator of notification status: "Notifications enabled" / "Notifications not available on this browser" / "Tap to enable notifications"
5. Consider adding a PWA install prompt for iOS users, but do not make it a hard requirement.

**Detection:**
- Test on a real iPhone in Safari (not installed as PWA) -- notifications should gracefully degrade
- Test permission denial flow -- the app should not show broken notification UI
- Check `Notification.permission` before attempting to request it

**Phase relevance:** Timer and notification implementation phase. The visual fallback must be designed alongside the timer UI, not as an afterthought.

**Confidence:** HIGH -- iOS PWA push requirement documented by [Apple](https://firt.dev/ios-15.4b), confirmed by [multiple](https://www.mobiloud.com/blog/progressive-web-apps-ios) [sources](https://brainhub.eu/library/pwa-on-ios) and [integration guides](https://doc.batch.com/developer/technical-guides/how-to-guides/web/how-to-integrate-batchs-snippet-using-google-tag-manager/how-do-i-enable-ios-web-push-notifications-on-my-pwa-website).

---

### Pitfall 6: Race Condition in Concurrent Pod Generation

**What goes wrong:** Two admins hit "Generate Next Round" at nearly the same time (or one admin double-taps the button). Without server-side locking, two rounds get created with overlapping or identical pod assignments. Players see a flicker of two different rounds. The round counter jumps. Historical data is corrupted.

**Why it happens:** The pod generation flow is: read active players -> run algorithm -> write round + pods + pod_players. Between reading players and writing pods, another request can start the same flow. Without a transaction or lock, both requests see the same "current state" and both write new rounds.

**Consequences:** Duplicate rounds, players assigned to two pods simultaneously, broken opponent history for future rounds, confused players seeing assignments flicker.

**Prevention:**
1. Use a Postgres advisory lock or row-level lock in the pod generation function:
   ```sql
   -- At the start of the generate_round function:
   PERFORM pg_advisory_xact_lock(event_id);
   ```
   This ensures only one round generation runs per event at a time. The second request blocks until the first completes, then sees the updated state.
2. Wrap the entire pod generation in a single Postgres transaction (ideally an RPC function). Do NOT read players in one API call and write pods in another -- the gap between calls is where races live.
3. Add a UI-level guard: disable the "Generate Round" button immediately on click and show a loading state. Re-enable only after the response returns. This prevents accidental double-taps.
4. Add a unique constraint or check in the RPC function: if a round with `round_number = current_max + 1` already exists, return the existing round instead of creating a duplicate.

**Detection:**
- Rapidly click "Generate Round" 3 times in quick succession -- should produce exactly one new round
- Open two browser tabs as admin, click "Generate Round" simultaneously -- should produce exactly one new round
- Check the rounds table for gaps or duplicates in round_number

**Phase relevance:** Pod generation algorithm implementation. The locking must be part of the database function, not added later.

**Confidence:** MEDIUM -- race conditions in concurrent writes are a well-known pattern ([Supabase discussion](https://github.com/orgs/supabase/discussions/30334), [concurrent writes guide](https://bootstrapped.app/guide/how-to-handle-concurrent-writes-in-supabase)), but the specific advisory lock pattern for this use case is a standard recommendation, not something verified in a pod-pairing context specifically.

---

### Pitfall 7: Pod Generation Algorithm Edge Cases with Small/Odd Player Counts

**What goes wrong:** The greedy algorithm for pod assignment has edge cases that produce degenerate results:
- **4 players, round 2+:** Every player has already played against every other player. The algorithm cannot avoid repeats, but may stall or produce unexpected assignments if it doesn't handle the "all opponents exhausted" case.
- **5 players:** One pod of 4 + one bye. After round 1, the bye player gets priority, but the remaining 4 are the same pod as last round. With only 5 players, repeat opponents are guaranteed by round 2.
- **8 players, many rounds:** With exactly 2 pods, the algorithm quickly runs out of novel pairings. By round 3-4, the "minimize repeats" objective becomes impossible and the algorithm needs to degrade gracefully rather than loop or crash.
- **Players dropping mid-event:** A player drops, reducing the count from 8 to 7 (one pod of 4 + one pod of 3... but spec says pods must be 4). Now you have a pod of 4 + 3 byes, which is a terrible experience. Or worse, 5 active players: one pod of 4 + one bye, with 4 players getting the same opponents again.

**Why it happens:** The spec says "fewer than 4 players blocks round generation with error," but does not address what happens when exactly 4-7 players result in suboptimal pod sizes after accounting for byes. The greedy algorithm's "minimize repeats" objective has no good solution when the player pool is small relative to pod size.

**Consequences:** Players get the same opponents repeatedly and complain the algorithm is broken. Edge cases in the algorithm may cause infinite loops (searching for assignments that satisfy constraints that are mathematically impossible). Byes become disproportionately frequent at certain player counts (5, 6, 7 players).

**Prevention:**
1. Cap the repeat-avoidance goal: after exhausting possibilities, accept the least-repeated pairing. The greedy approach should track a "repeat score" and minimize it, not require zero repeats.
2. Handle the math explicitly for small player counts:
   - 4 players: 1 pod, no byes. All subsequent rounds are identical. Consider warning the admin.
   - 5 players: 1 pod + 1 bye. Repeats guaranteed by round 2. Consider 5-player pods as an option.
   - 6 players: 1 pod + 2 byes (bad) OR allow 3-player pods. Spec says pods of 4, but this edge case needs a decision.
   - 7 players: 1 pod + 3 byes (terrible). This is a design gap in the spec.
3. Add test cases for every player count from 4 to 20, for at least 5 rounds each. Assert no infinite loops, no crashes, and reasonable repeat counts.
4. Set a maximum iteration count on the greedy search to prevent infinite loops on unsolvable constraints.

**Detection:**
- Run the algorithm with 5 players for 4 rounds -- inspect output for sanity
- Run with 4 players for 3 rounds -- should not crash or loop
- Run with 8 players, have 3 drop, generate a new round -- should handle gracefully
- Performance test: 20 players, 10 rounds -- should complete in under 100ms

**Phase relevance:** Pod generation algorithm implementation and testing. Edge cases should be enumerated and tested BEFORE building the UI.

**Confidence:** MEDIUM -- the edge cases are derived from mathematical analysis of the problem space and [general MTG pod pairing discussions](https://apps.magicjudges.org/forum/topic/26928/), but the specific algorithm behavior depends on the implementation.

---

### Pitfall 8: Passphrase Validation Happens Client-Side

**What goes wrong:** The admin passphrase is validated in the browser: JavaScript checks if the entered passphrase matches a stored value, and if so, enables admin actions that directly write to Supabase tables via the anon key. This means any user can bypass the passphrase check using browser DevTools and issue admin API calls directly.

**Why it happens:** Client-side validation is simpler to implement. Without Supabase Auth, there's no built-in mechanism to tie "admin" status to a JWT claim. Developers store the passphrase (or its hash) in the client and compare locally.

**Consequences:** Any user can generate rounds, remove players, modify timers, or end events by calling the Supabase REST API directly. The passphrase provides zero actual security -- it's just a UI gate.

**Prevention:**
1. ALL admin actions must go through Supabase RPC functions (Postgres functions) or Edge Functions that accept the passphrase as a parameter and validate it server-side.
2. Store the passphrase as a bcrypt hash in the `events` table. The RPC function hashes the submitted passphrase and compares.
3. RLS policies for admin mutations (INSERT on rounds, DELETE on players, UPDATE on events) should deny direct table access via the anon role. Only the RPC function (running as `security definer` or with elevated privileges) can perform these mutations.
4. The client stores the passphrase in sessionStorage after first entry (as the spec describes), but this is purely for UX convenience -- the actual validation happens on every server call.

**Detection:**
- Open browser DevTools, call `supabase.from('rounds').insert(...)` directly -- should fail with an RLS error
- Try admin actions with a wrong passphrase via the RPC function -- should return an error
- Check that the events table does NOT store the passphrase in plaintext

**Phase relevance:** Must be the architecture from day one. Building admin actions as direct table writes and later wrapping them in RPC functions is a significant refactor of every admin feature.

**Confidence:** HIGH -- this is a fundamental web security principle, reinforced by [Supabase's own API security documentation](https://supabase.com/docs/guides/api/securing-your-api).

---

## Minor Pitfalls

---

### Pitfall 9: QR Code Scanning UX -- Users Don't Need to Scan In-App

**What goes wrong:** Developers build an in-app QR code scanner using the camera API (e.g., `html5-qrcode`), which requires camera permissions, has cross-browser compatibility issues (Samsung devices with black screens, Firefox requiring "Always Allow"), and adds unnecessary complexity. Meanwhile, every modern phone has a built-in QR scanner in the camera app or a system-level scanner.

**Why it happens:** The spec says "Players join by visiting event link or scanning QR code." Developers interpret this as needing to build a scanner. But the QR code is for *displaying*, not scanning in-app.

**Consequences:** Wasted development time on camera integration. Permission dialogs confuse users. Camera initialization fails on some devices. Users who deny camera permission can't join (even though they could just use their phone's native camera).

**Prevention:**
1. The app displays a QR code (using `qrcode.react`). Players scan it with their phone's native camera app, which opens the event URL in the browser. Done.
2. Do NOT build an in-app QR scanner. The shareable link + native camera scanning covers 100% of use cases.
3. Include a "Copy Link" button and a "Share" button (using the Web Share API where available) as alternatives to the QR code.

**Detection:**
- If the project includes a camera permission request or a QR scanning library dependency, it's over-engineered
- The only QR library needed is for *generating* QR codes, not reading them

**Phase relevance:** Event info bar / sharing feature. Avoid scope creep by explicitly deciding this early.

**Confidence:** HIGH -- this is a UX design decision, not a technical finding. The spec clearly states the QR code is for display.

---

### Pitfall 10: Supabase Free Tier Realtime Limits

**What goes wrong:** During development or a small deployment, the app hits Supabase free tier limits: 200 concurrent connections, 100 messages/second, and 100 channels per connection. A 16-player event with each player having a Realtime subscription is fine (16 connections), but if the developer leaves test connections open, has subscription leaks (Pitfall 4), or runs multiple events, limits get hit unexpectedly.

**Why it happens:** The free tier is generous for development but has hard limits. The 100 messages/second limit is more likely to bite: generating a round for 16 players creates writes to rounds, pods, and pod_players tables -- potentially 20+ Realtime messages in rapid succession.

**Consequences:** `too_many_connections` or `tenant_events` errors. Realtime stops working mid-event. No graceful degradation.

**Prevention:**
1. Use a single Realtime channel per event with multiple `.on()` handlers (not separate channels per table).
2. For the MVP / free tier, batch writes or accept that Realtime messages may be throttled during round generation. Add a manual "refresh" button as a fallback.
3. Monitor connection count during development. Clean up test subscriptions.
4. Plan for the Pro tier ($25/month) for any production deployment with multiple concurrent events.

**Detection:**
- Check the Supabase dashboard Realtime metrics for connection and message counts
- Watch for `too_many_channels` or `too_many_connections` WebSocket error frames

**Phase relevance:** Infrastructure/deployment planning.

**Confidence:** HIGH -- [limits are documented](https://supabase.com/docs/guides/realtime/limits) with specific numbers per tier.

---

### Pitfall 11: Realtime postgres_changes Does Not Deliver DELETE Payloads Through RLS

**What goes wrong:** When a player is removed (deleted from the players table), the Realtime DELETE event does not include the full row data when RLS is enabled. The client receives only the primary key of the deleted record. If the client-side player list is keyed by player name (not ID), or if the UI needs the player's name to show a "Player X was removed" toast, the information is not available in the Realtime payload.

**Why it happens:** Postgres cannot verify RLS policies on deleted records (the row no longer exists to check against), so Supabase strips the payload down to primary keys only. Additionally, DELETE events are not filterable -- you cannot filter Realtime DELETE events by `event_id`, so the client receives DELETE notifications for all events.

**Consequences:** Client-side state management breaks if it depends on the deleted record's data. Unfiltered DELETE events from other events could cause confusion if not handled correctly.

**Prevention:**
1. Use soft deletes instead of hard deletes: set `status = 'removed'` instead of deleting the row. This sends an UPDATE event with the full payload and respects RLS filters.
2. Key all client-side state by primary key (UUID), not by display name.
3. If hard deletes are required, maintain a client-side map of `id -> player data` so that when a DELETE event arrives with just the ID, the client can look up the name locally.
4. Filter Realtime DELETE events client-side by checking the ID against the local state.

**Phase relevance:** Database schema design and Realtime event handling. The soft-delete vs. hard-delete decision affects table design, RLS policies, and query patterns.

**Confidence:** HIGH -- [documented in Supabase Realtime postgres_changes docs](https://supabase.com/docs/guides/realtime/postgres-changes): "RLS policies are not applied to DELETE statements."

---

### Pitfall 12: Timezone and UTC Confusion in Timer Storage

**What goes wrong:** The timer's `started_at` timestamp is stored using the server's local time, or using `new Date()` on the client (which uses the device's local timezone). Different clients in different timezones, or clients with incorrect clock settings, calculate different remaining times.

**Why it happens:** JavaScript's `Date.now()` returns milliseconds since epoch (timezone-independent), but `new Date().toISOString()` vs `new Date().toString()` vs database `NOW()` can produce different timezone representations. Postgres `timestamp` vs `timestamptz` confusion compounds the issue.

**Consequences:** Timer shows wrong remaining time for some users. If one admin is in a different timezone (e.g., remote admin), timer calculations break.

**Prevention:**
1. Use `timestamptz` (timestamp with time zone) for ALL timestamp columns in Postgres. Never use bare `timestamp`.
2. Use Postgres `NOW()` (server-side) to set `started_at`, not a client-provided timestamp. This eliminates client clock variance entirely.
3. On the client, calculate remaining time as: `remaining = duration_seconds - ((Date.now() - Date.parse(started_at_utc)) / 1000)`. `Date.parse` correctly handles ISO 8601 strings with timezone offsets.
4. For the RPC function that starts/pauses timers, have the server set the timestamp.

**Detection:**
- Change your device clock forward by 30 minutes -- timer display should still be correct (because it's derived from server-set `started_at`)
- Compare timer on two devices in different timezone settings

**Phase relevance:** Timer data model design. The choice of `timestamptz` vs `timestamp` must be correct from the initial schema migration.

**Confidence:** HIGH -- timezone handling in Postgres is [well-documented](https://www.postgresql.org/docs/current/datatype-datetime.html) and a perennial source of bugs.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database schema + RLS | Pitfall 3 (RLS misconfiguration), Pitfall 8 (client-side passphrase), Pitfall 11 (DELETE payloads), Pitfall 12 (timezone) | Enable RLS on every table at creation. Use RPC functions for admin actions. Use `timestamptz`. Design soft deletes for player removal. |
| Supabase Realtime setup | Pitfall 1 (silent disconnections), Pitfall 4 (subscription leaks), Pitfall 10 (free tier limits) | Configure `worker: true` + `heartbeatCallback` at client init. Establish the useEffect cleanup pattern in the first component. Use one channel per event. |
| Pod generation algorithm | Pitfall 6 (race conditions), Pitfall 7 (small player edge cases) | Implement as a Postgres RPC function with advisory locks. Write exhaustive tests for player counts 4-20 before building UI. |
| Timer implementation | Pitfall 2 (setInterval timer), Pitfall 12 (timezone) | Calculate from server-set UTC timestamps on every frame. Use `requestAnimationFrame` for display. Re-derive on `visibilitychange`. |
| Notifications | Pitfall 5 (iOS PWA requirement) | Design visual timer-expiry alerts as the primary notification mechanism. Treat browser notifications as an enhancement, not a requirement. |
| Event sharing / QR | Pitfall 9 (in-app scanner) | Display-only QR code. No camera API. Copy link + Web Share API as alternatives. |

---

## Sources

### Official Documentation (HIGH confidence)
- [Supabase: Handling Silent Disconnections in Backgrounded Applications](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794)
- [Supabase: Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase: Securing Your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Chrome: Timer Throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- [MDN: Notification.requestPermission()](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

### GitHub Issues and Discussions (MEDIUM confidence)
- [supabase/realtime-js#121: WebSocket loses connection in background tabs](https://github.com/supabase/realtime-js/issues/121)
- [supabase/realtime#1088: Unable to reconnect after TIMED_OUT](https://github.com/supabase/realtime/issues/1088)
- [supabase/realtime-js#169: React Strict Mode double subscription](https://github.com/supabase/realtime-js/issues/169)
- [supabase discussions#30334: Race conditions with SERIALIZABLE isolation](https://github.com/orgs/supabase/discussions/30334)
- [supabase discussions#27513: Auto reconnect after CLOSED](https://github.com/orgs/supabase/discussions/27513)

### Community and Analysis (MEDIUM confidence)
- [Supabase Security Flaw: 170+ Apps Exposed by Missing RLS](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [PWA on iOS: Current Status and Limitations (2025)](https://brainhub.eu/library/pwa-on-ios)
- [Why Do Browsers Throttle JavaScript Timers?](https://nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers/)
- [Syncing Countdown Timers Across Multiple Clients](https://medium.com/@flowersayo/syncing-countdown-timers-across-multiple-clients-a-subtle-but-critical-challenge-384ba5fbef9a)
- [Supabase Realtime Client-Side Memory Leak](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak)
- [How to Handle Concurrent Writes in Supabase](https://bootstrapped.app/guide/how-to-handle-concurrent-writes-in-supabase)
