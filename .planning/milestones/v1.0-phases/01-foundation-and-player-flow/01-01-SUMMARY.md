---
phase: 01-foundation-and-player-flow
plan: 01
subsystem: infra
tags: [vite, react, typescript, supabase, tailwind, react-router, react-query, dark-theme]

# Dependency graph
requires:
  - phase: none
    provides: "First plan -- no prior dependencies"
provides:
  - "Vite + React 19 + TypeScript project scaffold with all dependencies"
  - "Supabase database migration with events/players tables, RLS, RPC functions"
  - "App shell with React Router, React Query, Sonner providers"
  - "Tailwind CSS v4 dark theme with MTG-inspired purple/blue palette"
  - "Supabase client singleton with Realtime worker mode"
  - "Player identity localStorage persistence utility"
  - "TypeScript types for Event and Player"
affects: [01-02, 01-03, 01-04, 01-05, all-subsequent-plans]

# Tech tracking
tech-stack:
  added: [vite-7.3, react-19, typescript-5.9, supabase-js-2.97, react-router-7.13, tanstack-react-query-5.90, tailwindcss-4.2, qrcode-react-4.2, sonner-2, lucide-react-0.575, vitest-4, testing-library-react-16]
  patterns: [supabase-realtime-worker-mode, react-query-invalidation, forced-dark-theme, column-level-security, rpc-security-definer]

key-files:
  created:
    - supabase/migrations/00001_initial_schema.sql
    - src/lib/supabase.ts
    - src/lib/query-client.ts
    - src/lib/player-identity.ts
    - src/types/database.ts
    - src/app.css
    - src/app.tsx
    - src/components/Layout.tsx
    - src/pages/LandingPage.tsx
    - src/pages/EventPage.tsx
    - src/main.tsx
    - src/test/setup.ts
    - .env.example
  modified:
    - package.json
    - vite.config.ts
    - tsconfig.app.json
    - index.html
    - .gitignore

key-decisions:
  - "Used lowercase filenames (app.tsx, app.css) for consistency with convention"
  - "Google Fonts CDN for Cinzel (display) + Inter (body) with font-display=swap"
  - "Amber/gold accent color against purple dark theme per Claude discretion"

patterns-established:
  - "Supabase client singleton with worker:true and heartbeat reconnect"
  - "React Query as state owner; Realtime triggers invalidation, not direct state mutation"
  - "Forced dark mode via .dark class on html element"
  - "Column-level security: REVOKE SELECT then GRANT specific columns to anon"
  - "RPC functions with SECURITY DEFINER and search_path = public, extensions"
  - "Player identity via localStorage keyed by eventId"
  - "Path alias @ -> ./src for clean imports"

requirements-completed: [INFR-01, INFR-02, INFR-03]

# Metrics
duration: 7min
completed: 2026-02-23
---

# Phase 1 Plan 01: Project Scaffold and Database Foundation Summary

**Vite + React 19 project with Tailwind dark theme, Supabase migration (events/players with RLS/RPC/Realtime), and app shell with React Query + React Router providers**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-23T13:23:42Z
- **Completed:** 2026-02-23T13:31:07Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Complete Vite + React 19 + TypeScript project scaffold with all 12+ dependencies installed and configured
- Supabase database migration with events and players tables, RLS policies, column-level security, Realtime publication, and three RPC functions (create_event, validate_passphrase, drop_player)
- App shell with React Query provider, React Router with / and /event/:eventId routes, Sonner toaster, and dark MTG-themed Layout component
- Tailwind CSS v4 dark theme with custom MTG-inspired palette (deep purple surface, amber/gold accent, Cinzel display font)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vite project and install all dependencies** - `920fdc1` (feat)
2. **Task 2: Create Supabase database migration with schema, RLS, and RPC functions** - `fa029f7` (feat)
3. **Task 3: Create app shell with providers, routing, dark theme, and shared utilities** - `fb7c38a` (feat)

## Files Created/Modified
- `package.json` - Project manifest with all core + dev dependencies
- `vite.config.ts` - Vite with React SWC, Tailwind, path alias, Vitest config
- `tsconfig.app.json` - TypeScript config with path alias
- `index.html` - Dark mode, Google Fonts, Commander Pod Pairer title
- `.env.example` - Required Supabase environment variables
- `.gitignore` - Standard ignores including .env files
- `supabase/migrations/00001_initial_schema.sql` - Complete database schema with RLS, RPC, Realtime
- `src/lib/supabase.ts` - Supabase client singleton with Realtime worker mode
- `src/lib/query-client.ts` - React Query client with Realtime-oriented defaults
- `src/lib/player-identity.ts` - localStorage player ID persistence
- `src/types/database.ts` - Event and Player TypeScript types
- `src/app.css` - Tailwind v4 dark theme with MTG palette
- `src/app.tsx` - Root component with QueryClientProvider, RouterProvider, Toaster
- `src/components/Layout.tsx` - Dark theme wrapper with Outlet
- `src/pages/LandingPage.tsx` - Placeholder landing page
- `src/pages/EventPage.tsx` - Placeholder event page with useParams
- `src/main.tsx` - Entry point rendering App in StrictMode
- `src/test/setup.ts` - Test setup importing jest-dom matchers
- `src/vite-env.d.ts` - Vite client type reference

## Decisions Made
- Used lowercase filenames (`app.tsx`, `app.css`) to match plan conventions and avoid macOS case-insensitive filesystem issues
- Google Fonts CDN for Cinzel (display) + Inter (body) with `font-display=swap` for progressive loading
- Amber/gold (`#f59e0b`) accent color chosen per Claude's discretion -- pops well against the deep purple/blue dark palette

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vite scaffold `npm create vite@latest . --` cancelled when run in-place due to existing `.git` and `.planning` directories. Resolved by scaffolding in `/tmp` and moving files over.
- macOS case-insensitive filesystem required explicit `git mv` to rename `App.css` -> `app.css` and `App.tsx` -> `app.tsx`.

## User Setup Required

None - no external service configuration required at this stage. Supabase credentials will be needed when connecting to a live backend (documented in `.env.example`).

## Next Phase Readiness
- Project scaffold complete with all dependencies, ready for feature development
- Database migration ready to apply to any Supabase project
- App shell running with all providers, ready for real components in Plan 02 (Landing Page + Event Creation)
- All shared utilities (player identity, types, Supabase client, query client) available for import

## Self-Check: PASSED

All 14 key files verified present. All 3 task commits verified (920fdc1, fa029f7, fb7c38a).

---
*Phase: 01-foundation-and-player-flow*
*Completed: 2026-02-23*
