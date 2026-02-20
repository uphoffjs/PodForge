# Architecture Patterns

**Domain:** Real-time event management web app (MTG Commander pod pairing)
**Researched:** 2026-02-20
**Overall Confidence:** MEDIUM-HIGH (Supabase Realtime patterns verified via official docs; timer sync and passphrase patterns derived from multiple credible sources)

## Recommended Architecture

```
+-------------------------------------------------------------+
|                     Client (React SPA)                       |
|                                                              |
|  +------------------+  +------------------+  +----------+   |
|  | Route Layer      |  | State Layer      |  | UI Layer |   |
|  | (React Router)   |  | (React Query +   |  | (Tailwind|   |
|  |                  |  |  Supabase RT)    |  |  + React)|   |
|  | /               |  |                  |  |          |   |
|  | /event/:id      |  | useQuery (reads) |  | EventView|   |
|  | /event/:id/admin|  | useMutation (wrt)|  | PodCard  |   |
|  +------------------+  | RT subscription  |  | Timer    |   |
|                        | -> invalidation  |  | PlayerLst|   |
|                        +------------------+  +----------+   |
|                              |                               |
+------------------------------|-------------------------------+
                               | WebSocket + REST
                               v
+-------------------------------------------------------------+
|                   Supabase Backend                           |
|                                                              |
|  +------------------+  +------------------+  +----------+   |
|  | Realtime         |  | PostgREST API    |  | Postgres |   |
|  | (WebSocket)      |  | (Auto-generated) |  | Database |   |
|  |                  |  |                  |  |          |   |
|  | postgres_changes |  | CRUD via anon key|  | events   |   |
|  | per event_id     |  | RPC functions    |  | players  |   |
|  | filter           |  | (admin actions)  |  | rounds   |   |
|  +------------------+  +------------------+  | pods     |   |
|                                              | pod_plyr |   |
|                                              +----------+   |
|                                              | RLS Policies |
|                                              | (anon read,  |
|                                              |  RPC write)  |
|                                              +----------+   |
+-------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **React Router (SPA)** | URL routing, code splitting by route | All UI components |
| **Supabase Client** | Single shared client instance; REST queries + Realtime channels | Supabase backend |
| **React Query Layer** | Caching, deduplication, background refetch of all DB reads | Supabase REST API |
| **Realtime Subscription Manager** | One channel per event; listens to postgres_changes; triggers React Query invalidation | Supabase Realtime, React Query |
| **Timer Engine** | Client-side countdown from server-stored state (started_at + duration); drift-resistant recalculation | Supabase (reads timer state), UI (renders countdown) |
| **Admin Action Layer** | Passphrase validation via RPC; mutation calls for admin-only operations | Supabase RPC functions |
| **Pod Algorithm** | Pure function: takes players + history, outputs pod assignments | Called by admin action layer |
| **UI Components** | Render event state; mobile-first dark theme; glanceable pod cards | React Query data, Timer engine |

### Data Flow

**Read path (player view):**
```
1. Player opens /event/:id
2. React Query fetches event + players + current round + pods (REST)
3. Supabase Realtime channel subscribes: postgres_changes on players/rounds/pods WHERE event_id = :id
4. On realtime event -> queryClient.invalidateQueries(['event', eventId])
5. React Query refetches stale data -> UI re-renders
```

**Write path (admin action, e.g., "Generate Next Round"):**
```
1. Admin enters passphrase -> stored in sessionStorage
2. Admin clicks "Generate Round"
3. Client calls supabase.rpc('generate_round', { event_id, passphrase })
4. Postgres function validates passphrase against events.passphrase_hash
5. Function runs pod algorithm in SQL or returns player data for client-side computation
6. New round/pods/pod_players rows inserted
7. postgres_changes fires -> all subscribed clients invalidate + refetch
```

**Timer flow:**
```
1. Admin starts timer -> supabase.rpc('start_timer', { event_id, duration_seconds, passphrase })
2. Server stores: { started_at: now(), duration_seconds: 5400, paused_remaining: null }
3. Clients read timer state via React Query
4. Client computes: remaining = duration - (Date.now() - started_at) / 1000
5. requestAnimationFrame loop updates display every second
6. On pause: server stores paused_remaining, clears started_at
7. On resume: server sets started_at = now(), duration_seconds = paused_remaining
8. Timer state change triggers postgres_changes -> all clients recalculate
```

## Patterns to Follow

### Pattern 1: Channel-Per-Event with postgres_changes Filter
**What:** Create one Supabase Realtime channel per event, filtering postgres_changes by event_id. This scopes all real-time updates to the relevant event.
**When:** Always -- every client viewing an event subscribes to exactly one channel.
**Why:** Avoids receiving updates for unrelated events. The filter on event_id means Supabase only delivers relevant WAL changes. For this app's scale (8-16 players per event, a few concurrent events), postgres_changes is the correct choice over Broadcast -- the data is already in Postgres and RLS authorization is automatic.
**Confidence:** HIGH (verified via Supabase official docs)

```typescript
// src/hooks/useEventChannel.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useEventChannel(eventId: string) {
  const queryClient = useQueryClient();

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
        () => queryClient.invalidateQueries({ queryKey: ['players', eventId] })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rounds', eventId] });
          queryClient.invalidateQueries({ queryKey: ['timer', eventId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pods',
          filter: `round_id=eq.*`, // will need round-scoped or event-scoped approach
        },
        () => queryClient.invalidateQueries({ queryKey: ['pods', eventId] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
}
```

### Pattern 2: React Query as Primary State + Realtime as Invalidation Trigger
**What:** Use TanStack React Query (v5) for all data fetching, caching, and UI state. Supabase Realtime subscriptions do NOT directly update state -- they invalidate queries, causing React Query to refetch.
**When:** For all database-backed state (players, rounds, pods, timer state).
**Why:** Supabase Realtime delivers change events (deltas), not full snapshots. Trying to merge deltas into local state is error-prone and creates consistency bugs. React Query's invalidation model is simple: real-time event arrives -> mark query stale -> refetch full state -> UI re-renders with consistent data. This is the pattern recommended by multiple sources including MakerKit and Supabase community discussions.
**Confidence:** HIGH (multiple credible sources agree; official Supabase docs recommend this)

```typescript
// src/hooks/useEventPlayers.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useEventPlayers(eventId: string) {
  return useQuery({
    queryKey: ['players', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('event_id', eventId)
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 30_000, // 30s -- realtime invalidation handles freshness
  });
}
```

### Pattern 3: Server-Authoritative Timer with Client-Side Calculation
**What:** Store timer state in the database as absolute values (started_at timestamp, duration_seconds integer, paused_remaining_seconds nullable integer). Clients calculate remaining time locally using `remaining = duration - (now - started_at)`. No countdown value is stored or transmitted -- each client computes it.
**When:** For the round timer feature.
**Why:** Eliminates drift between clients. Every client independently calculates from the same server-stored reference point. Even if a client's clock is slightly off, all clients converge because they recalculate on every render frame. Pausing is modeled as clearing started_at and storing remaining seconds; resuming sets a new started_at with the stored remaining as the new duration.
**Confidence:** HIGH (well-established pattern verified by multiple web development sources)

```typescript
// src/hooks/useTimer.ts
import { useState, useEffect, useCallback } from 'react';

interface TimerState {
  started_at: string | null;  // ISO timestamp
  duration_seconds: number;
  paused_remaining: number | null;
}

export function useTimer(timerState: TimerState | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  const calculate = useCallback(() => {
    if (!timerState) return null;
    if (timerState.paused_remaining !== null) return timerState.paused_remaining;
    if (!timerState.started_at) return null;

    const elapsed = (Date.now() - new Date(timerState.started_at).getTime()) / 1000;
    return Math.max(0, timerState.duration_seconds - elapsed);
  }, [timerState]);

  useEffect(() => {
    setRemaining(calculate());

    // Use requestAnimationFrame for smooth updates, throttled to ~1fps
    let frameId: number;
    let lastUpdate = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdate >= 1000) {
        setRemaining(calculate());
        lastUpdate = timestamp;
      }
      frameId = requestAnimationFrame(tick);
    };

    if (timerState?.started_at && timerState.paused_remaining === null) {
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [timerState, calculate]);

  return remaining;
}
```

### Pattern 4: Passphrase Validation via Supabase RPC (Not Client-Side Comparison)
**What:** Admin actions call Supabase RPC functions that accept the passphrase as a parameter. The Postgres function compares the passphrase server-side against a hashed value stored in the events table. The client never reads the passphrase hash.
**When:** For all admin-gated operations (generate round, remove player, start/pause timer, end event).
**Why:** Sending the passphrase to an RPC function means the validation happens in Postgres. RLS policies on the events table can allow public SELECT on non-sensitive columns while hiding the passphrase_hash column entirely. The RPC function runs with SECURITY DEFINER to access the hash column that RLS hides from direct queries. This is more secure than client-side comparison and simpler than setting up Supabase Auth.
**Confidence:** MEDIUM (pattern is sound and Supabase RPC docs confirm feasibility; no canonical example found for this exact use case)

```sql
-- Database function for admin-gated actions
CREATE OR REPLACE FUNCTION generate_round(
  p_event_id UUID,
  p_passphrase TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Compare passphrase (use pgcrypto crypt() for hashed comparison)
  IF v_event.passphrase_hash != crypt(p_passphrase, v_event.passphrase_hash) THEN
    RAISE EXCEPTION 'Invalid passphrase';
  END IF;

  -- ... perform admin action ...
  RETURN jsonb_build_object('success', true);
END;
$$;
```

```typescript
// Client-side admin action
async function generateRound(eventId: string, passphrase: string) {
  const { data, error } = await supabase.rpc('generate_round', {
    p_event_id: eventId,
    p_passphrase: passphrase,
  });
  if (error) throw error;
  return data;
}
```

### Pattern 5: Session-Stored Admin Passphrase
**What:** After the first successful passphrase validation, store the passphrase in sessionStorage so the user does not need to re-enter it for subsequent admin actions. Re-validate on each RPC call (server-side) but avoid prompting the user repeatedly.
**When:** After first admin action per browser session.
**Why:** UX requirement from the spec. sessionStorage clears on tab close, which is appropriate security for a casual event. The passphrase is re-sent with every RPC call and re-validated server-side, so a stale session cannot perform actions after the event passphrase changes.
**Confidence:** HIGH (standard web pattern)

```typescript
// src/hooks/useAdminAuth.ts
import { useState, useCallback } from 'react';

export function useAdminAuth(eventId: string) {
  const storageKey = `admin_passphrase_${eventId}`;

  const getPassphrase = useCallback(() => {
    return sessionStorage.getItem(storageKey);
  }, [storageKey]);

  const setPassphrase = useCallback((passphrase: string) => {
    sessionStorage.setItem(storageKey, passphrase);
  }, [storageKey]);

  const clearPassphrase = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  const requirePassphrase = useCallback(async (): Promise<string> => {
    const stored = getPassphrase();
    if (stored) return stored;
    // Trigger modal/dialog for passphrase entry
    // On success, store and return
    throw new Error('Passphrase required');
  }, [getPassphrase]);

  return { getPassphrase, setPassphrase, clearPassphrase, requirePassphrase };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Merging Realtime Deltas into Local State
**What:** Listening to postgres_changes and directly updating a React state array (e.g., splicing a new player into a players list, removing a deleted one).
**Why bad:** Creates inconsistency. You miss events during reconnection. INSERT gives you the new row but your local list may be stale. DELETE events with RLS enabled only give primary keys, not full records. You end up writing a mini database reconciliation engine in React.
**Instead:** Let React Query own all data state. Realtime events trigger `queryClient.invalidateQueries()` which refetches the full, consistent dataset from Supabase.

### Anti-Pattern 2: Client-Side Timer Synchronization via WebSocket Messages
**What:** Broadcasting a "tick" or "remaining seconds" value from admin client to all other clients via Supabase Broadcast.
**Why bad:** Network latency creates visible drift between clients. If the admin's browser tabs out, requestAnimationFrame pauses and ticks stop. Every client shows a different time.
**Instead:** Store the timer's reference state (started_at, duration) in the database. Each client independently calculates remaining time from these values. All clients converge on the same value because they use the same formula against the same stored data.

### Anti-Pattern 3: Storing Passphrase in Plain Text
**What:** Storing the admin passphrase as-is in the events table.
**Why bad:** Anyone with database access (or a SQL injection vector) gets all passphrases. Even though this is a casual app, it sets a bad pattern.
**Instead:** Use pgcrypto's `crypt()` and `gen_salt('bf')` to store a bcrypt hash. The RPC function compares using `crypt(input, stored_hash) = stored_hash`.

### Anti-Pattern 4: One Global Realtime Channel for All Events
**What:** Subscribing to all changes on the players/rounds/pods tables without filtering by event_id.
**Why bad:** Every client receives changes for every event. With multiple concurrent events, this wastes bandwidth and triggers unnecessary React Query invalidations.
**Instead:** Use per-event channels with `filter: event_id=eq.${eventId}` on every postgres_changes subscription.

### Anti-Pattern 5: Using Zustand or Redux for Server State
**What:** Creating a Zustand/Redux store to hold players, rounds, pods, and syncing it manually with Supabase.
**Why bad:** Duplicates what React Query does better. You end up maintaining cache invalidation, loading states, error states, and stale-while-revalidate logic by hand.
**Instead:** React Query for server state. Only use React state (useState/useContext) for purely client-side concerns: modal open/close, passphrase input, UI preferences.

## Component Architecture (Mobile-First)

### Route Structure
```
/                       -> LandingPage (create event, join by code)
/event/:eventId         -> EventView (main player view)
/event/:eventId/admin   -> EventView with admin controls visible
```

Note: The admin route is not a separate page -- it is the same EventView with admin controls conditionally rendered based on validated passphrase in sessionStorage. The `/admin` suffix is optional and simply triggers the passphrase prompt on load.

### Component Hierarchy
```
App
  LandingPage
    CreateEventForm
    JoinEventForm
  EventView
    EventInfoBar (name, QR, share link, player count, round #)
      QRCodeExpander
      ShareLinkCopier
    TimerDisplay (countdown, color-coded urgency)
    AdminControls (if passphrase validated)
      GenerateRoundButton
      TimerControls (start, pause, resume, +5min, cancel)
      EndEventButton
    PassphraseModal (shown on demand)
    CurrentRound
      PodCard[] (pod assignment with seat numbers)
        PlayerSeat (name + seat number, highlighted if "you")
      ByePod (players sitting out)
    PreviousRounds (collapsible, most recent first)
      RoundSection[]
        PodCard[]
    PlayerList
      ActivePlayers[]
      DroppedPlayers (collapsible)
    PlayerActions
      SelfDropButton
    AdminPlayerActions (if admin)
      RemovePlayerButton
      ReactivatePlayerButton
```

### Component Sizing and Layout Notes
- **PodCard**: The most important UI element. Must be readable at arm's length on a phone. Large player names, clear seat numbers (1st-4th), high-contrast dark theme.
- **TimerDisplay**: Sticky at top of viewport. Large digits (mm:ss). Color transitions: white (normal) -> yellow (10 min) -> red (5 min) -> flashing red (0:00).
- **AdminControls**: Collapsed behind a toggle or at bottom of screen. Not the primary view.
- **PlayerList**: Secondary info. Below pods. Active players shown by default, dropped players in collapsible section.

## Database Schema Design

```sql
-- Core tables with RLS
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  passphrase_hash TEXT NOT NULL,  -- bcrypt via pgcrypto
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, name)  -- duplicate name prevention
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  timer_duration_seconds INTEGER,       -- null = no timer
  timer_started_at TIMESTAMPTZ,         -- null = not started or paused
  timer_paused_remaining INTEGER,       -- null = running or no timer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, round_number)
);

CREATE TABLE pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  pod_number INTEGER NOT NULL,
  is_bye BOOLEAN DEFAULT false
);

CREATE TABLE pod_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES pods(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  seat_number INTEGER  -- null for bye pod
);
```

### RLS Policies

```sql
-- Events: anyone can read non-sensitive columns, nobody can direct-write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read events" ON events
  FOR SELECT USING (true);
-- Note: passphrase_hash excluded via column-level security or view

-- Players: anyone can read, insert (join), and update own status (drop)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read players" ON players
  FOR SELECT USING (true);

CREATE POLICY "Public insert players" ON players
  FOR INSERT WITH CHECK (status = 'active');

-- Self-drop: players can update their own status to 'dropped'
-- Implementation: use RPC function with player_id parameter

-- Rounds, Pods, Pod_Players: public read, admin-only write via RPC
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Public read pods" ON pods FOR SELECT USING (true);
CREATE POLICY "Public read pod_players" ON pod_players FOR SELECT USING (true);

-- All writes go through SECURITY DEFINER RPC functions that validate passphrase
```

### Column-Level Security for Passphrase Hash

```sql
-- Option 1: Use a view that excludes passphrase_hash
CREATE VIEW public_events AS
  SELECT id, name, status, created_at FROM events;

-- Option 2: Revoke column access from anon role
REVOKE SELECT (passphrase_hash) ON events FROM anon;
```

## Suggested Build Order

The build order follows data dependency chains. Each layer depends on the one before it.

### Layer 1: Foundation (must be first)
1. **Supabase project setup** - database, tables, RLS policies, RPC functions
2. **Vite + React + Tailwind project scaffold** - routing, Supabase client, React Query provider
3. **Event creation** - CreateEventForm -> calls RPC to insert event with hashed passphrase

**Rationale:** Everything depends on the database schema and the client infrastructure. Event creation is the entry point for all other features.

### Layer 2: Core Player Flow (depends on Layer 1)
4. **Player join** - JoinEventForm or direct link -> inserts player row
5. **Player list** - useEventPlayers hook, PlayerList component
6. **Realtime subscription** - useEventChannel hook, query invalidation on player changes
7. **Self-drop** - player status update

**Rationale:** Player management is the foundation for pod generation. Realtime subscriptions should be wired up early so all subsequent features get live updates automatically.

### Layer 3: Pod Generation (depends on Layer 2)
8. **Pod algorithm** - pure TypeScript function, extensively unit-tested
9. **Admin passphrase flow** - PassphraseModal, useAdminAuth, RPC validation
10. **Generate round** - admin action -> pod algorithm -> write to DB -> realtime updates all clients
11. **PodCard UI** - display pods, seats, bye assignments

**Rationale:** The pod algorithm is the core differentiating logic. It should be a pure function with comprehensive unit tests before being wired into the admin flow. The passphrase system gates all admin actions and must work before any admin features ship.

### Layer 4: Timer (depends on Layer 3)
12. **Timer state in rounds table** - started_at, duration, paused_remaining
13. **Timer display** - useTimer hook, TimerDisplay component with color transitions
14. **Timer controls** - admin start, pause, resume, +5min, cancel
15. **Browser notifications** - Notification API permission flow, fire at timer=0

**Rationale:** Timer is a core feature but depends on rounds existing. Browser notification permission should be requested early (on first event view load) but notification firing depends on the timer being functional.

### Layer 5: Polish and Edge Cases (depends on Layers 1-4)
16. **Event info bar** - QR code, share link, player count, round number
17. **Previous rounds** - collapsible history
18. **Admin player management** - remove player, reactivate dropped player
19. **End event** - read-only state
20. **Mid-event join** - player joining with empty history

### Layer 6: Testing and Deployment
21. **Unit tests** - pod algorithm (critical), timer calculation, passphrase hashing
22. **Integration tests** - full flows (create event -> join -> generate round -> see pods)
23. **Deployment setup** - Vercel config, Supabase migration scripts, environment variables

## Scalability Considerations

| Concern | 1 Event / 8 Players (Target) | 10 Events / 100 Players | 100 Events / 1000 Players |
|---------|------|------|------|
| Realtime connections | Trivial (8 WebSockets) | Fine (100 connections, well within free tier) | Needs Supabase Pro; consider connection pooling |
| postgres_changes load | Negligible | Fine -- per-event filters limit broadcasts | May need Broadcast pattern instead of postgres_changes for high-change tables |
| Timer precision | Perfect -- 8 clients calculating locally | Fine | Fine -- timer is pure client-side math |
| Pod algorithm | Instant for 8 players | <100ms for 20 players per event | N/A -- events are independent |
| Database size | Tiny | Small | Needs event cleanup/archival strategy |

For this project's target scale (8-16 players, a few concurrent events), every architectural choice is well within comfortable limits. The postgres_changes + React Query invalidation pattern handles this scale trivially.

## Sources

- [Supabase Realtime Overview](https://supabase.com/docs/guides/realtime) - Official docs, three subscription types (HIGH confidence)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) - Filter syntax, RLS interaction, performance notes (HIGH confidence)
- [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast) - When to use over postgres_changes (HIGH confidence)
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts) - Channels, topics, connection pools (HIGH confidence)
- [Supabase Securing API](https://supabase.com/docs/guides/api/securing-your-api) - check_request function, anon key, RLS without auth (HIGH confidence)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) - Confirmed NOT needed for this use case (HIGH confidence)
- [Supabase RPC Docs](https://supabase.com/docs/reference/javascript/rpc) - Function call syntax (HIGH confidence)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy patterns (HIGH confidence)
- [Timer Modelling for Browsers](https://boopathi.blog/modelling-timers-for-the-browser) - Target datetime pattern, NTP sync (MEDIUM confidence)
- [Syncing Countdown Timers Across Clients](https://medium.com/@flowersayo/syncing-countdown-timers-across-multiple-clients-a-subtle-but-critical-challenge-384ba5fbef9a) - Diff-based polling approach (MEDIUM confidence)
- [TanStack Query + Supabase Pattern](https://makerkit.dev/blog/saas/supabase-react-query) - Invalidation-based integration (MEDIUM confidence)
- [React Architecture 2025](https://launchdarkly.com/docs/blog/react-architecture-2025) - Component organization patterns (MEDIUM confidence)
- [React Folder Structure 2025](https://www.robinwieruch.de/react-folder-structure/) - Project organization (MEDIUM confidence)
- [Supabase RLS Complete Guide 2026](https://designrevision.com/blog/supabase-row-level-security) - Modern RLS patterns (MEDIUM confidence)
- [Building Scalable Real-Time Systems with Supabase](https://medium.com/@ansh91627/building-scalable-real-time-systems-a-deep-dive-into-supabase-realtime-architecture-and-eccb01852f2b) - Optimistic UI, architecture decisions (LOW confidence, single source)
