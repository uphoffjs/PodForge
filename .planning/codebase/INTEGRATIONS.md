---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
---

# External Integrations

**Analysis Date:** 2026-06-27

## APIs & External Services

**Supabase (primary backend):**
- SDK/Client: `@supabase/supabase-js` v2.97 — singleton client at `src/lib/supabase.ts`
- Auth vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Supabase client is initialized with `realtime.worker: true` and a custom `heartbeatCallback` that reconnects on disconnect
- All database access uses the **anon key** (no service role key in the frontend)

**Google Fonts CDN:**
- Fonts: Cinzel (display headings) + Inter (body text)
- Loaded via `<link>` tags in `index.html`
- No API key required; purely CDN delivery

## Data Storage

**Databases:**
- Supabase Postgres (hosted)
  - Connection env: `VITE_SUPABASE_URL`
  - Client: `@supabase/supabase-js` (PostgREST over HTTPS + WebSocket Realtime)
  - Schema managed via 4 migration files in `supabase/migrations/`

**Tables:**

| Table | Migration | Purpose |
|-------|-----------|---------|
| `events` | `00001_initial_schema.sql` | Event records; `passphrase_hash` column hidden from anon role via column-level grant |
| `players` | `00001_initial_schema.sql` | Player roster per event; unique constraint on `(event_id, name)` |
| `rounds` | `00002_rounds_pods_admin.sql` | Round records per event |
| `pods` | `00002_rounds_pods_admin.sql` | Pod assignments per round; `is_bye` flag |
| `pod_players` | `00002_rounds_pods_admin.sql` | Many-to-many: player-to-pod with `seat_number` |
| `round_timers` | `00004_timer_system.sql` | Server-authoritative timer per round; `expires_at`-based countdown |

**File Storage:**
- Not used. No Supabase Storage buckets, no S3 or CDN for file uploads.

**Caching:**
- TanStack Query in-memory cache only. No Redis, Memcached, or service worker cache.

## Authentication & Identity

**Admin Auth — Custom passphrase-based (no auth provider):**
- Implementation: `src/hooks/useAdminAuth.ts`
- Admin status is stored in `sessionStorage` under key `podforge_admin_<eventId>`
- Passphrase is sent with every admin mutation; validated server-side in each SECURITY DEFINER RPC
- No JWT, no Supabase Auth, no OAuth
- **Note:** Passphrase is stored plaintext in sessionStorage for the browser session duration

**Player Identity — localStorage:**
- Implementation: `src/lib/player-identity.ts`
- Player UUID stored in `localStorage` under key `podforge_player_<eventId>`
- Used to re-identify a returning player without re-joining
- No session tokens; identity is purely client-local

**No external auth provider is configured.** Supabase Auth (GoTrue) is not used.

## Supabase Realtime

**Purpose:** Push database change events to all connected clients without polling.

**Implementation:** `src/hooks/useEventChannel.ts` — single channel per event page visit.

**Subscribed tables and filters:**

| Table | Filter | Invalidates Query Key |
|-------|--------|-----------------------|
| `players` | `event_id=eq.<eventId>` | `['players', eventId]` |
| `events` | `id=eq.<eventId>` | `['event', eventId]` |
| `rounds` | `event_id=eq.<eventId>` | `['rounds', eventId]`, `['currentRound', eventId]` |
| `pods` | (none) | `['pods']`, `['allRoundsPods', eventId]` |
| `pod_players` | (none) | `['pods']`, `['allRoundsPods', eventId]` |
| `round_timers` | `event_id=eq.<eventId>` | `['timer', eventId]` |

**Replica identity:** `players`, `rounds`, and `round_timers` have `REPLICA IDENTITY FULL` set (`00003_realtime_replica_identity.sql`, `00004_timer_system.sql`) — required for Supabase Realtime to evaluate non-PK column filters.

## Supabase RPC Functions

All writes that require authorization go through SECURITY DEFINER RPC functions. Passphrase validation is performed inside each function server-side.

**Fully wired (called from frontend hooks):**

| RPC | Frontend Hook | Purpose |
|-----|--------------|---------|
| `create_event` | `src/hooks/useCreateEvent.ts` | Create event with hashed passphrase |
| `drop_player` | `src/hooks/useDropPlayer.ts` | Self-drop: player marks themselves dropped |
| `generate_round` | `src/hooks/useGenerateRound.ts` | Atomically create round + pods + pod_players + optional timer |
| `remove_player` | `src/hooks/useRemovePlayer.ts` | Admin: drop a player |
| `reactivate_player` | `src/hooks/useReactivatePlayer.ts` | Admin: restore a dropped player |
| `end_event` | `src/hooks/useEndEvent.ts` | Admin: end the event |
| `pause_timer` | `src/hooks/usePauseTimer.ts` | Admin: pause active round timer |
| `resume_timer` | `src/hooks/useResumeTimer.ts` | Admin: resume paused timer |
| `extend_timer` | `src/hooks/useExtendTimer.ts` | Admin: add 5 minutes to timer |
| `cancel_timer` | `src/hooks/useCancelTimer.ts` | Admin: cancel active/paused timer |

