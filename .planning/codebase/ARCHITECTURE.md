---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
---

<!-- refreshed: 2026-06-27 -->
# Architecture

**Analysis Date:** 2026-06-27

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Browser SPA (React 19 / Vite)                 │
│                         src/app.tsx                              │
├─────────────────────────┬────────────────────────────────────────┤
│     LandingPage          │            EventPage                  │
│  src/pages/LandingPage.tsx │      src/pages/EventPage.tsx        │
│  (create / join entry)   │  (full event UI, all features)        │
└───────────┬──────────────┴───────────────────┬────────────────────┘
            │  renders                          │  renders
            ▼                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                  Component Layer  (src/components/)               │
│  Layout, EventInfoBar, JoinEventForm, PlayerList, PlayerItem      │
│  AdminControls, AdminPlayerActions, AdminPassphraseModal          │
│  AddPlayerForm, RoundDisplay, PodCard, PreviousRounds             │
│  TimerDisplay, TimerControls, QRCodeDisplay, ConfirmDialog        │
└───────────────────────┬───────────────────────────────────────────┘
                        │  calls
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Custom Hooks Layer  (src/hooks/)                │
│  Queries: useEvent, useEventPlayers, useCurrentRound, useRounds   │
│           usePods, useAllRoundsPods, useTimer                     │
│  Mutations: useCreateEvent, useJoinEvent, useDropPlayer           │
│             useAddPlayer, useRemovePlayer, useReactivatePlayer     │
│             useGenerateRound, useEndEvent                          │
│             usePauseTimer, useResumeTimer, useExtendTimer         │
│             useCancelTimer                                         │
│  Side-effects: useEventChannel (Realtime), useVisibilityRefetch   │
│                useAdminAuth, useCountdown, useTimerNotification   │
└───────────────────────┬───────────────────────────────────────────┘
                        │  calls
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                  Library Layer  (src/lib/)                        │
│  supabase.ts  — singleton Supabase client                        │
│  query-client.ts — singleton React Query client                  │
│  pod-algorithm.ts — pure pod generation logic                    │
│  player-identity.ts — localStorage helpers                       │
└───────────────────────┬───────────────────────────────────────────┘
                        │  HTTP / WebSocket
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│               Supabase Backend (external BaaS)                   │
│  PostgreSQL tables: events, players, rounds, pods,               │
│                     pod_players, round_timers                     │
│  RPC functions: create_event, drop_player, generate_round,       │
│                 end_event, remove_player, reactivate_player,     │
│                 pause_timer, resume_timer, extend_timer,         │
│                 cancel_timer                                      │
│  Realtime: supabase_realtime publication on all 6 tables         │
└───────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Router setup, QueryClientProvider, Toaster | `src/app.tsx` |
| `Layout` | Full-height surface wrapper, Outlet | `src/components/Layout.tsx` |
| `LandingPage` | Create event (modal) or join by ID/link | `src/pages/LandingPage.tsx` |
| `EventPage` | Root event view; orchestrates all sub-components | `src/pages/EventPage.tsx` |
| `CreateEventModal` | Form to create event with name + passphrase | `src/components/CreateEventModal.tsx` |
| `JoinEventForm` | Name input to join an event as a player | `src/components/JoinEventForm.tsx` |
| `EventInfoBar` | Event name, status, player count, QR code, share link | `src/components/EventInfoBar.tsx` |
| `QRCodeDisplay` | SVG QR code for the event URL | `src/components/QRCodeDisplay.tsx` |
| `PlayerList` | Active + dropped players; admin action slots | `src/components/PlayerList.tsx` |
| `PlayerItem` | Single player row with self/new highlight | `src/components/PlayerItem.tsx` |
| `AdminControls` | Generate round, end event, timer picker, pods-of-3 toggle | `src/components/AdminControls.tsx` |
| `AdminPlayerActions` | Per-player remove/reactivate buttons (admin only) | `src/components/AdminPlayerActions.tsx` |
| `AdminPassphraseModal` | Modal to enter admin passphrase on demand | `src/components/AdminPassphraseModal.tsx` |
| `AddPlayerForm` | Admin-only form to add a player by name | `src/components/AddPlayerForm.tsx` |
| `RoundDisplay` | Current round's pods grid | `src/components/RoundDisplay.tsx` |
| `PodCard` | Single pod card: players, seat ordinals, bye variant | `src/components/PodCard.tsx` |
| `PreviousRounds` | Collapsible accordion for past rounds | `src/components/PreviousRounds.tsx` |
| `TimerDisplay` | Sticky countdown, urgency styling, notification prompt | `src/components/TimerDisplay.tsx` |
| `TimerControls` | Pause/resume/extend/cancel buttons (admin only) | `src/components/TimerControls.tsx` |
| `ConfirmDialog` | Reusable confirmation modal | `src/components/ConfirmDialog.tsx` |

