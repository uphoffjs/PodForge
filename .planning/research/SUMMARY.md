# Project Research Summary

**Project:** Commander Pod Pairer
**Domain:** Real-time casual event management SPA (MTG Commander pod pairing)
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

Commander Pod Pairer is a zero-friction, no-account web app for casual MTG Commander nights. Experts build apps like this as a React SPA backed by Supabase — no custom server, no user auth, no SSR complexity. The recommended approach is a React 19 + Vite 7 + Tailwind CSS v4 frontend backed by Supabase for Postgres, Realtime (WebSocket subscriptions), and server-side passphrase validation via RPC functions. This is a well-established pattern for small real-time SPAs. The entire backend is Supabase's managed platform; the client-side stack is modern but stable.

The competitive gap this app fills is real and documented: every existing tool requires either an account, an app install, or is focused on competitive play. The differentiators — zero-account joins, shared synced timer visible on every phone, browser notifications at timer expiry — are achievable with the recommended stack at low-to-medium complexity. The core algorithm (pod assignment with repeat-opponent avoidance) is the highest-complexity piece and should be built as a pure, exhaustively-tested function before being connected to any UI or database layer.

The primary risks are Supabase Realtime reliability on mobile (silent disconnections when apps are backgrounded) and RLS misconfiguration (exposed database in 83% of incidents involving no-auth Supabase apps). Both are preventable: Realtime reliability is addressed with a two-line client config change (`worker: true`, `heartbeatCallback`) and a Page Visibility API hook; RLS security is addressed by enabling RLS on every table at creation time and routing all admin writes through RPC functions. These mitigations must be applied during the infrastructure phase, not bolted on later.

## Key Findings

### Recommended Stack

The stack is modern, compatible, and stable. React 19, Vite 7, TypeScript 5.9, and Tailwind CSS v4 are all current stable releases with verified inter-compatibility. Supabase JS v2.95 is framework-agnostic and conflict-free. The testing stack — Vitest 4 + Testing Library 16 + jsdom — shares Vite's config and requires no separate setup. All package versions are pinned to production-ready releases; TypeScript 6.0 beta is explicitly excluded.

**Core technologies:**
- React 19 + Vite 7: SPA framework and build tool — no SSR needed, sub-second HMR, native TypeScript support
- Supabase JS v2.95: Backend-as-a-service — Postgres + Realtime + Row Level Security, no custom server needed
- React Router v7 (Library Mode): Client-side routing — `createBrowserRouter`, import from `react-router` (not `react-router-dom`)
- TanStack React Query v5: Server-state caching — React Query owns all data state; Realtime events trigger invalidation, not direct state mutation
- Tailwind CSS v4 + `@tailwindcss/vite`: Utility-first CSS — CSS-first config via `@theme` directive, no `tailwind.config.js` needed
- Vitest 4 + Testing Library: Unit and component tests — shares Vite config, Jest-compatible API
- bcryptjs v3: Client-side passphrase hashing — pure JS, browser-compatible; passphrase hash stored in Supabase and compared server-side via RPC
- qrcode.react v4.2: QR code generation — display-only; players scan with their phone's native camera, no in-app scanner needed

### Expected Features

The MVP is well-defined. Every feature in the v1 list has direct precedent in the competitive landscape, and the feature dependency graph is explicit: Realtime is foundational, player registration gates pod generation, pod generation gates the timer, and the admin passphrase gates all mutating actions.

**Must have (table stakes):**
- Event creation with shareable link + QR code — primary join mechanism; every competitor has this
- Player self-registration (name only) — zero-friction entry is the core value proposition
- Real-time player list — users expect to see who has joined
- Pod generation with repeat-opponent avoidance — the entire purpose of the app
- Random seat assignment (1st-4th) — eliminates first-player disputes
- Bye handling for odd player counts — inevitable at casual events
- Player self-drop and re-activation — players leave mid-event constantly
- Round history — players check who they played in previous rounds
- Admin passphrase protection — gates all destructive actions
- Shared round timer with visual countdown — the primary differentiator from all competitors
- Admin timer controls (start, pause, resume, +5min) — practical necessity at real events
- Browser notifications on timer expiry — critical for backgrounded phones; degrades gracefully on iOS Safari
- Mobile-first dark theme — 90%+ of users are on phones at an event

**Should have (competitive, add after validation):**
- Event history / read-only mode for ended events
- Multiple concurrent events support
- Improved pod algorithm (configurable pod sizes)
- Event info bar with expandable QR and round number

