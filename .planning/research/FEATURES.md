# Feature Research

**Domain:** Casual MTG Commander event pod-pairing web app
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH

## Competitive Landscape Summary

The Commander pod-pairing space has a clear gap. Existing tools fall into two categories:

1. **Full tournament platforms** (TopDeck.gg, Melee.gg, MTGEvent.com) -- built for competitive play with Swiss pairings, scoring systems, standings, registration flows, and account requirements. Overkill for "8 friends at a game store" casual nights.
2. **Official WotC tools** (Companion app / EventLink) -- limited to 8 players without a Wizards account, primarily 1v1 focused, Commander pod support still in development and tightly coupled to the WPN store ecosystem.

Neither category serves the specific use case: a casual playgroup organizer who wants to say "scan this QR code, we'll pair pods, go play." That is the gap this app fills.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Event creation with shareable link** | Every event tool has this; it's how players join | LOW | Event name + passphrase, generates unique URL |
| **QR code for event join** | Standard pattern in every event app (TopDeck, EventLink, WPN all use QR); players expect to scan and go | LOW | Client-side generation with `qrcode.react`; must be large enough to scan from a phone held at arm's length |
| **Player self-registration (name entry only)** | No-friction join is the core value; TopDeck takes 30 seconds, this should take 10 | LOW | No accounts, just name + event association |
| **Duplicate name prevention** | Without it, two "Jake"s cause confusion that breaks pod assignments | LOW | Unique constraint on (event_id, name); friendly error message |
| **Real-time player list** | Every competitor shows who's in the event; players need to see their group | LOW | Supabase Realtime subscription; shows active + dropped |
| **Pod generation (4-player pods)** | The entire point of the app; TopDeck, EDH Tournament app, and Companion all do this | HIGH | Greedy algorithm minimizing repeat opponents via history matrix; handle remainders with byes |
| **Random seat assignment (1st-4th)** | Seat order eliminates "who goes first?" arguments; TopDeck assigns table positions | LOW | Random shuffle per pod; display clearly on pod cards |
| **Bye handling for odd player counts** | Every serious pairing tool handles byes; without it, leftover players are stranded | MEDIUM | Prioritize players with fewest byes; ties broken randomly; bye players see "Bye" not a pod |
| **Round history (previous rounds visible)** | Players want to check who they played; every tournament app shows round history | LOW | Collapsible sections, most recent first |
| **Player self-drop** | TopDeck supports drop/re-entry; players need to leave mid-event without bugging the admin | LOW | Marks inactive; keeps current round visible; player enters pool for next round if re-activated |
| **Admin passphrase protection** | Without access control, any player can generate rounds or remove people; every tournament tool gates admin actions | LOW | Per-event passphrase; session-stored after first entry; no user accounts needed |
| **Real-time updates (pod assignments push to all phones)** | This is the core promise -- "every player instantly sees their pod assignment." TopDeck pushes pairings to phones; MTGEvent updates in real time | HIGH | Supabase Realtime channels; must handle reconnection gracefully |
| **Mobile-first responsive design** | TopDeck has native apps; MTGEvent is fully responsive; 90%+ of users will be on phones at an event | MEDIUM | Dark theme, large touch targets, pod cards readable at arm's length |

### Differentiators (Competitive Advantage)

