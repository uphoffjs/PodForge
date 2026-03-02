# Commander Pod Pairer

## What This Is

A web app for casual Magic: The Gathering Commander playgroups to manage pod pairings during events. Players join via QR code or shareable link, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions (creating events, generating rounds, removing players, controlling timers) are protected behind a per-event passphrase. No user accounts or logins — just show up and play. Includes an event info bar, comprehensive test coverage, and a bulletproof CI/CD pipeline.

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
- ✓ Pod generation algorithm: minimize repeat opponents via greedy assignment with opponent history matrix — v2.0
- ✓ Bye rotation: players with fewest byes prioritized, ties broken randomly — v2.0
- ✓ Fewer than 4 players blocks round generation with error — v2.0
- ✓ Random seat order (1st-4th) assigned per pod, displayed clearly — v2.0
- ✓ Bye pod members get no seat assignment, visually distinct — v2.0
- ✓ Previous rounds visible in collapsible sections, most recent first — v2.0
- ✓ Admin can remove player, re-activate dropped player, end event — v2.0
- ✓ Ended event becomes read-only (historical data stays visible) — v2.0
- ✓ Round timer with admin-set duration (optional, with presets: 60/90/120 min) — v2.0
- ✓ Timer visible to all clients, counts down in real time (mm:ss), color changes at thresholds — v2.0
- ✓ Admin timer controls: pause, resume, +5 min, cancel — v2.0
- ✓ Browser notifications when timer hits zero — v2.0
- ✓ Timer state stored server-side (server-authoritative) — v2.0
- ✓ 75 Cypress E2E tests covering admin flow, pod display, player management, sit-out fairness — v2.0
- ✓ 346 Vitest unit tests with 90.6% Stryker mutation score on pod algorithm — v2.0
- ✓ Event info bar with expandable QR code, share link, player count, round number — v3.0
- ✓ Deployment documentation for Vercel + Supabase — v3.0
- ✓ 678 Vitest unit tests with 100% coverage and 100% mutation score on critical hooks — v3.0
- ✓ Bulletproof CI/CD: GitHub Actions CI, Stryker PR gate, Husky pre-commit hooks — v3.0

### Active

#### v4.0 Pod Algorithm Improvements
- [ ] Reduce repeat opponents — stricter pairing diversity across rounds
- [ ] Fix seat order — randomize so players aren't stuck in same seats across rounds
- [ ] Toggle to allow pods of 3 — per-round admin toggle (13 players → 1×4 + 3×3 instead of 3×4 + 1 bye)
- [ ] Full automation tests for all new features (unit/integration/E2E)

#### Carry-forward
- [ ] Multiple simultaneous admins supported per event
- [ ] Player joining mid-event enters pool for next round with empty history and 0 bye count

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

Shipped v3.0 with 16,227 LOC TypeScript/CSS. All features complete: event creation, player flow, pod generation, admin controls, timer system, event info bar, and deployment docs.
Tech stack: React 19 (Vite), Supabase (Postgres + Realtime), Tailwind CSS v4, TypeScript.
Test coverage: 678 Vitest unit tests (100% coverage all metrics), 75 Cypress E2E tests, 15 visual regression baselines, 100% Stryker mutation score on all 8 critical hooks.
CI/CD: GitHub Actions for lint + type-check + tests on push/PR, Stryker mutation testing on PRs (80% break threshold), Husky pre-commit hooks with lint-staged.
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
| Browser notifications for timer | Players need alerts when app is backgrounded on phones | ✓ Good — explicit permission, iOS PWA fallback |
| Full test coverage from v1 | Pod algorithm is complex enough to warrant tests; integration tests catch real-time issues | ✓ Good — caught 13 bugs via milestone audit |
| Visual-only timer alerts + browser notifications | No sound alerts — visual + push notification covers the use cases | ✓ Good — clean UX |
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
| Server-authoritative timer (expires_at - now()) | No drift between clients, server is single source of truth | ✓ Good — zero-drift countdown |
| Denormalized event_id on round_timers | Efficient Realtime filtering without joins | ✓ Good |
| TimerDisplay/TimerControls separation | Clean presenter/controller split, admin controls only when passphrase exists | ✓ Good |
| Explicit notification permission (never auto-request) | Respects user agency, avoids browser permission fatigue | ✓ Good |
| AdminPlayerActions as ReactNode prop | Keeps PlayerItem/PlayerList generic and decoupled from admin logic | ✓ Good |
| PreviousRounds lazy-fetch on expand | Only loads pod data when user expands a round section | ✓ Good — reduces initial payload |
| EventInfoBar as standalone component | Owns copy/QR logic, keeps EventPage simple | ✓ Good |
| it.each parameterized pod tests (4-20 players) | Efficient coverage of all 17 player counts | ✓ Good — 115 tests |
| Dynamic expires_at in timer E2E fixtures | Avoid wall-clock dependency in countdown tests | ✓ Good |
| Vitest 100% coverage thresholds | Any new source file must have corresponding tests | ✓ Good — enforced in CI |
| Single CI job with sequential steps | lint+tsc+test total <2min, avoids multi-runner overhead | ✓ Good |
| PR-only Stryker mutation testing | Avoids wasteful CI runs on already-gated main pushes | ✓ Good |
| Husky + lint-staged pre-commit | ESLint auto-fix on staged .ts/.tsx files before commit | ✓ Good |
| Excluded src/types/** from coverage | Type-only files have no runtime code to instrument | ✓ Good |

## Current Milestone: v4.0 Pod Algorithm Improvements

**Goal:** Improve pod assignment quality — reduce repeat opponents, randomize seat order across rounds, and give admins a per-round toggle to allow pods of 3 (eliminating unnecessary byes).

**Target features:**
- Reduce repeat opponents across rounds (research optimal approach)
- Randomize seat order so players aren't stuck in same seats round after round
- Per-round admin toggle for pods of 3 (e.g., 13 players → 1×4 + 3×3 instead of 3×4 + 1 bye)
- Full test coverage for all algorithm and UI changes

---
*Last updated: 2026-03-02 after v4.0 milestone started*