## Pattern Overview

**Overall:** React SPA with Supabase as BaaS — no custom API server.

**Key Characteristics:**
- All data fetching uses TanStack React Query; server state lives in the query cache
- All writes flow through Supabase RPC functions (SECURITY DEFINER) — direct table inserts only for player join and admin add-player (no passphrase required)
- Realtime updates via `useEventChannel` invalidate React Query keys; components re-render automatically
- Admin identity is passphrase-based: passphrase stored in `sessionStorage` per event, validated server-side on every protected RPC call
- Player identity is stored in `localStorage` per event (`podforge_player_{eventId}`); no user accounts exist
- Pod assignment algorithm (`src/lib/pod-algorithm.ts`) is a pure TypeScript function — runs entirely in the browser before calling the RPC

## Layers

**Pages Layer:**
- Purpose: Route-level components; manage page-wide state and compose sub-components
- Location: `src/pages/`
- Contains: `LandingPage.tsx`, `EventPage.tsx`
- Depends on: hooks layer, component layer
- Used by: router in `src/app.tsx`

**Component Layer:**
- Purpose: Presentational and stateful UI units; each handles one UI concern
- Location: `src/components/`
- Contains: 18 components (all `.tsx`)
- Depends on: hooks layer for data/mutations, lib layer for algorithm
- Used by: pages layer

**Hooks Layer:**
- Purpose: Encapsulate all data access (queries), mutations, and side-effects
- Location: `src/hooks/`
- Contains: 24 custom hooks (all `.ts`)
- Depends on: `src/lib/supabase.ts` (Supabase client), `src/lib/query-client.ts` (shared QueryClient)
- Used by: components and pages

**Library Layer:**
- Purpose: Singletons, pure functions, and utility helpers
- Location: `src/lib/`
- Contains: `supabase.ts`, `query-client.ts`, `pod-algorithm.ts`, `player-identity.ts`
- Depends on: nothing internal; external SDK imports only
- Used by: hooks layer, component layer (`AdminControls` imports algorithm directly)

**Database Layer:**
- Purpose: Authoritative data store and business logic enforcement
- Location: `supabase/migrations/` (schema applied to Supabase project)
- Contains: 4 migration files defining tables, RLS, RPC functions, Realtime publication
- Depends on: nothing (external BaaS)
- Used by: hooks layer via Supabase JS client

## Data Flow

### Primary Request Path — Generate a Round

1. Admin clicks "Generate Next Round" in `AdminControls` (`src/components/AdminControls.tsx:67`)
2. If no passphrase in sessionStorage, `onPassphraseNeeded()` triggers the `AdminPassphraseModal`
3. `generatePods()` called client-side with active players and full round history (`src/lib/pod-algorithm.ts:340`)
4. `useGenerateRound.mutate()` called with `podAssignments` and optional timer duration (`src/hooks/useGenerateRound.ts:21`)
5. Supabase RPC `generate_round` creates round, pods, pod_players, and optional timer atomically (`supabase/migrations/00004_timer_system.sql:47`)
6. `onSuccess` invalidates query keys: `rounds`, `currentRound`, `pods`, `allRoundsPods`, `timer` (`src/hooks/useGenerateRound.ts:33`)
7. `useEventChannel` Realtime events also fire, causing additional invalidations for other connected clients
8. `RoundDisplay` and `TimerDisplay` re-render via React Query refetch

