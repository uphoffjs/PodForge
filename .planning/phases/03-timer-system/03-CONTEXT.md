# Phase 3: Timer System - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can start, pause, resume, extend, and cancel a round timer that all players see counting down in real time with visual urgency cues and browser notifications at zero. Timer is part of the round generation flow and uses server-authoritative timestamps.

</domain>

<decisions>
## Implementation Decisions

### Timer display & placement
- Timer is sticky at top of page, always visible even when scrolling through pods
- Large & bold countdown numbers — the timer is the main thing players check
- Color thresholds: yellow under 10 min, red under 5 min, flashing red pulse animation at 0:00
- After hitting zero: switches to counting UP (overtime), e.g. "+2:30 over"

### Admin timer controls
- Timer duration is set as part of the "Generate Round" flow — admin picks duration, then generates, timer starts immediately
- Preset buttons only: 60, 90, 120 minutes (standard Commander game lengths)
- Cancel timer requires confirmation dialog (same pattern as End Event)
- Pause, resume, and +5 minutes are non-destructive — no confirmation needed

### Claude's Discretion
- Notification behavior: when/how to request browser notification permission, notification content at zero, sound vs silent, behavior when tab is focused vs background
- Timer lifecycle edge cases: what happens when a new round is generated while timer is running, timer state when event ends, timer visibility after hitting zero
- Exact animation/transition choices for urgency thresholds
- Timer controls layout and positioning relative to the timer display

</decisions>

<specifics>
## Specific Ideas

- Timer should feel like a chess clock or tournament timer — clear, authoritative, impossible to miss
- Overtime counting is important so players and admin can see exactly how long they've gone over

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-timer-system*
*Context gathered: 2026-02-25*
