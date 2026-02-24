# Phase 1: Foundation and Player Flow - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Supabase schema, real-time player registration/drop, and mobile-first dark UI. Players can create events, join via link/QR/code, see each other in real time, and self-drop. Admin passphrase system established. No pods, no timer, no round generation — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Event Creation Flow
- Landing page is minimal — just actions, no fluff. Big "Create Event" button + join field + QR scan option
- Join supports both URL/event code input AND QR code scanning
- Event creation is a single-step modal: event name + passphrase + create. No multi-step wizard
- After creating, admin is prompted to enter their own name to join as a player (with option to skip), then lands on the event page
- No site-wide gate — anyone can create an event

### Player Join Experience
- When a player opens an event link, they see a name input front and center ("Enter your name to join") with the player list visible behind it
- Player's own name is visually highlighted (distinct color/bold) in the list — no "(you)" tag
- localStorage persistence: store player ID so returning to the event link recognizes them automatically
- Name validation: minimum 2 characters, maximum 20 characters, no duplicates within event (friendly error on collision)

### Player List Display
- Simple vertical list, one name per row. Clean and scannable
- Header shows count: "Players (12 active, 3 dropped)"
- Dropped players collapsed by default ("Dropped (3)" expands on tap), grayed out when visible
- "Leave Event" button is a separate action outside the player list, not inline. More deliberate
- Confirmation required before dropping

### Dark Theme & Visual Feel
- MTG-themed dark: deep purple/blue tones, subtle fantasy texture hints. Feels like the game, not a generic dark mode
- Accent color: Claude's discretion — pick what looks best against the MTG dark palette
- Typography: slightly stylized — display font for headers (some personality), clean sans-serif for body text. Must be readable at arm's length
- Real-time updates: brief highlight animation when a new player joins (background flash, then settles). Noticeable but not distracting
- No slow animations. Speed matters when 15 people are staring at their phones

### Claude's Discretion
- Accent color choice (whatever pops against purple/blue dark theme)
- Exact font pairing (display + body)
- Loading states and error state styling
- Exact card/container styling (borders, shadows, rounding)
- Mobile breakpoints and responsive behavior
- Supabase schema details and RLS implementation

</decisions>

<specifics>
## Specific Ideas

- The app should feel like a utility built for Commander players, not a generic event tool. The dark theme with MTG-inspired colors sets the tone
- Landing page should be dead simple — someone pulls it up on their phone at the game store and immediately knows what to do
- Admin creating an event should be able to join as a player in the same flow (name prompt after creation)
- The player list highlight for "your" name should be immediately obvious — you glance at your phone and know you're in

</specifics>

<deferred>
## Deferred Ideas

- User accounts / persistent usernames across events — potential future phase. Would let players maintain identity across game nights without re-entering names
- Player profiles with stats — mentioned in v2 requirements

</deferred>

---

*Phase: 01-foundation-and-player-flow*
*Context gathered: 2026-02-20*
