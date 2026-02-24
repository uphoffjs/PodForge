# Phase 1: Foundation and Player Flow - Research

**Researched:** 2026-02-23
**Domain:** Supabase schema + RLS, Realtime subscriptions, player join/drop flow, mobile-first dark UI
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire technical foundation: Supabase database with RLS, the React SPA scaffold, real-time player list, event creation/join flows, and the mobile-first dark theme. The stack is well-documented and stable -- React 19, Vite 7, Tailwind CSS v4, Supabase JS v2.95, React Router v7, and TanStack React Query v5 all have current official documentation with verified inter-compatibility.

The critical architectural decisions that must be correct from the start are: (1) RLS enabled on every table at creation time with column-level security hiding `passphrase_hash`, (2) Supabase Realtime client configured with `worker: true` and `heartbeatCallback` to prevent silent disconnections on mobile, (3) React Query as the single source of truth for server state with Realtime triggering invalidation (not direct state mutation), and (4) all admin-gated writes routed through Supabase RPC functions with server-side passphrase validation via pgcrypto.

The riskiest area is the intersection of Supabase Realtime, RLS, and the anon role (no authentication). Since this app has no user accounts, all clients connect as the `anon` Postgres role. Realtime `postgres_changes` events are delivered based on RLS SELECT policies, so a `USING (true)` policy on the `anon` role allows all connected clients to receive change events. This is the correct behavior for this app -- player lists and event data are intentionally public per-event. The risk is accidentally exposing the `passphrase_hash` column, which is mitigated by column-level privilege revocation.

**Primary recommendation:** Build the Supabase schema + RLS policies + RPC function skeletons first, then scaffold the React app, then wire up event creation/join with Realtime. Do not write any feature code before the database security layer is proven.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Landing page is minimal -- just actions, no fluff. Big "Create Event" button + join field + QR scan option
- Join supports both URL/event code input AND QR code scanning
- Event creation is a single-step modal: event name + passphrase + create. No multi-step wizard
- After creating, admin is prompted to enter their own name to join as a player (with option to skip), then lands on the event page
- No site-wide gate -- anyone can create an event
- When a player opens an event link, they see a name input front and center ("Enter your name to join") with the player list visible behind it
- Player's own name is visually highlighted (distinct color/bold) in the list -- no "(you)" tag
- localStorage persistence: store player ID so returning to the event link recognizes them automatically
- Name validation: minimum 2 characters, maximum 20 characters, no duplicates within event (friendly error on collision)
- Simple vertical list, one name per row. Clean and scannable
- Header shows count: "Players (12 active, 3 dropped)"
- Dropped players collapsed by default ("Dropped (3)" expands on tap), grayed out when visible
- "Leave Event" button is a separate action outside the player list, not inline. More deliberate
- Confirmation required before dropping
- MTG-themed dark: deep purple/blue tones, subtle fantasy texture hints. Feels like the game, not a generic dark mode
- Typography: slightly stylized -- display font for headers (some personality), clean sans-serif for body text. Must be readable at arm's length
- Real-time updates: brief highlight animation when a new player joins (background flash, then settles). Noticeable but not distracting
- No slow animations. Speed matters when 15 people are staring at their phones

### Claude's Discretion
- Accent color choice (whatever pops against purple/blue dark theme)
- Exact font pairing (display + body)
- Loading states and error state styling
- Exact card/container styling (borders, shadows, rounding)
- Mobile breakpoints and responsive behavior
- Supabase schema details and RLS implementation