**DEPLOYED BUT UNUSED from frontend — `validate_passphrase`:**
- Defined in `supabase/migrations/00001_initial_schema.sql`
- Accepts `(p_event_id UUID, p_passphrase TEXT)` and returns `BOOLEAN`
- **Not called from any TypeScript hook or component.** Passphrase validation happens internally inside each admin RPC rather than as a standalone call.
- This function exists in the database but is dead code from the frontend's perspective.

## Direct REST (non-RPC) Supabase Queries

Player inserts (joining an event) use the PostgREST table API directly, not an RPC, because they don't require passphrase validation:

| Hook | Operation | Table |
|------|-----------|-------|
| `src/hooks/useJoinEvent.ts` | `.insert()` | `players` |
| `src/hooks/useEvent.ts` | `.select().single()` | `events` |
| `src/hooks/useEventPlayers.ts` | `.select().eq()` | `players` |
| `src/hooks/useCurrentRound.ts` | `.select().order().limit(1)` | `rounds` |
| `src/hooks/useRounds.ts` | `.select().order()` | `rounds` |
| `src/hooks/usePods.ts` | `.select('*, pod_players(*, players(*))').eq()` | `pods` (joined) |
| `src/hooks/useAllRoundsPods.ts` | `.select('*, pod_players(*, players(*))').in()` | `pods` (joined) |
| `src/hooks/useTimer.ts` | `.select().eq().in().order().limit(1).maybeSingle()` | `round_timers` |

## Browser APIs

**Web Notifications API:**
- Used in `src/hooks/useTimerNotification.ts` to fire a `"Time's Up!"` notification when the round timer expires
- Checks `'Notification' in window` for support detection
- Permission requested on explicit user button click (not on mount) — button shown in `src/components/TimerDisplay.tsx`
- Gracefully degrades on iOS PWA (Notification constructor may throw; caught and silently suppressed)

## Monitoring & Observability

**Error Tracking:**
- Not configured. No Sentry, Datadog, LogRocket, or equivalent.

**Logs:**
- `console.error` / `console.warn` in `useEventChannel.ts` for Realtime channel errors (`CHANNEL_ERROR`, `TIMED_OUT`)
- No structured logging library; no log aggregation pipeline.

## CI/CD & Deployment

**Hosting:**
- Vercel — static SPA hosting; build command `npm run build`, output `dist/`
- SPA routing handled automatically by Vercel for `/event/:eventId` paths

**CI Pipeline (GitHub Actions):**
- `ci.yml` — lint, type-check, unit tests + coverage on every push/PR to `main`
- `cypress.yml` — E2E tests on every push/PR to `main`; injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from GitHub Secrets
- `mutation.yml` — Stryker mutation test on PRs only

## Webhooks & Callbacks

**Incoming:**
- None. No Supabase Database Webhooks, no Stripe webhooks, no third-party inbound HTTP.

**Outgoing:**
- None. The app does not send HTTP requests to external webhook endpoints.

## Environment Configuration

**Required env vars (application):**
- `VITE_SUPABASE_URL` — Supabase project REST/Realtime URL
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key (safe to expose; RLS enforces security)

**Required in CI (GitHub Secrets):**
- `VITE_SUPABASE_URL` — consumed by Cypress CI workflow for the Vite dev server
- `VITE_SUPABASE_ANON_KEY` — same

**Cypress-specific env vars — CONFIGURED BUT EFFECTIVELY UNUSED:**
- `cypress.config.js` sets `env: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }` (blank strings)
- These are consumed only by `cy.createRealEvent()` in `cypress/support/commands.js`
- `createRealEvent` is **never called in any spec file** — it is a defined-but-dead Cypress command
- In CI, `cypress.yml` does NOT inject `SUPABASE_URL`/`SUPABASE_ANON_KEY` into Cypress env, only the VITE_ prefixed vars into the shell. Any future integration test using `createRealEvent` would need these added to both `cypress.config.js` and the CI workflow.

**Secrets location:**
- Local: `.env` (gitignored; not readable)
- Production: Vercel environment variables
- CI: GitHub repository secrets

---

*Integration audit: 2026-06-27*