### Player Join Flow

1. Player visits `/event/:eventId`, sees `JoinEventForm` (no stored identity in localStorage)
2. Submits name; `useJoinEvent.mutate(name)` inserts into `players` table directly (`src/hooks/useJoinEvent.ts:10`)
3. On success, `handleJoined(data.id)` stores player ID in localStorage via `storePlayerId` (`src/lib/player-identity.ts:7`)
4. `setCurrentPlayerId` triggers conditional UI renders (leave button, "(You)" label in pod cards)
5. Realtime broadcast fires on `players` table; all other event participants see the new player via query invalidation

### Timer Flow

1. Timer is created when admin generates a round with a selected duration (60/90/120 min)
2. `useTimer` polls the `round_timers` table for `running` or `paused` status (`src/hooks/useTimer.ts`)
3. `useCountdown` derives client-side countdown from `expires_at` (running) or `remaining_seconds` (paused) with 1-second `setInterval` (`src/hooks/useCountdown.ts`)
4. Admin can pause/resume/extend/cancel via `TimerControls`; each action calls a Supabase RPC which updates the row; Realtime delivers the change to all clients

### Tab Visibility Refresh

1. `useVisibilityRefetch` listens on `document.visibilitychange` (`src/hooks/useVisibilityRefetch.ts`)
2. On becoming visible, invalidates `players` and `event` queries (catch-up after backgrounding)

**State Management:**
- Server state: TanStack React Query cache (`src/lib/query-client.ts`)
- Admin auth: `sessionStorage` key `podforge_admin_{eventId}` managed by `useAdminAuth`
- Player identity: `localStorage` key `podforge_player_{eventId}` managed by `player-identity.ts`
- Local UI state: `useState` in individual components (modal open/close, show-dropped toggle, etc.)

## Key Abstractions

**Custom Hook per Operation:**
- Every Supabase query and mutation has its own dedicated hook file
- Pattern: `useGenerateRound(eventId)` returns a React Query mutation object
- Examples: `src/hooks/useGenerateRound.ts`, `src/hooks/useDropPlayer.ts`, `src/hooks/usePauseTimer.ts`

**Supabase RPC for Writes:**
- All passphrase-protected admin actions call a SECURITY DEFINER PL/pgSQL function via `supabase.rpc()`
- The passphrase is validated server-side on every call — never trusted client-side
- RPC functions perform all mutations atomically with full business-rule enforcement

**Pod Algorithm (Pure Function):**
- Purpose: Multi-start greedy + post-swap opponent diversity algorithm
- Location: `src/lib/pod-algorithm.ts`
- Pattern: Pure function, no side effects, no imports from the rest of the app
- Exported helpers: `generatePods`, `buildOpponentHistory`, `buildByeCounts`, `computePodSizes`, `greedyAssign`, `swapPass`, `podPenalty`, `totalPenalty`, `getOpponentScore`

**React Query Key Taxonomy:**
- `['event', eventId]` — single event row
- `['players', eventId]` — all players for an event
- `['rounds', eventId]` — all rounds for an event
- `['currentRound', eventId]` — latest round (limit 1)
- `['pods', roundId]` — pods for a specific round
- `['allRoundsPods', eventId, roundIds]` — pods for all rounds (for opponent history)
- `['timer', eventId]` — active timer for the event

## Entry Points

**Application Bootstrap:**
- Location: `src/main.tsx`
- Triggers: browser loads `index.html`, which imports `src/main.tsx`
- Responsibilities: renders `<App />` into `#root`