**Defer (v2+):**
- PWA install prompt (required for iOS notification support)
- Event templates for repeat organizers
- WCAG 2.2 accessibility audit
- Analytics dashboard for organizers
- Custom pod sizes (3-player, 5-player)

**Anti-features to avoid:** user accounts, standings/leaderboards, deck registration, chat/messaging, in-app QR scanning, sound alerts, spectator mode, Swiss-style competitive pairings, online/remote play support.

### Architecture Approach

The architecture is a React SPA with a clear separation between React Query (owns all server state), Supabase Realtime (triggers invalidation, does not own state), and Supabase RPC functions (handles all admin mutations with server-side passphrase validation). The timer is authoritative on the server side — stored as `started_at` timestamp + `duration_seconds` in Postgres — and each client independently calculates remaining time. This eliminates timer drift between clients entirely. Admin actions never hit Supabase tables directly; they go through SECURITY DEFINER RPC functions that validate the passphrase before performing mutations.

**Major components:**
1. React Router layer — three routes: `/` (landing), `/event/:id` (player view), `/event/:id/admin` (same view with admin controls visible)
2. Supabase client + React Query layer — single shared Supabase client; React Query for all reads; Realtime invalidation hook (`useEventChannel`) listening to `postgres_changes` filtered by `event_id`
3. Pod algorithm — pure TypeScript function taking players + opponent history, producing pod assignments; must be independently tested before UI integration
4. Admin action layer — RPC calls that pass passphrase to Postgres; session passphrase stored in `sessionStorage` per event for UX convenience
5. Timer engine — `useTimer` hook computing `remaining = duration - (Date.now() - started_at)`; driven by `requestAnimationFrame`; recalculates on `visibilitychange`
6. UI components — `PodCard` (hero element, large names, readable at arm's length), `TimerDisplay` (sticky, color-coded: white/yellow/red/flashing red), `AdminControls` (collapsed behind toggle)

**Database schema:** 5 tables — `events`, `players`, `rounds`, `pods`, `pod_players`. RLS on all tables. Player removal via soft delete (`status = 'removed'`), not hard delete, to avoid Realtime DELETE payload limitation.

### Critical Pitfalls

1. **Supabase Realtime silent disconnections on mobile** — Mobile browsers throttle heartbeats in background tabs. Configure `{ realtime: { worker: true, heartbeatCallback: ... } }` at client init. Use Page Visibility API to re-fetch state on tab restore. Must be in initial client setup, not added later.

2. **RLS misconfiguration exposes entire database** — Supabase disables RLS by default; 83% of no-auth app exploits involve RLS omission. Enable RLS on every table at creation time. Route all admin mutations through SECURITY DEFINER RPC functions. Never validate passphrase client-side and write directly to tables.

3. **Realtime subscription leaks** — React's Strict Mode double-invokes `useEffect`; channels accumulate without cleanup. Always return `() => supabase.removeChannel(channel)` from every `useEffect`. Use one channel per event with multiple `.on()` handlers, not one channel per table. Test cleanup by navigating 10+ times and checking channel count.

4. **Timer built with `setInterval` countdown** — `setInterval` drifts, is throttled in background tabs, and diverges across clients. Calculate timer remaining time from server-stored UTC timestamp on every render frame using `requestAnimationFrame`. Never store a "current remaining" value.

5. **Pod algorithm edge cases with small/odd player counts** — Greedy repeat-avoidance has no valid solution for 4-7 players in round 2+. Set a maximum iteration count; degrade to "least repeated" rather than "zero repeats." Test every player count 4-20 for 5+ rounds before building any UI. Handle player drops (7 active players = 1 pod of 4 + 3 byes is terrible UX — needs a design decision).

## Implications for Roadmap

Based on research, the build order follows hard data dependency chains. Each layer depends on the one before it. Six phases are suggested.

### Phase 1: Foundation and Infrastructure
**Rationale:** Everything depends on the database schema and client infrastructure. RLS misconfiguration (Pitfall 3) must be addressed before any feature code exists. Timer timezone handling (Pitfall 12) requires `timestamptz` in the initial schema — not patchable later. Passphrase security (Pitfall 8) must be the architecture from day one.
**Delivers:** Supabase project with all tables, RLS policies, and RPC function skeletons; Vite + React + TypeScript + Tailwind project scaffold; React Router routes; Supabase client with `worker: true` Realtime config; React Query provider
**Addresses:** Event creation with admin passphrase (hashed)
**Avoids:** Pitfall 3 (RLS), Pitfall 8 (passphrase security), Pitfall 12 (timezone), Pitfall 11 (soft deletes)

### Phase 2: Core Player Flow and Realtime
**Rationale:** Player registration is the prerequisite for pod generation. Realtime subscriptions should be wired up early so all subsequent features inherit live updates automatically. Establishing the correct subscription pattern (cleanup, one channel per event, worker mode) in the first Realtime component forces every subsequent component to follow it.
**Delivers:** Player join flow (name-only), real-time player list, duplicate name prevention, player self-drop, Realtime subscription via `useEventChannel` with proper cleanup
**Uses:** Supabase Realtime postgres_changes, React Query invalidation pattern, sessionStorage passphrase pattern
**Avoids:** Pitfall 1 (silent disconnections — heartbeat config), Pitfall 4 (subscription leaks — cleanup pattern), Pitfall 11 (DELETE payloads — soft deletes)

### Phase 3: Pod Generation Algorithm and Admin Flow
**Rationale:** The pod algorithm is the highest-risk, highest-complexity piece. It must be a pure TypeScript function with exhaustive unit tests before any UI or database integration. Passphrase-gated admin actions must be working before any admin feature is exposed. Race conditions in pod generation (Pitfall 6) require advisory locks in the Postgres RPC function, not client-side guards.
**Delivers:** Pod algorithm (TypeScript pure function, tested for player counts 4-20, 5+ rounds each), admin passphrase modal, generate-round RPC with advisory lock, pod display UI (PodCard), seat assignments, bye handling, round history
**Avoids:** Pitfall 6 (race conditions — Postgres advisory lock), Pitfall 7 (small player count edge cases — tested before UI build), Pitfall 8 (passphrase validation server-side)

### Phase 4: Shared Timer
**Rationale:** Timer depends on rounds existing (Phase 3). Timer must be built with the server-authoritative pattern from the start — a countdown-based setInterval timer would require a full rewrite.
**Delivers:** Timer state in rounds table (timestamptz started_at, duration_seconds, paused_remaining), `useTimer` hook with requestAnimationFrame calculation, TimerDisplay component with color transitions, admin timer controls (start, pause, resume, +5min, cancel)
**Avoids:** Pitfall 2 (setInterval timer — use requestAnimationFrame + server timestamps), Pitfall 12 (timezone — timestamptz, server-set started_at)

### Phase 5: Notifications and Event Info
**Rationale:** Browser notifications are an enhancement on top of the timer (Phase 4). iOS limitations (Pitfall 5) require visual fallbacks to be the primary notification mechanism. QR code display and event sharing are low-complexity polish that can be done in any order but belongs after core flow is validated.
**Delivers:** Notification API permission flow, timer-expiry visual fallback (full-screen color change), vibration API fallback, event info bar with QR code (display-only, no scanner), share link copy, Web Share API
**Avoids:** Pitfall 5 (iOS PWA requirement — visual fallback is primary), Pitfall 9 (no in-app QR scanner)

### Phase 6: Admin Management, Edge Cases, and Deployment
**Rationale:** Admin player management (remove, reactivate) and event ending are admin-layer operations that build on the passphrase system from Phase 3. Mid-event joins are a low-complexity edge case. Deployment is last because environment variables and CI config depend on the final Supabase project setup.
**Delivers:** Remove player, reactivate dropped player, end event (read-only mode), mid-event player join, unit and integration test coverage of all critical paths, Vercel deployment config, Supabase migration scripts
**Avoids:** Pitfall 10 (free tier limits — single channel per event, Supabase Pro for production)

### Phase Ordering Rationale

- **Schema before features** — RLS is impossible to retrofit safely; schema decisions (timestamptz, soft deletes, passphrase hash) affect every phase
- **Realtime before pod generation** — pods need live updates; establishing the correct subscription pattern early prevents inconsistent patterns across components
- **Algorithm before UI** — the pod algorithm has mathematical edge cases that produce incorrect behavior; these must be caught in unit tests, not discovered during UI development
- **Timer after rounds** — timer state lives on the rounds table; rounds must exist before timer can be built
- **Notifications after timer** — notification logic depends on timer expiry events
- **Polish last** — event info bar, QR display, and admin player management are low-dependency, low-risk additions

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Pod Algorithm):** The greedy repeat-avoidance algorithm for small player counts (4-7) has documented edge cases with no clean solution. Research specific algorithm strategies (e.g., weighted round-robin, exhaustive backtracking with iteration cap) before implementation.
- **Phase 4 (Timer):** Supabase RPC functions setting `started_at = NOW()` server-side is the correct pattern, but the exact RPC function signature for pause/resume/extend needs design validation against the React Query invalidation model.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Supabase project setup, Vite scaffolding, and Tailwind v4 config are thoroughly documented. No novel patterns.
- **Phase 2:** Player join flow with Realtime subscription is a documented Supabase pattern. Well-covered by official docs.
- **Phase 5:** Notification API permission flow is well-documented. iOS limitation is a known constraint with a known workaround.
- **Phase 6:** Vercel deployment for Vite React SPAs is standard. Supabase migration scripts are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via official npm/release pages. Versions pinned to current stable. No speculative choices. |
| Features | MEDIUM-HIGH | Competitive landscape research relied on official product pages (MEDIUM) but WotC WPN guidance is HIGH. Feature dependencies are internally consistent. |
| Architecture | MEDIUM-HIGH | Supabase Realtime and RPC patterns verified via official docs (HIGH). Timer sync and React Query invalidation patterns from multiple credible community sources (MEDIUM). RPC passphrase validation pattern is sound but lacks a canonical example for this exact use case. |
| Pitfalls | HIGH | Critical pitfalls backed by official Supabase docs, Chrome documentation, and documented real-world incidents (2025 Lovable RLS breach). Moderate pitfalls backed by GitHub issues and community analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **6-7 player pod assignment UX**: The spec defines pods of 4 as standard, but 6 active players = 1 pod of 4 + 2 byes (poor experience) and 7 active players = 1 pod of 4 + 3 byes (terrible). The spec does not address this design gap. Needs a product decision before Phase 3: either allow 3-player pods as a fallback, or display a warning to the admin, or define a minimum player count above which the experience is acceptable.
- **pgcrypto availability in Supabase free tier**: The RPC passphrase validation pattern uses `pgcrypto`'s `crypt()` and `gen_salt('bf')` functions. Supabase enables pgcrypto by default on new projects, but this should be verified during Phase 1 database setup. If unavailable, the fallback is passing the passphrase to a Supabase Edge Function for bcrypt comparison.
- **Pod generation algorithm choice**: Research identifies the approach (greedy, minimize repeats) and edge cases but does not prescribe the exact algorithm implementation. This gap should be resolved during Phase 3 planning with a short research spike.

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription patterns, filter syntax, DELETE payload behavior
- [Supabase Handling Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — `worker: true`, heartbeatCallback config
- [Supabase Securing Your API](https://supabase.com/docs/guides/api/securing-your-api) — RLS without auth, anon key security
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy patterns
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — free tier connection and message limits
- [Chrome Timer Throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) — setInterval background throttling
- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) — Node.js requirements, version compatibility
- [Tailwind CSS v4.0 blog](https://tailwindcss.com/blog/tailwindcss-v4) — v4 architecture, CSS-first config
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — Vite 7 compatibility
- [React Router v7 modes](https://reactrouter.com/start/modes) — Library Mode vs Framework Mode
- [WPN: How to Run Successful Commander Events](https://wpn.wizards.com/en/news/how-to-run-successful-commander-events-and-grow-your-community) — casual event UX expectations

### Secondary (MEDIUM confidence)
- [TanStack Query + Supabase Pattern (MakerKit)](https://makerkit.dev/blog/saas/supabase-react-query) — invalidation-based integration pattern
- [Supabase Security Flaw: 170+ Apps Exposed](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — RLS misconfiguration real-world consequences
- [PWA on iOS (2025)](https://brainhub.eu/library/pwa-on-ios) — iOS notification limitations
- [Why Do Browsers Throttle JavaScript Timers?](https://nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers/) — setInterval throttling analysis
- [TopDeck.gg feature pages](https://topdeck.gg/features/tournament-operations) — competitive feature landscape
- [supabase/realtime-js#169](https://github.com/supabase/realtime-js/issues/169) — React Strict Mode double subscription

### Tertiary (LOW confidence)
- [EDH Tournament App Google Play listing](https://play.google.com/store/apps/details?id=com.lucaswmolin.edhtournament) — competitor feature reference
- [MTG pod pairing algorithm discussions](https://apps.magicjudges.org/forum/topic/26928/) — algorithm edge cases

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