Features that set this app apart from TopDeck/Companion/MTGEvent. Not required, but these are why someone would choose this over alternatives.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-account, zero-install access** | TopDeck requires account creation + app install. MTGEvent requires accounts for self-signup. Companion requires Wizards account for >8 players. This app: scan QR, type name, done. The lowest friction entry in the space. | LOW | This is an architecture decision, not a feature to build -- it's the absence of auth that differentiates |
| **Shared round timer with visual countdown** | TopDeck has timers but they're admin-side. Commander Clock is per-device. No competitor has a shared, server-synced timer that every player sees simultaneously on their phone with color-coded urgency states (green/yellow/red). | MEDIUM | Server-side timer state (duration, started_at, paused_remaining); clients calculate independently; color changes at 10min/5min/0:00 |
| **Browser notifications on timer expiry** | No casual Commander tool sends push notifications when time runs out. Players background the app during games -- they need to know when time is up without watching the screen. | MEDIUM | Notification API permission flow; must handle iOS Safari limitations (requires PWA install on iOS 16.4+); graceful degradation to in-app visual alert |
| **Admin timer controls (pause/resume/+5min)** | Games run long. Pods finish at different times. No casual tool gives the organizer granular timer control that syncs to all phones. | LOW | Pause stores remaining time; resume recalculates started_at; +5 adjusts duration; all broadcast via Realtime |
| **Opponent history tracking across rounds** | TopDeck's Swiss algorithm does this for competitive play. No casual tool tracks who you've already played and avoids repeat matchups. For a 4-round night with 12 players, avoiding repeats matters. | MEDIUM | Opponent history matrix; stored per-event; feeds pod generation algorithm |
| **Instant pod visibility (glanceable cards)** | TopDeck buries pairings in tournament structure. This app's pod cards should be the hero UI -- big names, clear seat numbers, visible from across a table. Designed for the "hold up phone to check" moment. | LOW | UI/UX priority, not technical complexity; large fonts, high contrast, minimal chrome |
| **Multiple simultaneous admins** | Game stores often have multiple staff running events. No casual tool explicitly supports this -- most assume single organizer. | LOW | Any client with the correct passphrase gets admin controls; no admin "session" to conflict |
| **Mid-event player joins** | Players arrive late to casual events constantly. TopDeck handles late registration but it's buried in settings. This should be seamless -- new player joins, gets paired next round with empty history and 0 bye count. | LOW | Insert player with null history; algorithm treats them as having played nobody |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a casual Commander pod pairer.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **User accounts / authentication** | "Track my history across events" | Adds friction to the join flow which is the #1 value prop; requires password management, forgot-password flows, GDPR compliance; casual players don't want another account. TopDeck needs accounts because they track competitive records -- we don't. | Each event is standalone. Players type a name and play. No persistence needed. |
| **Point tracking / standings / leaderboards** | "Make it competitive" | Commander is inherently casual for this app's audience. Point systems create toxic incentives in multiplayer (kingmaking, spite plays, salt). TopDeck's point modes exist for competitive REL -- our users aren't playing competitive REL. The WPN guide explicitly recommends participation rewards over competitive scoring for casual events. | If users want competitive Commander, TopDeck.gg exists and does it well. This app is for casual pod assignment only. |
| **Deck registration / power level brackets** | "Match similar power levels" | Requires deck database integration (Moxfield/Archidekt API), power level is subjective and contentious, self-reported brackets are unreliable. WotC's bracket system is still in beta and controversial. This is a pairing app, not a deck management app. | Let the playgroup self-organize power levels socially. The app pairs pods; the humans handle deck selection. |
| **Chat / messaging / social features** | "Coordinate with my pod" | Players are physically together at the event -- they can talk. Adding chat means moderation, abuse potential, notification spam, and feature bloat. Every tournament app that added chat regretted the moderation burden. | Players communicate in person. The app shows who's in your pod -- go find them. |
| **Player profile persistence across events** | "Remember my name next time" | Requires device-local storage or accounts; creates confusion when multiple people use the same phone; adds complexity for a feature that saves typing 5 characters once per event. | Type your name each event. It takes 3 seconds. |
| **Sound alerts on timer expiry** | "I need an audio notification" | Mobile browsers have aggressive autoplay policies; sounds fail silently on many devices; sounds in a game store are obnoxious and overlap with other noise. Multiple phones blaring simultaneously creates chaos. | Browser notification (vibration + banner) + visual color change on the timer. These work when the app is backgrounded, which is the actual use case. |
| **Spectator mode / stream overlay** | "Let viewers watch the bracket" | No spectators at casual Commander night. This is 8-16 friends, not a streamed tournament. Spectator features add read-only view complexity for zero users. | The event page is already publicly viewable -- anyone with the link can see pods and rounds. |
| **Swiss-style competitive pairings (by record)** | "Pair winners vs winners" | Swiss pairings make sense for 1v1 competitive formats. In casual 4-player Commander, there's no meaningful "record" -- one winner per pod of 4 means 75% of players "lose" each round. Swiss creates feel-bad pairings where the 0-3 player is stuck in the "losers pod." | Random pairing with repeat-opponent avoidance. Everyone gets varied opponents regardless of how their games went. |
| **Online/remote play support** | "What about remote players?" | SpellTable already handles remote Commander play with webcam support and matchmaking. Building video/audio into a pairing app is scope explosion. This app is for in-person events. | If remote players want to play, they use SpellTable. This app is for people physically present at the same location. |