### Deferred Ideas (OUT OF SCOPE)
- User accounts / persistent usernames across events -- potential future phase
- Player profiles with stats -- mentioned in v2 requirements
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVNT-01 | User can create a new event with a name and admin passphrase | Supabase RPC function `create_event` using pgcrypto `crypt()/gen_salt('bf')` for passphrase hashing; returns event ID for URL construction |
| EVNT-02 | User can join an event by visiting the event link and entering their name | React Router route `/event/:eventId` with name input form; Supabase `players` table INSERT with `UNIQUE(event_id, name)` constraint; localStorage stores player ID for recognition |
| EVNT-03 | User can join an event by scanning a QR code and entering their name | `qrcode.react` v4.2 `QRCodeSVG` component renders event URL as QR code; native phone camera scans it (no in-app scanner); same join flow as EVNT-02 after URL opens |
| PLYR-01 | All connected clients see the real-time player list (active + collapsed dropped section) | Supabase Realtime `postgres_changes` on `players` table filtered by `event_id`; React Query invalidation on change; one channel per event with proper cleanup |
| PLYR-02 | Player can self-drop from an event with confirmation | Supabase RPC function or direct UPDATE (player sets own `status = 'dropped'`); RLS policy allows update to `dropped` status; confirmation dialog before action |
| PLYR-05 | Duplicate player names within an event are prevented with a friendly error message | `UNIQUE(event_id, name)` constraint on `players` table; catch Postgres unique violation error (code 23505) and display friendly message |
| INFR-01 | All state changes push to all clients via Supabase Realtime | Single Realtime channel per event subscribing to `postgres_changes` on `players` and `events` tables; `worker: true` + `heartbeatCallback` config; Page Visibility API re-fetch on tab restore |
| INFR-02 | Admin passphrase validated server-side via Supabase RPC; session-stored after first successful entry | `create_event` RPC hashes passphrase with pgcrypto; `validate_passphrase` RPC compares input against stored hash; client stores passphrase in sessionStorage after success |
| INFR-03 | Mobile-first dark theme with glanceable display, minimal chrome, no slow animations | Tailwind CSS v4 with `@custom-variant dark` forced via `.dark` class on HTML element; MTG-inspired deep purple/blue palette; display + sans-serif font pairing |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | UI framework | Current stable. No SSR needed -- pure SPA. |
| Vite | ^7.3.1 | Build tool + dev server | Standard for React SPAs. Sub-second HMR, native TS. Requires Node 20.19+ or 22.12+. |
| TypeScript | ^5.9.3 | Type safety | Current stable. Do NOT use 6.0 beta. |
| Supabase JS | ^2.95.2 | Backend client | Postgres + Realtime + RPC. No custom backend needed. |
| React Router | ^7.13.0 | Client-side routing | v7 Library Mode (not Framework Mode). Import `RouterProvider` from `react-router/dom`, everything else from `react-router`. Only `react-router` needed in package.json. |
| TanStack React Query | ^5.84 | Server state management | All DB reads go through React Query. Realtime triggers `invalidateQueries`, not direct state mutation. |
| Tailwind CSS | ^4.2.0 | Utility-first CSS | v4 with CSS-first config via `@theme` directive. No `tailwind.config.js` needed. |
| @tailwindcss/vite | ^4.2.0 | Tailwind Vite plugin | First-party plugin. Zero config -- add to vite.config.ts and `@import "tailwindcss"` in CSS. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrcode.react | ^4.2.0 | QR code generation | Display event URL as scannable QR. `QRCodeSVG` component. React 19 peer dep confirmed. |
| sonner | ^2.x | Toast notifications | "Player joined", error messages, copy confirmations. 2-3KB, no hooks needed. |
| lucide-react | ^0.575.0 | Icons | Tree-shakeable SVG icons. Copy, share, expand, user icons. |
| @tanstack/react-query | ^5.84 | React Query core | Required for `QueryClientProvider`, `useQuery`, `useMutation`, `useQueryClient`. |

### Dev Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Vitest | ^4.0.18 | Test runner (shares Vite config) |
| @testing-library/react | ^16.3.2 | Component testing |
| @testing-library/dom | ^10.x | Required peer dep for RTL |
| @testing-library/jest-dom | ^6.9.1 | DOM assertion matchers |
| @testing-library/user-event | ^14.6.1 | User interaction simulation |
| jsdom | latest | Browser env for Vitest |
| @types/bcryptjs | latest | Types (if bcryptjs used client-side) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Query for state | Zustand or React Context | React Query is better for server state (caching, stale-while-revalidate, deduplication). Start with Query; add Zustand only if complex client-only state emerges. |
| Column-level security for passphrase_hash | Database view (`public_events`) | View approach is simpler but breaks Realtime subscriptions (postgres_changes listens to tables, not views). Column-level privilege revocation is the correct pattern here. |
| pgcrypto server-side hashing | bcryptjs client-side hashing | pgcrypto in RPC is more secure (passphrase never compared client-side). Client-side bcryptjs was the original stack research recommendation, but server-side pgcrypto is better for this passphrase-gated model. |

