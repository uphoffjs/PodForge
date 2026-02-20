# Commander Pod Pairer

## What This Is

A web app for casual Magic: The Gathering Commander playgroups to manage pod pairings during events. Players join via QR code or shareable link, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions (creating events, generating rounds, removing players) are protected behind a per-event passphrase. No user accounts or logins — just show up and play.

## Core Value

When an admin hits "Generate Next Round," every player instantly sees their pod assignment on their phone — who they're playing with, what seat they're in, and how much time they have. Fast, glanceable, no confusion.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Landing page with event creation and join-by-code/link
- [ ] Event creation sets name + admin passphrase (no site-wide gate — anyone can create)
- [ ] Multiple concurrent events supported, each with its own URL
- [ ] Players join by visiting event link or scanning QR code, entering their name
- [ ] Players can self-drop (marks inactive, doesn't delete; current round assignment stays visible)
- [ ] Real-time player list visible to all (active players + collapsed dropped section)
- [ ] Duplicate name prevention with friendly error (unique constraint on event_id + name)
- [ ] Admin passphrase popup gates admin actions; session-stored after first entry
- [ ] Multiple simultaneous admins supported per event
- [ ] Pod generation algorithm: minimize repeat opponents via greedy assignment with opponent history matrix
- [ ] Bye rotation: players with fewest byes prioritized, ties broken randomly
- [ ] Fewer than 4 players blocks round generation with error
- [ ] Random seat order (1st-4th) assigned per pod, displayed clearly
- [ ] Bye pod members get no seat assignment
- [ ] Round timer with admin-set duration (optional, with presets: 60/90/120 min)
- [ ] Timer visible to all clients, counts down in real time (mm:ss), color changes at 10min/5min/0:00
- [ ] Admin timer controls: pause, resume, +5 min, cancel
- [ ] Browser notifications when timer hits zero (critical — must handle permission flow)
- [ ] Timer state stored server-side (duration, started_at, paused_remaining) so clients calculate independently
- [ ] Real-time updates via Supabase Realtime: player joins/drops, new rounds, timer changes, player removals
- [ ] Event info bar: name, QR code (expandable), shareable link with copy, player count, round number
- [ ] Previous rounds visible in collapsible sections, most recent first
- [ ] Admin can remove player, re-activate dropped player, end event
- [ ] Ended event becomes read-only (historical data stays visible)
- [ ] Player joining mid-event enters pool for next round with empty history and 0 bye count
- [ ] Mobile-first dark theme, glanceable pod cards, minimal chrome, no slow animations
- [ ] Full test coverage: unit tests for pod generation algorithm + integration tests for major features
- [ ] Deployment setup instructions for Vercel + Supabase

### Out of Scope

- User accounts / authentication — unnecessary for casual playgroup use
- Point tracking or standings — not needed for casual play
- Deck registration — out of scope for pairing utility
- Spectator chat or messaging — this is a utility, not a social app
- Player profile persistence across events — each event is standalone
- Sound alerts on timer expiry — visual + browser notification sufficient

## Context

Built for a real Commander playgroup. The primary use case is 8-16 players at a game store or someone's house, all on phones, waiting for pod assignments. Speed and clarity matter more than polish. The pod generation algorithm doesn't need to be globally optimal — greedy is fine for groups under 20.

The spec is detailed and prescriptive: React (Vite) + Supabase + Tailwind CSS + TypeScript. Data model is defined (events, players, rounds, pods, pod_players tables). The pod generation algorithm is specified step-by-step including bye rotation logic and opponent history matrix.

Timer is a core feature, not an afterthought. Players need to know how much time is left from across the table. Browser notifications are critical for when the app is backgrounded on phones.

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
| Per-event passphrase (no site-wide gate) | Anyone should be able to create an event for their group | — Pending |
| Greedy pod assignment (not globally optimal) | Good enough for <20 players, simpler to implement and debug | — Pending |
| Browser notifications for timer | Players need alerts when app is backgrounded on phones | — Pending |
| Full test coverage from v1 | Pod algorithm is complex enough to warrant tests; integration tests catch real-time issues | — Pending |
| Visual-only timer alerts + browser notifications | No sound alerts — visual + push notification covers the use cases | — Pending |

---
*Last updated: 2026-02-20 after initialization*