## Feature Dependencies

```
[Event Creation]
    |-- requires --> [Admin Passphrase System]
    |-- enables  --> [Shareable Link / QR Code]
    |-- enables  --> [Player Self-Registration]

[Player Self-Registration]
    |-- requires --> [Real-time Player List]
    |-- requires --> [Duplicate Name Prevention]
    |-- enables  --> [Player Self-Drop]
    |-- enables  --> [Pod Generation]

[Pod Generation Algorithm]
    |-- requires --> [Player List (min 4 active)]
    |-- requires --> [Opponent History Matrix]
    |-- produces --> [Pod Assignments with Seat Order]
    |-- produces --> [Bye Assignments]
    |-- enables  --> [Round History]

[Real-time Updates (Supabase Realtime)]
    |-- required by --> [Real-time Player List]
    |-- required by --> [Pod Assignment Push]
    |-- required by --> [Shared Timer Sync]
    |-- required by --> [Player Drop/Remove Notifications]

[Shared Round Timer]
    |-- requires --> [Real-time Updates]
    |-- requires --> [Admin Timer Controls]
    |-- enables  --> [Browser Notifications on Expiry]

[Admin Passphrase System]
    |-- gates --> [Pod Generation]
    |-- gates --> [Timer Controls]
    |-- gates --> [Player Removal]
    |-- gates --> [Player Re-activation]
    |-- gates --> [Event Ending]

[Browser Notifications]
    |-- requires --> [Shared Round Timer]
    |-- requires --> [Notification API Permission Flow]
    |-- degrades to --> [In-app Visual Alert]
```

### Dependency Notes

- **Real-time Updates is foundational:** Nearly every user-facing feature depends on Supabase Realtime working correctly. This must be rock-solid before building features on top of it.
- **Pod Generation requires Player Registration:** Cannot generate pods without a player list. Registration flow must be complete and tested before algorithm work.
- **Timer requires Real-time:** The shared timer is meaningless without synchronized state across all clients. Timer work should come after Realtime is proven.
- **Browser Notifications have platform constraints:** iOS Safari requires PWA installation (iOS 16.4+); Android Chrome works directly; must build graceful fallback for unsupported browsers.
- **Admin Passphrase gates all admin actions:** This is a security boundary. Must be implemented before any admin action is exposed in the UI.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to run one casual Commander night successfully.

- [ ] **Event creation with name + passphrase** -- without this, nothing works
- [ ] **Shareable link + QR code** -- the primary join mechanism
- [ ] **Player self-registration (name only)** -- zero-friction entry
- [ ] **Duplicate name prevention** -- avoid confusion
- [ ] **Real-time player list** -- everyone sees who's joined
- [ ] **Pod generation with repeat-opponent avoidance** -- the core algorithm
- [ ] **Random seat assignment (1st-4th)** -- eliminates arguments
- [ ] **Bye handling** -- odd player counts are inevitable
- [ ] **Player self-drop** -- players leave mid-event
- [ ] **Round history** -- check previous pods
- [ ] **Admin passphrase protection** -- gate destructive actions
- [ ] **Real-time pod assignment push** -- the moment of delight
- [ ] **Shared round timer with visual countdown** -- the key differentiator
- [ ] **Admin timer controls (pause/resume/+5min)** -- practical necessity
- [ ] **Browser notifications on timer expiry** -- critical for backgrounded phones
- [ ] **Mobile-first dark theme** -- 90%+ of users on phones
- [ ] **Admin: remove player, re-activate dropped player, end event** -- basic admin toolkit