**Installation:**
```bash
# Scaffold project
npm create vite@latest pod-pairer -- --template react-swc-ts

# Core dependencies
npm install react react-dom @supabase/supabase-js react-router @tanstack/react-query qrcode.react sonner lucide-react

# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Dev dependencies -- testing
npm install -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app.tsx                  # Root component: QueryClientProvider + RouterProvider + Toaster
  app.css                  # Tailwind imports + @theme + @custom-variant dark
  main.tsx                 # Entry: ReactDOM.createRoot
  lib/
    supabase.ts            # Supabase client singleton (worker: true, heartbeatCallback)
    query-client.ts        # QueryClient singleton with default options
  hooks/
    useEventChannel.ts     # Realtime subscription (one channel per event, cleanup)
    useEventPlayers.ts     # React Query: fetch players for event
    useEvent.ts            # React Query: fetch event details
    useJoinEvent.ts        # React Query mutation: insert player
    useDropPlayer.ts       # React Query mutation: update player status
    useAdminAuth.ts        # sessionStorage passphrase management
    useCreateEvent.ts      # React Query mutation: RPC create_event
    useVisibilityRefetch.ts # Page Visibility API: refetch on tab restore
  pages/
    LandingPage.tsx        # Create event + join by code/link
    EventPage.tsx          # Player list, join form, QR display
  components/
    CreateEventModal.tsx   # Event name + passphrase modal
    JoinEventForm.tsx      # Name input for joining
    PlayerList.tsx         # Active players + collapsed dropped section
    PlayerItem.tsx         # Single player row (highlighted if self)
    QRCodeDisplay.tsx      # qrcode.react QRCodeSVG wrapper
    ConfirmDialog.tsx      # Reusable confirmation dialog
    Layout.tsx             # Dark theme wrapper, common layout
  types/
    database.ts            # Generated or manual Supabase types
supabase/
  migrations/
    00001_initial_schema.sql  # Tables, RLS, RPC functions, pgcrypto
```

### Pattern 1: Supabase Client Singleton with Realtime Worker Mode

**What:** Create one Supabase client instance with `worker: true` and `heartbeatCallback` configured. Export and reuse everywhere.
**When:** Always -- this is the foundation for all Supabase interactions.
**Why:** Mobile browsers throttle JavaScript timers in background tabs. `worker: true` offloads heartbeat logic to a Web Worker, preventing silent disconnections. The `heartbeatCallback` provides a fallback reconnection mechanism.
**Confidence:** HIGH (verified via [Supabase troubleshooting docs](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794))

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

### Pattern 2: React Query as State Owner + Realtime as Invalidation Trigger

