# Phase 7: Pods of 3 - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can toggle pods-of-3 per-round to eliminate unnecessary byes. The toggle controls whether the algorithm may produce 3-player pods when that reduces bye count. The full feature works end-to-end through the real Supabase RPC. No database schema changes are needed — `pod_players.seat_number` is already a nullable integer, and `generate_round` accepts arbitrary JSONB pod assignments.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User granted full discretion on all implementation choices. The following areas are all open for Claude to decide based on best practices and the existing codebase patterns:

- **Toggle placement and behavior** — where the "allow pods of 3" toggle appears in AdminControls, whether it persists across rounds or resets, when it's visible vs hidden
- **Pod size partitioning logic** — how to split players into mixed 4/3-player pods to minimize byes, the `computePodSizes()` function design
- **3-player pod display** — how PodCard renders 3-player pods (seat labels, card sizing, visual indicators)
- **Edge case warnings** — how to handle 5 players with toggle on, 4 players (toggle meaningless), and other edge cases. Whether to show warnings, silently fall back, or disable the toggle

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing codebase patterns (timer duration picker as a UI precedent for per-round controls, PodCard's dynamic rendering based on player count).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PodCard.tsx`: Already renders dynamically based on players array length. `getOrdinal()` handles 1st-4th but would need 3rd as max for 3-player pods (already works).
- `AdminControls.tsx`: Timer duration picker is the existing per-round control pattern — toggle could follow similar placement.
- `pod-algorithm.ts`: Core algorithm with `generatePods()`, `greedyAssign()`, `swapPass()`. Currently hardcoded to pods of 4 (`numByes = activePlayers.length % 4`, greedy fills slots 2-4, seat shuffle `[1,2,3,4]`).
- `useGenerateRound.ts`: Hook that calls Supabase RPC — passes pod assignments as JSONB. No changes needed to the hook or RPC.

### Established Patterns
- Per-round controls: Timer picker in AdminControls uses `useState` with button group — toggle could follow this pattern
- Algorithm is a pure function with no side effects — easy to add a parameter
- Test infrastructure: Vitest + Stryker already configured with 80% mutation score threshold

### Integration Points
- `AdminControls.tsx` line 93: `generatePods(activePlayers, previousRounds)` — needs to pass the toggle value
- `pod-algorithm.ts` `generatePods()` signature — needs a new optional parameter for allowPodsOf3
- `generate_round` RPC: Already accepts arbitrary pod sizes in JSONB — no changes needed
- `PodCard.tsx`: Already handles variable player counts — minimal changes expected

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-pods-of-3*
*Context gathered: 2026-03-02*