**Root App:**
- Location: `src/app.tsx`
- Triggers: `main.tsx` rendering
- Responsibilities: creates browser router, wraps tree in `QueryClientProvider` and `Toaster`

**Route: Landing Page (`/`):**
- Location: `src/pages/LandingPage.tsx`
- Triggers: user navigates to root
- Responsibilities: create event (modal) or join by pasting event ID/URL

**Route: Event Page (`/event/:eventId`):**
- Location: `src/pages/EventPage.tsx`
- Triggers: user navigates to `/event/{uuid}` (from share link, QR code, or post-creation redirect)
- Responsibilities: loads event data, manages player identity, renders all event features

## Full Functional Feature Map

### Complete and Wired Features

**Event Creation:**
- Entry: `LandingPage` → `CreateEventModal` → `useCreateEvent` → `create_event` RPC
- Output: event UUID returned, passphrase stored in sessionStorage, navigate to `/event/:id`
- Files: `src/pages/LandingPage.tsx`, `src/components/CreateEventModal.tsx`, `src/hooks/useCreateEvent.ts`

**Event Join (by player):**
- Entry: `EventPage` → `JoinEventForm` → `useJoinEvent` → direct insert to `players` table
- Output: player ID stored in localStorage, UI transitions to joined state
- Files: `src/pages/EventPage.tsx`, `src/components/JoinEventForm.tsx`, `src/hooks/useJoinEvent.ts`

**Player Self-Drop (Leave Event):**
- Entry: `EventPage` → "Leave Event" button → `ConfirmDialog` → `useDropPlayer` → `drop_player` RPC
- Output: player status set to `dropped`, localStorage cleared, join form re-shown
- Files: `src/pages/EventPage.tsx`, `src/hooks/useDropPlayer.ts`

**Admin Authentication (Passphrase):**
- Entry: any admin action → `onPassphraseNeeded()` → `AdminPassphraseModal`
- Stored: `sessionStorage['podforge_admin_{eventId}']`
- Files: `src/hooks/useAdminAuth.ts`, `src/components/AdminPassphraseModal.tsx`
- Note: `passphraseError` state in `EventPage` is allocated but never set to non-null — it is passed as `null` to `AdminPassphraseModal` always (dead state, see Concerns)

**Admin: Add Player:**
- Entry: `AddPlayerForm` → `useAddPlayer` → direct insert to `players` table
- Files: `src/components/AddPlayerForm.tsx`, `src/hooks/useAddPlayer.ts`

**Admin: Remove Player (drop):**
- Entry: `AdminPlayerActions` (Trash icon) → `ConfirmDialog` → `useRemovePlayer` → `remove_player` RPC
- Files: `src/components/AdminPlayerActions.tsx`, `src/hooks/useRemovePlayer.ts`

**Admin: Reactivate Player:**
- Entry: `AdminPlayerActions` (UserPlus icon, shown for dropped players) → `ConfirmDialog` → `useReactivatePlayer` → `reactivate_player` RPC
- Files: `src/components/AdminPlayerActions.tsx`, `src/hooks/useReactivatePlayer.ts`

**Pod Generation:**
- Entry: `AdminControls` → `generatePods()` (client algorithm) → `useGenerateRound` → `generate_round` RPC
- Algorithm: multi-start greedy (NUM_STARTS=20) + post-greedy swap pass + quadratic opponent penalty scoring
- Files: `src/components/AdminControls.tsx`, `src/lib/pod-algorithm.ts`, `src/hooks/useGenerateRound.ts`

**Pods of 3 Toggle:**
- Entry: Checkbox in `AdminControls` sets `allowPodsOf3` state → passed as 3rd arg to `generatePods()`
- Computes pod partitions via `computePodSizes(playerCount, allowPodsOf3)` to minimize byes
- Files: `src/components/AdminControls.tsx`, `src/lib/pod-algorithm.ts` (`computePodSizes`)

