# Pause Context: Stryker Mutation Fixes + v2.0 Milestone Setup

**Paused:** 2026-02-24
**Branch:** main
**Last commit:** 39047ca (docs: start milestone v2.0 Complete App)

## What Was Happening

### v2.0 Milestone Setup (IN PROGRESS)

We were at **Step 9: Define Requirements** in the `/gsd:new-milestone` workflow.

**Completed steps:**
1. v1.0 milestone archived, tagged, pushed
2. v2.0 milestone started (PROJECT.md and STATE.md updated, committed)
3. Research skipped (user chose to skip)
4. Config updated: `workflow.research: false`
5. User confirmed scope: ALL remaining features (pod gen + timer + admin + event polish + deployment)
6. Version: v2.0
7. 6-7 player decision: Warn admin, proceed anyway (no 3-player pods)

**Remaining steps:**
- Define REQUIREMENTS.md (categories outlined, user confirmed "All 4 categories", said "Yes, let me add some" for additional requirements)
- The additional requirement the user wants: **Run Stryker mutation testing across full codebase to near 100%** — this is BOTH a task to do NOW and a requirement for ongoing test quality
- Create roadmap via gsd-roadmapper
- Commit requirements and roadmap

### Stryker Mutation Testing (BLOCKING — user wants this done first)

**Baseline run completed:** 92.22% overall (403 killed, 34 survived, 96 errors)

**Survivors by file:**

| File | Score | Survivors | Priority |
|------|-------|-----------|----------|
| `pages/EventPage.tsx` | 79.49% | 24 | HIGH |
| `components/PlayerList.tsx` | 93.02% | 3 | MEDIUM |
| `hooks/useEventChannel.ts` | 95.45% | 1 | LOW |
| `hooks/useJoinEvent.ts` | 94.74% | 1 | LOW |
| `hooks/useVisibilityRefetch.ts` | 95.00% | 1 | LOW |
| `hooks/useAddPlayer.ts` | 95.00% | 1 | LOW |
| `components/AddPlayerForm.tsx` | 96.30% | 1 | LOW |
| `components/JoinEventForm.tsx` | 96.15% | 1 | LOW |
| `pages/LandingPage.tsx` | 95.00% | 1 | LOW |

**100% already:** lib/ (all 3 files), app.tsx, ConfirmDialog, CreateEventModal, PlayerItem, QRCodeDisplay, useAdminAuth, useCreateEvent, useDropPlayer, useEvent, useEventPlayers

**EventPage.tsx survivors (24) — categorized:**

1. **justJoinedRef race condition guard** (lines 50-68, 111): ~12 survivors
   - BlockStatement mutations (emptying if blocks)
   - ConditionalExpression mutations (if true/false)
   - MethodExpression (some→every), ArrowFunction, EqualityOperator
   - BooleanLiteral (justJoinedRef.current = true→false and false→true)
   - Tests don't adequately verify: (a) that justJoinedRef blocks clearing during pending join, (b) that playerExists check with correct ID matters, (c) that justJoinedRef resets after player confirmed

2. **Dependency array mutations** (lines 54, 114, 125): 3 survivors
   - `[eventId]` → `[]` on three useEffect/useCallback hooks
   - Tests don't detect when eventId dependency is removed (would break on eventId change)

3. **String fallback mutations** (lines 32, 38): 2 survivors
   - `eventId ?? ''` → `eventId ?? "Stryker was here!"`
   - Tests for no-eventId case render "Invalid Event" before hooks run

4. **New player highlight detection** (lines 94-99): ~5 survivors
   - `added.size > 0` → `added.size >= 0` or `true`
   - Cleanup function `() => clearTimeout(timer)` → `() => undefined`
   - Tests don't verify: (a) that empty added set doesn't trigger setState, (b) cleanup prevents memory leak

5. **LandingPage.tsx** (line 36): 1 survivor
   - `if (eventId)` → `if (true)` — navigation called even with null eventId

**Test files already read into context:**
- `src/pages/EventPage.test.tsx` (full file — 942 lines)
- `src/pages/EventPage.tsx` (full file — 267 lines)

**Fix strategy:**
- EventPage.tsx tests need the most work — add tests that verify eventId dependency changes, justJoinedRef guard behavior across rerenders, and highlight edge cases
- For hooks/components with 1 survivor each, read the specific Stryker output and add targeted assertions
- Target: as close to 100% as possible (user's request)

## Resume Instructions

1. `/clear` then resume
2. Read this file and `.planning/STATE.md`
3. **Do Stryker fixes first** — fix all 34 survivors, re-run Stryker to verify
4. Then continue v2.0 milestone: define REQUIREMENTS.md, create roadmap
5. The user's additional requirement was about running Stryker — capture as INFR requirement

## Files Modified (uncommitted)

None — all changes committed. Stryker results are in memory only (full output was saved to tool-results but that's ephemeral).