### Add After Validation (v1.x)

Features to add once the core loop is proven at real events.

- [ ] **Event history / read-only mode for ended events** -- triggered when users ask "what were the pods last week?"
- [ ] **Multiple concurrent events** -- triggered when more than one group wants to use the app at the same time (e.g., game store running two pods simultaneously)
- [ ] **Improved pod algorithm (configurable pod sizes, 3-player pods option)** -- triggered when users report edge cases the greedy algorithm handles poorly
- [ ] **Event info bar with expandable QR, player count, round number** -- polish pass after core UX is validated

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **PWA install prompt** -- makes browser notifications work on iOS; defer until user volume justifies the added UX flow
- [ ] **Event templates / presets** -- for game stores running the same event weekly; defer until repeat organizers ask for it
- [ ] **Accessibility audit (WCAG 2.2)** -- important but defer deep audit until UI is stable
- [ ] **Analytics dashboard for organizers** -- how many players per event, average rounds, popular time slots; defer until organizers express interest
- [ ] **Custom pod sizes (3-player, 5-player, 6-player)** -- defer until requested; 4-player is the Commander standard

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Event creation + shareable link + QR | HIGH | LOW | P1 |
| Player self-registration (name only) | HIGH | LOW | P1 |
| Real-time player list | HIGH | MEDIUM | P1 |
| Pod generation algorithm | HIGH | HIGH | P1 |
| Random seat assignment | HIGH | LOW | P1 |
| Bye handling | HIGH | MEDIUM | P1 |
| Real-time pod push to all clients | HIGH | MEDIUM | P1 |
| Admin passphrase system | HIGH | LOW | P1 |
| Player self-drop | MEDIUM | LOW | P1 |
| Round history (collapsible) | MEDIUM | LOW | P1 |
| Shared round timer | HIGH | MEDIUM | P1 |
| Admin timer controls | HIGH | LOW | P1 |
| Browser notifications (timer expiry) | HIGH | MEDIUM | P1 |
| Mobile-first dark theme | HIGH | MEDIUM | P1 |
| Admin player management (remove/reactivate) | MEDIUM | LOW | P1 |
| Event ending (read-only mode) | MEDIUM | LOW | P1 |
| Duplicate name prevention | MEDIUM | LOW | P1 |
| Mid-event player joins | MEDIUM | LOW | P1 |
| Multiple simultaneous admins | LOW | LOW | P2 |
| Multiple concurrent events | MEDIUM | LOW | P2 |
| PWA install flow | MEDIUM | MEDIUM | P3 |
| Event templates | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the app cannot run a Commander night without these
- P2: Should have, add when possible -- enhances the experience but not blocking
- P3: Nice to have, future consideration -- only build when validated by user demand

## Competitor Feature Analysis