**Round Display (Current Round):**
- Entry: `useCurrentRound` → `RoundDisplay` → `usePods` → grid of `PodCard`
- Highlights current player's pod with accent color
- Files: `src/components/RoundDisplay.tsx`, `src/components/PodCard.tsx`, `src/hooks/usePods.ts`

**Previous Rounds Accordion:**
- Entry: `PreviousRounds` → `useRounds` → list of `PreviousRoundSection` (lazy-load pods on expand)
- Files: `src/components/PreviousRounds.tsx`, `src/hooks/useRounds.ts`

**Timer System:**
- Start: admin selects duration (60/90/120 min) in `AdminControls` before generating a round
- Display: `TimerDisplay` uses `useCountdown` (1s interval, client-derived from `expires_at`)
- Urgency states: `normal` (>10 min) → `warning` (5-10 min) → `danger` (0-5 min) → `expired` (overtime)
- Admin controls: pause, resume, extend (+5 min), cancel via `TimerControls` → dedicated RPCs
- Browser notifications: `useTimerNotification` fires Notification API when countdown reaches zero
- Files: `src/components/TimerDisplay.tsx`, `src/components/TimerControls.tsx`, `src/hooks/useTimer.ts`, `src/hooks/useCountdown.ts`, `src/hooks/useTimerNotification.ts`

**Event Sharing (QR Code + Link):**
- Entry: `EventInfoBar` → expandable QR section → `QRCodeDisplay`
- Copy-to-clipboard button via `navigator.clipboard`
- Files: `src/components/EventInfoBar.tsx`, `src/components/QRCodeDisplay.tsx`

**End Event:**
- Entry: `AdminControls` → "End Event" → `ConfirmDialog` → `useEndEvent` → `end_event` RPC
- Output: event `status` set to `ended`; all admin controls hidden; join form hidden; ended banner shown
- Files: `src/components/AdminControls.tsx`, `src/hooks/useEndEvent.ts`

**Realtime Sync:**
- Entry: `useEventChannel` subscribes to `postgres_changes` for all 6 tables filtered to the event
- On any change: targeted `queryClient.invalidateQueries()` calls cause automatic refetch
- Files: `src/hooks/useEventChannel.ts`

**New Player Highlight Animation:**
- `EventPage` tracks previous player IDs via `prevPlayerIdsRef`; detects newly added IDs
- `newPlayerIds` Set passed to `PlayerList` → `PlayerItem` triggers CSS animation for 400ms
- Files: `src/pages/EventPage.tsx`

### Incomplete / Stubbed / Partially Wired Flows

**DB minimum player check not updated for pods-of-3 (GAP):**
- Symptom: The `generate_round` RPC (`supabase/migrations/00004_timer_system.sql:89`) still hardcodes `IF v_active_count < 4 THEN RAISE EXCEPTION 'Fewer than 4 active players'`. The `allowPodsOf3` flag is a frontend-only parameter — it is NOT passed to the RPC.
- Impact: If an admin enables pods-of-3 and tries to generate a round with exactly 3 active players, the frontend algorithm succeeds (generates 1 pod of 3) but the RPC rejects it with "Fewer than 4 active players". Practical impact is limited to the edge case of exactly 3 players.
- Fix approach: Add `p_allow_pods_of_3 BOOLEAN DEFAULT FALSE` parameter to `generate_round` RPC and conditionally check `IF v_active_count < (CASE WHEN p_allow_pods_of_3 THEN 3 ELSE 4 END)`. Update `useGenerateRound` to pass the flag.
- Files involved: `supabase/migrations/` (new migration needed), `src/hooks/useGenerateRound.ts`

**`passphraseError` state in EventPage is dead (dead state):**
- Location: `src/pages/EventPage.tsx` lines 32, 145, 155
- `passphraseError` is initialized to `null` and reset to `null` in both `handlePassphraseSubmit` and `handlePassphraseCancel`. It is never set to a non-null value anywhere in `EventPage`.
- The prop `error={passphraseError}` passed to `AdminPassphraseModal` is always `null`.
- Impact: If the passphrase is wrong, the user gets a toast error but the modal does not re-open with an inline error message — the error path in `AdminPassphraseModal` is never exercised via this prop.
- Fix approach: Hook into `onError` callbacks of admin mutations to call `setPassphraseError('Invalid passphrase')` and re-open the modal.

