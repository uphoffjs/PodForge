# Commander Pod Pairer

## What This Is

A web app for casual Magic: The Gathering Commander playgroups to manage pod pairings during events. Players join via QR code or shareable link, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions (creating events, generating rounds, removing players) are protected behind a per-event passphrase. No user accounts or logins — just show up and play.

## Current Milestone: v2.0 Complete App

**Goal:** Deliver the full Commander Pod Pairer experience — pod generation with opponent avoidance, round timer with real-time sync, admin controls, event polish, and deployment.

**Target features:**
- Pod generation algorithm with greedy opponent avoidance and bye rotation
- Admin controls: remove/reactivate players, end events
- Server-authoritative round timer with pause/resume and browser notifications
- Event info bar with QR code, share link, player count, round number
- Vercel + Supabase deployment

## Core Value

When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone — who they're playing with, what seat they're in, and how much time they have. Fast, glanceable, no confusion.

## Requirements

### Validated

- ✓ Landing page with event creation and join-by-code/link — v1.0
- ✓ Event creation sets name + admin passphrase — v1.0
- ✓ Multiple concurrent events supported, each with its own URL — v1.0
- ✓ Players join by visiting event link or scanning QR code, entering their name — v1.0
- ✓ Players can self-drop (marks inactive, doesn't delete; current round assignment stays visible) — v1.0
- ✓ Real-time player list visible to all (active players + collapsed dropped section) — v1.0
- ✓ Duplicate name prevention with friendly error — v1.0
- ✓ Admin passphrase popup gates admin actions; session-stored after first entry — v1.0
- ✓ Real-time updates via Supabase Realtime: player joins/drops push to all clients — v1.0
- ✓ Mobile-first dark theme, glanceable pod cards, minimal chrome, no slow animations — v1.0
- ✓ Unit + integration test infrastructure (226 unit tests, 44 E2E tests, 15 visual baselines) — v1.0

### Active

- ✓ Pod generation algorithm: minimize repeat opponents via greedy assignment with opponent history matrix — v2.0 Phase 2
- ✓ Bye rotation: players with fewest byes prioritized, ties broken randomly — v2.0 Phase 2
- ✓ Fewer than 4 players blocks round generation with error — v2.0 Phase 2
- ✓ Random seat order (1st-4th) assigned per pod, displayed clearly — v2.0 Phase 2
- ✓ Bye pod members get no seat assignment, visually distinct — v2.0 Phase 2
- ✓ Previous rounds visible in collapsible sections, most recent first — v2.0 Phase 2
- ✓ Admin can remove player, re-activate dropped player, end event — v2.0 Phase 2
- ✓ Ended event becomes read-only (historical data stays visible) — v2.0 Phase 2
- [ ] Round timer with admin-set duration (optional, with presets: 60/90/120 min)
- [ ] Timer visible to all clients, counts down in real time (mm:ss), color changes at thresholds
- [ ] Admin timer controls: pause, resume, +5 min, cancel
- [ ] Browser notifications when timer hits zero
- [ ] Timer state stored server-side (server-authoritative)
- [ ] Event info bar: name, QR code (expandable), shareable link with copy, player count, round number
- [ ] Multiple simultaneous admins supported per event
- [ ] Player joining mid-event enters pool for next round with empty history and 0 bye count
- [ ] Full test coverage: unit tests for pod generation algorithm
- [ ] Deployment setup instructions for Vercel + Supabase

### Out of Scope

- User accounts / authentication — unnecessary for casual playgroup use
- Point tracking or standings — not needed for casual play
- Deck registration — out of scope for pairing utility
- Spectator chat or messaging — this is a utility, not a social app
- Player profile persistence across events — each event is standalone
- Sound alerts on timer expiry — visual + browser notification sufficient
- Swiss pairings / tournament brackets — competitive feature, this is for casual Commander
- In-app QR scanner — OS camera app handles QR natively

## Context

Shipped v1.0 with 5,386 LOC TypeScript/CSS. Phase 2 complete (pod generation + admin controls).
Tech stack: React 19 (Vite), Supabase (Postgres + Realtime), Tailwind CSS v4, TypeScript.
Test coverage: 303 unit tests (Vitest), 44 Cypress E2E tests, 15 visual regression baselines, 90.6% Stryker mutation score on pod algorithm.
Supabase migrations: 00001 (schema), 00002 (rounds/pods/admin RPCs), 00003 (REPLICA IDENTITY FULL for Realtime).
DB password stored in .env as SUPABASE_DB_PASSWORD (gitignored) for CLI push operations.

6-7 player pod assignment UX resolved: warn admin about high bye count, proceed anyway. No 3-player pods or minimum player restriction.

## Constraints

- **Tech stack**: React (Vite), Supabase (Postgres + Realtime), Tailwind CSS, TypeScript — per spec
- **Deployment**: Vercel (frontend) + Supabase (backend) — setup instructions required
- **QR Code**: Client-side generation (e.g. `qrcode.react`)
- **No accounts**: Access model is public + per-event passphrase, no user registration
- **Mobile-first**: Most users on phones — design for small screens first
- **Performance**: No slow animations, pod assignments must be glanceable at arm's length

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Per-event passphrase (no site-wide gate) | Anyone should be able to create an event for their group | ✓ Good — simple, works well |
| Greedy pod assignment (not globally optimal) | Good enough for <20 players, simpler to implement and debug | ✓ Good — 90.6% mutation score |
| Browser notifications for timer | Players need alerts when app is backgrounded on phones | — Pending (Phase 3) |
| Full test coverage from v1 | Pod algorithm is complex enough to warrant tests; integration tests catch real-time issues | ✓ Good — caught 13 bugs via milestone audit |
| Visual-only timer alerts + browser notifications | No sound alerts — visual + push notification covers the use cases | — Pending (Phase 3) |
| Lowercase filenames (app.tsx, app.css) | Consistency across codebase | ✓ Good |
| Amber/gold accent (#f59e0b) on purple dark theme | MTG-inspired, high contrast, glanceable | ✓ Good |
| Join form overlays player list (visible behind) | Context — players see who's already joined while entering name | ✓ Good |
| justJoinedRef guard for join race condition | Defers validation effect after join until player appears in refetched list | ✓ Good — fixed race condition |
| eslint-disable with justification for set-state-in-effect | useRef approach blocked by react-hooks/refs rule; documented justification | ⚠️ Revisit — 3 suppressed warnings |
| Cypress spec files use .js extension | Matches specPattern and ESLint scoping | ✓ Good |
| data-testid hierarchical kebab-case naming | component-element pattern for consistency | ✓ Good |
| 6-7 player pod: warn admin, proceed anyway | Avoids complexity of 3-player pods; admin has context to decide | ✓ Good |
| Trash2 icon for remove player | UserMinus was confusing; trash can is more universally understood | ✓ Good |
| REPLICA IDENTITY FULL on tables with Realtime filters | Required for Supabase Realtime to filter by non-PK columns (event_id) | ✓ Good — fixed silent Realtime failure |
| SUPABASE_DB_PASSWORD in .env | Enables CLI `supabase db push` without manual password entry | ✓ Good — .env is gitignored |

---
*Last updated: 2026-02-25 after Phase 2 complete + bug fixes (anon key, REPLICA IDENTITY, migration push)*