| Feature | TopDeck.gg | MTG Companion | MTGEvent.com | EDH Tournament App | **Pod Pairer (Ours)** |
|---------|-----------|---------------|--------------|-------------------|----------------------|
| Account required | Yes (free) | Yes (Wizards) | Yes | No | **No** |
| App install required | Yes (iOS/Android) | Yes (iOS/Android) | No (web) | Yes (Android) | **No (web)** |
| Commander pod pairing | Yes (5 algorithms) | Limited (8 players max without account) | Yes (basic) | Yes (Swiss) | **Yes (greedy anti-repeat)** |
| Casual vs competitive focus | Competitive | Mixed | Competitive | Competitive | **Casual only** |
| Shared synced timer | Admin-side only | No | No | No | **Yes (all clients)** |
| Browser notifications | No (push via app) | No (push via app) | No | No | **Yes** |
| QR code join | Yes | Yes (via EventLink) | No | No | **Yes** |
| Zero-friction player join | No (account needed) | No (account needed) | No (account needed) | Manual entry by admin | **Yes (name only)** |
| Seat assignment | Table assignment | No | No | No | **Yes (1st-4th)** |
| Player self-drop | Yes | Yes | Unknown | No (admin only) | **Yes** |
| Repeat opponent avoidance | Yes (Swiss) | Basic | Basic | Yes (Swiss) | **Yes (history matrix)** |
| Price | Free tier + paid plans | Free | Free | Free | **Free** |
| Offline support | Yes | Partial | No | Yes (local only) | **No (requires internet)** |

### Competitive Positioning

Our app is NOT competing with TopDeck.gg. TopDeck serves competitive Commander tournaments with Swiss pairings, scoring, top cuts, and Discord integration. That is a different product for a different audience.

Our app competes with "the group chat" -- the current solution for casual Commander nights where someone texts "who's coming Saturday?" and then manually assigns pods with pen and paper or a spreadsheet. The competitors are:

1. **Pen and paper** -- no repeat tracking, slow, error-prone
2. **Random name picker websites** -- no pod-of-4 logic, no persistence, no timer
3. **MTG Companion Home Tournament Organizer** -- limited to 8 players, requires Wizards account, 1v1 focused
4. **A spreadsheet** -- functional but not real-time, not mobile-friendly, no timer

We win by being faster to start, requiring nothing to install, and providing a shared timer that every phone displays simultaneously.

## Sources

- [TopDeck.gg Tournament Operations Features](https://topdeck.gg/features/tournament-operations) -- MEDIUM confidence (official product page)
- [TopDeck.gg Player Experience Features](https://topdeck.gg/features/player-experience) -- MEDIUM confidence (official product page)
- [TopDeck.gg Running Commander Tournaments](https://topdeck.gg/help/running-commander-tournament) -- MEDIUM confidence (official help docs)
- [MTG Companion App - App Store](https://apps.apple.com/us/app/magic-the-gathering-companion/id1455161962) -- MEDIUM confidence (official listing)
- [MTG Companion App - Magic: The Gathering](https://magic.wizards.com/en/products/companion-app) -- MEDIUM confidence (official product page)
- [MTGEvent.com Tournament Software](https://www.mtgevent.com/mtg-tournament-software/) -- MEDIUM confidence (official product page)
- [EDH Tournament App - Google Play](https://play.google.com/store/apps/details?id=com.lucaswmolin.edhtournament) -- LOW confidence (third-party app listing)
- [Melee.gg Tournament Platform](https://melee.gg/) -- MEDIUM confidence (official product page)
- [WPN: How to Run Successful Commander Events](https://wpn.wizards.com/en/news/how-to-run-successful-commander-events-and-grow-your-community) -- HIGH confidence (official WotC guidance)
- [SpellTable - Remote Magic](https://spelltable.wizards.com/) -- MEDIUM confidence (official product)
- [WPN EventLink Pod Pairing Updates](https://wpn.wizards.com/en/news/eventlink-beta-updates-15-october-2020-within-pod-pairing-and-more) -- MEDIUM confidence (official WPN blog)
- [NN/g QR Code Usability Guidelines](https://www.nngroup.com/articles/qr-code-guidelines/) -- HIGH confidence (authoritative UX research)
- [PWA Push Notification Best Practices](https://www.magicbell.com/blog/using-push-notifications-in-pwas) -- MEDIUM confidence (technical guide)

---
*Feature research for: Casual MTG Commander event pod-pairing web app*
*Researched: 2026-02-20*