**What:** All data fetching goes through React Query hooks (`useQuery`). Supabase Realtime `postgres_changes` events trigger `queryClient.invalidateQueries()`, NOT direct state updates.
**When:** For all database-backed state (players, events).
**Why:** Realtime delivers deltas (change events), not full snapshots. Merging deltas into local state is error-prone -- you miss events during reconnection, DELETE events with RLS only deliver primary keys, and you end up building a mini reconciliation engine. React Query's invalidation model is simple: event arrives, mark stale, refetch full state, re-render.
**Confidence:** HIGH (verified via [Supabase docs](https://supabase.com/docs/guides/realtime/postgres-changes) and [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation))

```typescript
// src/hooks/useEventChannel.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEventChannel(eventId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['players', eventId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event', eventId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, queryClient])
}
```

### Pattern 3: Page Visibility API for Tab Restore

**What:** When a mobile browser tab is restored from background, immediately refetch all queries for the current event to sync stale state.
**When:** Always -- complements the Realtime worker mode. Even with `worker: true`, network interruptions during backgrounding may cause missed events.
**Why:** Mobile users background the app constantly (switching to text messages, checking other apps). When they return, the displayed data may be seconds or minutes stale. This hook forces a fresh fetch.
**Confidence:** HIGH (standard web API, recommended by [Supabase troubleshooting docs](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794))

```typescript
// src/hooks/useVisibilityRefetch.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useVisibilityRefetch(eventId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['players', eventId] })
        queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [eventId, queryClient])
}
```

### Pattern 4: localStorage Player Identity Persistence

**What:** After a player joins an event, store their `player_id` in localStorage keyed by `event_id`. When they revisit the event URL, check localStorage and auto-recognize them without re-entering their name.
**When:** On every event page load, before showing the join form.
**Why:** User decision from CONTEXT.md. Players at a game store may close/reopen their browser, switch tabs, or accidentally navigate away. Storing the player ID locally prevents them from needing to re-join.
**Confidence:** HIGH (standard localStorage pattern)

```typescript
// Player identity storage
const PLAYER_KEY_PREFIX = 'pod_pairer_player_'

export function getStoredPlayerId(eventId: string): string | null {
  return localStorage.getItem(`${PLAYER_KEY_PREFIX}${eventId}`)
}

export function storePlayerId(eventId: string, playerId: string): void {
  localStorage.setItem(`${PLAYER_KEY_PREFIX}${eventId}`, playerId)
}

export function clearPlayerId(eventId: string): void {
  localStorage.removeItem(`${PLAYER_KEY_PREFIX}${eventId}`)
}
```

### Pattern 5: Admin Passphrase via Server-Side RPC + Session Storage

**What:** Admin actions call Supabase RPC functions that accept the passphrase as a parameter. The Postgres function compares against a bcrypt hash using pgcrypto. After first successful validation, the passphrase is stored in sessionStorage for UX convenience.
**When:** Event creation (hash + store), any admin action (validate + execute).
**Why:** The anon key is public (embedded in client JS). Without server-side validation, anyone could call the Supabase REST API directly to perform admin actions. RPC functions with `SECURITY DEFINER` run with elevated privileges and can validate the passphrase before executing mutations.
**Confidence:** HIGH (verified via [Supabase RPC docs](https://supabase.com/docs/reference/javascript/rpc), [pgcrypto docs](https://www.postgresql.org/docs/current/pgcrypto.html), [Supabase security docs](https://supabase.com/docs/guides/api/securing-your-api))

### Pattern 6: Forced Dark Theme with Tailwind CSS v4

**What:** Use `@custom-variant dark` in CSS and apply the `.dark` class to the `<html>` element permanently. All dark-mode styles use the `dark:` prefix. Define MTG-themed custom colors via `@theme`.
**When:** Always -- this app is dark-only by design.
**Why:** User decision from CONTEXT.md specifies MTG-themed dark with deep purple/blue tones. No light mode toggle needed. Forced dark via `.dark` class on `<html>` is the simplest approach.
**Confidence:** HIGH (verified via [Tailwind CSS v4 dark mode docs](https://tailwindcss.com/docs/dark-mode))

```css
/* src/app.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* MTG-inspired dark palette */
  --color-surface: #0f0a1a;
  --color-surface-raised: #1a1128;
  --color-surface-overlay: #241a35;
  --color-border: #2e2445;
  --color-border-bright: #4a3a6b;

  /* Accent -- Claude's discretion: amber/gold pops against purple */
  --color-accent: #f59e0b;
  --color-accent-bright: #fbbf24;

  /* Player highlight */
  --color-self-highlight: #7c3aed;

  /* Text */
  --color-text-primary: #f0edf5;
  --color-text-secondary: #a89bc2;
  --color-text-muted: #6b5c85;

  /* Status */
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;

  /* Fonts */
  --font-display: "Cinzel", serif;
  --font-body: "Inter", sans-serif;

  /* Animation -- fast only */
  --animate-flash: flash 0.4s ease-out;

  @keyframes flash {
    0% { background-color: var(--color-accent); opacity: 0.3; }
    100% { background-color: transparent; opacity: 1; }
  }
}
```

```html
<!-- index.html -->
<html lang="en" class="dark">
  <!-- dark class forces dark mode permanently -->
```

### Anti-Patterns to Avoid

- **Direct state mutation from Realtime events:** Do NOT splice Realtime payloads into a React state array. Use React Query invalidation. DELETE events with RLS only deliver primary keys, not full records.
- **Client-side passphrase validation:** Do NOT read the passphrase hash from the database and compare in JavaScript. All validation happens in Postgres RPC functions.
- **One Realtime channel per table:** Do NOT create separate channels for `players`, `events`, etc. Use one channel per event with multiple `.on()` handlers. Reduces channel count and simplifies cleanup.
- **Missing useEffect cleanup:** Do NOT create Realtime channels without returning `() => supabase.removeChannel(channel)` from the useEffect. React Strict Mode double-invokes effects -- without cleanup, channels accumulate.
- **SELECT * on events table:** After revoking column access to `passphrase_hash`, you MUST explicitly list columns in SELECT queries. `SELECT *` will fail for the anon role.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Canvas-based QR renderer | `qrcode.react` `QRCodeSVG` | Handles error correction levels, sizing, margins. 10 edge cases you'd miss. |
| QR code scanning | Camera API + `html5-qrcode` | Native phone camera app | Every modern phone scans QR codes natively. Camera API is unreliable cross-browser. |
| Passphrase hashing | Custom hash function or SHA-256 | pgcrypto `crypt()` + `gen_salt('bf')` | bcrypt is purpose-built for password hashing with GPU/ASIC resistance. SHA-256 is not. |
| Toast notifications | Custom notification component | `sonner` | 2-3KB, no hooks, works from anywhere. Styling, animation, stacking all handled. |
| Server state caching | Manual state management with `useState` | TanStack React Query | Caching, deduplication, stale-while-revalidate, background refetch, loading/error states -- all free. |
| Real-time sync engine | WebSocket message merging into local state | Supabase Realtime + React Query invalidation | The invalidation pattern is 10 lines of code. A custom sync engine is hundreds of lines and has consistency bugs. |
| Unique name validation | Client-side duplicate check | Postgres `UNIQUE(event_id, name)` constraint | Database constraint is atomic and race-condition-free. Client-side checks miss concurrent joins. |

**Key insight:** This phase has almost no novel logic. Every component maps to a well-documented library feature or database primitive. The value is in wiring them together correctly, not in building custom solutions.

## Common Pitfalls

### Pitfall 1: Forgetting to Add Tables to supabase_realtime Publication

**What goes wrong:** You set up Realtime subscriptions, but no events are delivered. The subscription connects successfully (status: `SUBSCRIBED`) but the callback never fires.
**Why it happens:** Supabase Realtime `postgres_changes` only works for tables added to the `supabase_realtime` publication. New tables are NOT added automatically.
**How to avoid:** In the initial migration, immediately after creating each table, run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
```
**Warning signs:** Subscription status is `SUBSCRIBED` but no payloads arrive after INSERTs/UPDATEs.
**Confidence:** HIGH (verified via [Supabase postgres_changes docs](https://supabase.com/docs/guides/realtime/postgres-changes))

### Pitfall 2: RLS Blocks Realtime Events for Anon Users

**What goes wrong:** Realtime subscriptions are set up, tables are in the publication, but the anon-role client receives no events because RLS policies don't grant SELECT to the `anon` role.
**Why it happens:** Supabase Realtime checks RLS policies before delivering `postgres_changes` events. If the anon role cannot SELECT the row, the event is not delivered. Many RLS tutorials assume authenticated users (`auth.uid()`).
**How to avoid:** Every table in this app needs a SELECT policy for anon:
```sql
CREATE POLICY "Anyone can read" ON players FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can read" ON events FOR SELECT TO anon USING (true);
```
**Warning signs:** REST API queries return data, but Realtime subscriptions deliver nothing.
**Confidence:** HIGH (verified via [Supabase Realtime authorization docs](https://supabase.com/docs/guides/realtime/authorization))

### Pitfall 3: Column-Level Security Breaks SELECT * Queries

**What goes wrong:** After revoking `SELECT (passphrase_hash)` from `anon` on the `events` table, queries using `supabase.from('events').select('*')` fail with a permission error.
**Why it happens:** With column-level restrictions, the wildcard `*` includes the restricted column, and Postgres denies the query entirely.
**How to avoid:** Always use explicit column lists:
```typescript
// WRONG: will fail after column restriction
supabase.from('events').select('*')

// CORRECT: explicit columns
supabase.from('events').select('id, name, status, created_at')
```
**Warning signs:** Queries that worked before column restriction suddenly return permission errors.
**Confidence:** HIGH (verified via [Supabase column-level security docs](https://supabase.com/docs/guides/database/postgres/column-level-security))

### Pitfall 4: pgcrypto Functions in extensions Schema

**What goes wrong:** The migration calls `crypt()` or `gen_salt()` and gets "function does not exist" errors, even though `pgcrypto` is enabled.
**Why it happens:** Supabase installs pgcrypto in the `extensions` schema, not `public`. The function needs to be referenced as `extensions.crypt()` or the search path must include `extensions`.
**How to avoid:** Either qualify function calls:
```sql
extensions.crypt(p_passphrase, extensions.gen_salt('bf'))
```
Or set the search path in the function:
```sql
CREATE FUNCTION create_event(...) ... SET search_path = public, extensions AS $$
```
**Warning signs:** `function crypt(text, text) does not exist` error in migration.
**Confidence:** HIGH (verified via [Supabase extensions docs](https://supabase.com/docs/guides/database/extensions) and [GitHub discussion](https://github.com/supabase/cli/issues/568))

### Pitfall 5: React Strict Mode Double-Subscribes to Realtime

**What goes wrong:** In development, every Realtime subscription is created twice because React Strict Mode double-invokes `useEffect`. Without proper cleanup, you get duplicate event handlers and eventually hit the 100-channel limit.
**Why it happens:** React 18+ Strict Mode deliberately mounts, unmounts, and remounts components to catch cleanup bugs. If `useEffect` creates a channel but doesn't clean it up, you get two channels after the double-invoke.
**How to avoid:** Always return cleanup from useEffect:
```typescript
useEffect(() => {
  const channel = supabase.channel(`event:${eventId}`)
    .on('postgres_changes', { ... }, handler)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [eventId])
```
Use `supabase.removeChannel(channel)` -- not just `channel.unsubscribe()` -- to fully clean up.
**Warning signs:** Duplicate player entries appearing in the list, channel count growing on each navigation.
**Confidence:** HIGH (verified via [supabase/realtime-js#169](https://github.com/supabase/realtime-js/issues/169))

### Pitfall 6: Unique Constraint Error Not Caught Gracefully

**What goes wrong:** When a player tries to join with a duplicate name, the Supabase insert returns a Postgres error (code 23505), but the UI shows a generic "Something went wrong" instead of "That name is already taken."
**Why it happens:** Developers catch the error but don't inspect the error code. Supabase returns `{ error: { code: '23505', message: '...' } }` for unique constraint violations.
**How to avoid:** Check the error code explicitly:
```typescript
const { error } = await supabase.from('players').insert({ event_id: eventId, name })
if (error?.code === '23505') {
  toast.error('That name is already taken. Try another!')
} else if (error) {
  toast.error('Something went wrong. Please try again.')
}
```
**Warning signs:** Users see technical error messages instead of friendly guidance.
**Confidence:** HIGH (standard Postgres error code handling)

## Code Examples

Verified patterns from official sources:

### Supabase Client Initialization

```typescript
// src/lib/supabase.ts
// Source: Supabase troubleshooting docs (silent disconnections)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

### React Query Client Configuration

```typescript
// src/lib/query-client.ts
// Source: TanStack React Query docs
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,  // 30s -- Realtime handles freshness via invalidation
      gcTime: 1000 * 60 * 5,  // 5 min garbage collection
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
})
```

### App Root with Providers

```tsx
// src/app.tsx
// Source: React Router v7 docs (Library Mode) + TanStack Query docs
import { createBrowserRouter, Outlet } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'event/:eventId', element: <EventPage /> },
    ],
  },
])

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  )
}

function Layout() {
  return (
    <div className="min-h-screen bg-surface text-text-primary font-body">
      <Outlet />
    </div>
  )
}
```

### Database Migration: Schema + RLS + RPC

```sql
-- supabase/migrations/00001_initial_schema.sql
-- Source: Supabase RLS docs, pgcrypto docs, Supabase Realtime docs

-- Enable pgcrypto for passphrase hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  passphrase_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 20),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, name)
);

-- Enable RLS on ALL tables immediately
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Column-level security: hide passphrase_hash from anon
REVOKE SELECT ON events FROM anon;
GRANT SELECT (id, name, status, created_at) ON events TO anon;

-- RLS: public read for anon role
CREATE POLICY "Anyone can read events"
  ON events FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can read players"
  ON players FOR SELECT TO anon USING (true);

-- RLS: players can insert themselves (join event)
CREATE POLICY "Anyone can join an event"
  ON players FOR INSERT TO anon
  WITH CHECK (status = 'active');

-- RLS: players can update their own status to dropped (self-drop)
-- Note: without auth, we use RPC for this to identify the player by ID
CREATE POLICY "Players can drop themselves via RPC"
  ON players FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'dropped');

-- Add tables to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- RPC: Create event with hashed passphrase
CREATE OR REPLACE FUNCTION create_event(
  p_name TEXT,
  p_passphrase TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (name, passphrase_hash)
  VALUES (p_name, crypt(p_passphrase, gen_salt('bf')))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- RPC: Validate passphrase (used before admin actions)
CREATE OR REPLACE FUNCTION validate_passphrase(
  p_event_id UUID,
  p_passphrase TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT passphrase_hash INTO v_hash
  FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN v_hash = crypt(p_passphrase, v_hash);
END;
$$;

-- RPC: Self-drop (player updates own status)
CREATE OR REPLACE FUNCTION drop_player(
  p_player_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players SET status = 'dropped'
  WHERE id = p_player_id AND status = 'active';
END;
$$;
```

### React Query Data Hooks

```typescript
// src/hooks/useEvent.ts
// Source: TanStack Query docs + Supabase JS docs
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, status, created_at')  // explicit columns (no *)
        .eq('id', eventId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!eventId,
  })
}
```

```typescript
// src/hooks/useEventPlayers.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEventPlayers(eventId: string) {
  return useQuery({
    queryKey: ['players', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })
}
```

```typescript
// src/hooks/useJoinEvent.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { storePlayerId } from '@/lib/player-identity'
import { toast } from 'sonner'

export function useJoinEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('players')
        .insert({ event_id: eventId, name })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      storePlayerId(eventId, data.id)
      queryClient.invalidateQueries({ queryKey: ['players', eventId] })
      toast.success('Joined the event!')
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('That name is already taken. Try another!')
      } else {
        toast.error('Failed to join. Please try again.')
      }
    },
  })
}
```

### QR Code Display

```tsx
// src/components/QRCodeDisplay.tsx
// Source: qrcode.react v4 docs
import { QRCodeSVG } from 'qrcode.react'

interface QRCodeDisplayProps {
  eventId: string
}

export function QRCodeDisplay({ eventId }: QRCodeDisplayProps) {
  const eventUrl = `${window.location.origin}/event/${eventId}`

  return (
    <div className="bg-white p-3 rounded-lg inline-block">
      <QRCodeSVG
        value={eventUrl}
        size={200}
        level="M"
        marginSize={2}
      />
    </div>
  )
}
```

### Vite Configuration

```typescript
// vite.config.ts
// Source: Vite docs, Tailwind CSS v4 docs, Vitest docs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` (JS config) | `@theme` directive in CSS | Tailwind v4 (Jan 2025) | No config file needed. All customization in CSS. `@custom-variant` replaces `darkMode` config. |
| `react-router-dom` package | `react-router` unified package | React Router v7 (2025) | Only install `react-router`. Import `RouterProvider` from `react-router/dom`, everything else from `react-router`. |
| `react-router-dom` `<BrowserRouter>` | `createBrowserRouter` + `RouterProvider` | React Router v6.4+ | Data mode enables loaders/actions. Required for modern patterns. |
| `ReactQueryCacheProvider` | `QueryClientProvider` | TanStack Query v4+ | Single `QueryClient` instance provides cache to component tree. |
| Supabase Realtime without worker | `worker: true` + `heartbeatCallback` | Supabase docs 2025 | Prevents silent disconnections on mobile. Must be configured at client creation. |
| PostCSS plugin for Tailwind | `@tailwindcss/vite` plugin | Tailwind v4 (Jan 2025) | First-party Vite plugin. Faster, simpler, zero config. |

**Deprecated/outdated:**
- `react-router-dom` as a separate package -- use `react-router` only
- `tailwind.config.js` / `tailwind.config.ts` -- use `@theme` in CSS
- `includeMargin` prop on qrcode.react -- use `marginSize` instead
- Happy-dom for Vitest -- use jsdom when Notification API mocking is needed

## Open Questions

1. **Player self-drop RLS policy scope**
   - What we know: The UPDATE policy `USING (true) WITH CHECK (status = 'dropped')` allows any anon user to set any player's status to dropped. Without auth, there's no `auth.uid()` to scope updates to "own" record.
   - What's unclear: Is this acceptable for a casual app, or should self-drop go through an RPC function that accepts the `player_id` parameter? The RPC approach is more controlled but adds a function.
   - Recommendation: Use the `drop_player` RPC function (already defined in migration) rather than direct table UPDATE. The RPC accepts a player_id, which the client knows from localStorage. This prevents one player from dropping another via the API, even though the threat model is low for a casual game night.

2. **Event code vs UUID in URLs**
   - What we know: Events use UUID primary keys. The CONTEXT.md mentions "join field + QR scan option" on the landing page.
   - What's unclear: Should the join field accept a full UUID, or should there be a shorter event code (e.g., 6-character alphanumeric)?
   - Recommendation: Use the UUID in the URL path (`/event/abc-123-def`) since QR codes and links handle the full URL. For the manual join field on the landing page, accept either a full URL or just the event ID (extract UUID from pasted URLs). A short code is nice-to-have but not required for Phase 1 -- it would require a separate `event_code` column and lookup function.

3. **Font loading strategy for display font (Cinzel)**
   - What we know: The user wants a "slightly stylized" display font for headers with personality.
   - What's unclear: Whether to use Google Fonts CDN, self-host via npm package, or use a system font stack with a decorative fallback.
   - Recommendation: Google Fonts CDN with `font-display: swap` for Cinzel (display headers) and Inter (body). Both are free, widely cached, and add minimal load. Fallback to serif/sans-serif while loading. This is Claude's discretion per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- subscription API, filter syntax, publication setup, DELETE event behavior with RLS
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) -- RLS interaction with Realtime events, anon role access
- [Supabase Silent Disconnections Troubleshooting](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) -- `worker: true`, `heartbeatCallback` config
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy patterns for anon role
- [Supabase Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security) -- REVOKE column access, explicit column lists
- [Supabase Securing Your API](https://supabase.com/docs/guides/api/securing-your-api) -- anon key, RLS enforcement, RPC patterns
- [Supabase Extensions (pgcrypto)](https://supabase.com/docs/guides/database/extensions) -- enabling pgcrypto, extensions schema
- [PostgreSQL pgcrypto Documentation](https://www.postgresql.org/docs/current/pgcrypto.html) -- `crypt()`, `gen_salt()` API
- [TanStack React Query v5 Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start) -- QueryClient, useQuery, useMutation, invalidateQueries
- [React Router v7 Data Mode Installation](https://reactrouter.com/start/data/installation) -- createBrowserRouter, RouterProvider import from `react-router/dom`
- [Tailwind CSS v4 Dark Mode](https://tailwindcss.com/docs/dark-mode) -- `@custom-variant dark`, forced dark class
- [Tailwind CSS v4 @theme Directive](https://tailwindcss.com/blog/tailwindcss-v4) -- custom design tokens in CSS
- [qrcode.react v4.2 npm](https://www.npmjs.com/package/qrcode.react) -- QRCodeSVG, props API, React 19 peer dep
- [Sonner npm](https://www.npmjs.com/package/sonner) -- Toaster + toast API, no hooks needed

### Secondary (MEDIUM confidence)
- [supabase/realtime-js#169](https://github.com/supabase/realtime-js/issues/169) -- React Strict Mode double subscription bug
- [Supabase pgcrypto Discussion #627](https://github.com/orgs/supabase/discussions/627) -- pgcrypto usage in Supabase, extensions schema issue
- [Supabase CLI pgcrypto Issue #568](https://github.com/supabase/cli/issues/568) -- pgcrypto in extensions schema, search_path fix
- [Supabase Realtime Heartbeat Docs](https://supabase.com/docs/guides/troubleshooting/realtime-heartbeat-messages) -- heartbeat monitoring
- [Supabase Security Strategy Discussion](https://www.answeroverflow.com/m/1428006794835525794) -- RLS + RPC pattern validation

### Tertiary (LOW confidence)
- [Supabase RLS Complete Guide 2026 (DesignRevision)](https://designrevision.com/blog/supabase-row-level-security) -- modern RLS patterns for non-auth apps

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via official npm/release pages, inter-compatibility confirmed
- Architecture patterns: HIGH -- Supabase Realtime + React Query invalidation verified via official docs; RPC passphrase pattern verified via pgcrypto docs
- Database schema + RLS: HIGH -- policies verified against Supabase docs; column-level security verified; Realtime publication requirement verified
- Pitfalls: HIGH -- critical pitfalls backed by official Supabase troubleshooting docs and documented GitHub issues
- UI/Theme: MEDIUM -- Tailwind v4 dark mode verified; font/color choices are Claude's discretion per CONTEXT.md

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable stack, 30-day validity)