**No game result tracking:**
- The app manages pods/seating but has no concept of match results or scores. There are no `results` or `scores` tables in the schema.
- This is likely intentional scope for a Commander pod organizer, but any future scoring feature would require a new DB migration and a new flows section.

**No PWA offline support:**
- `public/` contains only `vite.svg`; there is no `service-worker.js` or `manifest.json`
- Browser notifications are wired (`useTimerNotification`) but require the tab to be open

## Architectural Constraints

- **No server-side rendering:** Pure CSR SPA — no Next.js, no SSR. `index.html` at `src/../index.html`.
- **No custom API layer:** All network calls go directly from the browser to Supabase via the JS SDK. No Express/Fastify/etc.
- **Single page per route:** Only two routes — `/` and `/event/:eventId`. All event UI is one large page.
- **Threading:** Single-threaded. Supabase Realtime runs on a Web Worker (`worker: true` in `src/lib/supabase.ts`).
- **Global singletons:** `supabase` client (`src/lib/supabase.ts`) and `queryClient` (`src/lib/query-client.ts`) are module-level singletons imported everywhere.
- **No circular imports:** Hooks only import from `src/lib/`; components import from `src/hooks/` and other components; pages import both. No upward dependencies.
- **Passphrase is the only auth:** No user sessions, no JWT. Admin status is entirely determined by knowledge of the passphrase for a given event.

## Anti-Patterns

### Direct sessionStorage write in CreateEventModal

**What happens:** `CreateEventModal` writes directly to `sessionStorage` on event creation (`src/components/CreateEventModal.tsx:28`): `sessionStorage.setItem('podforge_admin_${eventId}', passphrase)`.
**Why it's wrong:** It duplicates the storage key format defined in `useAdminAuth.ts` (`STORAGE_KEY_PREFIX = 'podforge_admin_'`). If the prefix ever changes in `useAdminAuth`, `CreateEventModal` would break silently.
**Do this instead:** Call `setPassphrase()` from a `useAdminAuth` hook instance, or export a named function from `useAdminAuth` for this bootstrap scenario.

### Pod-history query uses unstable query key

**What happens:** `useAllRoundsPods` uses `['allRoundsPods', eventId, roundIds]` where `roundIds` is a new array reference on every render (`src/hooks/useAllRoundsPods.ts:7`).
**Why it's wrong:** React Query compares query keys structurally but array identity changes each render because `rounds?.map(r => r.id) ?? []` creates a new array. This may cause unnecessary re-fetches on renders.
**Do this instead:** Stable-sort or memoize `roundIds` in `AdminControls.tsx` with `useMemo` before passing to `useAllRoundsPods`.

## Error Handling

**Strategy:** React Query `onError` callbacks display toast notifications; no global error boundary.

**Patterns:**
- Passphrase errors (`INVALID PASSPHRASE`) are caught by string matching in every mutation's `onError` and show a targeted toast
- Duplicate name errors (Postgres `23505` unique violation) are detected by error code and show a user-friendly message
- Event-not-found and event-ended cases are caught by string matching in `useGenerateRound`
- Network/unknown errors fall through to a generic "Please try again" toast

## Cross-Cutting Concerns

**Logging:** `console.error` and `console.warn` only in `useEventChannel.ts` for Realtime channel errors/timeouts. No structured logging.
**Validation:** Client-side only for player names (min 2 chars, max 20 chars via `maxLength` attribute). Server enforces via DB constraints.
**Authentication:** Passphrase-based per event; no global auth provider; no JWT; no cookies.

---

*Architecture analysis: 2026-06-27*
