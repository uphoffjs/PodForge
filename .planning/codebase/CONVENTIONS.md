---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
---

# Coding Conventions

**Analysis Date:** 2026-06-27

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `PodCard.tsx`, `AdminControls.tsx`, `EventInfoBar.tsx`
- React hooks: camelCase with `use` prefix `.ts` — `useGenerateRound.ts`, `useEventChannel.ts`
- Pure utility/library files: kebab-case `.ts` — `pod-algorithm.ts`, `player-identity.ts`, `query-client.ts`
- Tests: co-located with source, same name plus `.test.` — `PodCard.test.tsx`, `useGenerateRound.test.ts`
- Cypress specs: kebab-case with `.cy.js` suffix — `pods-of-3.cy.js`, `timer.cy.js`
- Type definitions: kebab-case `.ts` in `src/types/` — `database.ts`

**Functions and Hooks:**
- Exported functions: PascalCase for React components (`PodCard`, `EventInfoBar`), camelCase for hooks and utilities (`useAdminAuth`, `getStoredPlayerId`, `buildOpponentHistory`)
- Internal helpers: camelCase — `shuffleArray`, `computeRemaining`, `formatDisplay`, `getOrdinal`
- Event handlers: `handle` prefix — `handleGenerateRound`, `handleEndEvent`, `handleCopyLink`

**Variables:**
- camelCase for all local variables and state
- Module-level constants: SCREAMING_SNAKE_CASE — `NUM_STARTS`, `STORAGE_KEY_PREFIX`, `PLAYER_KEY_PREFIX`, `POD_COLORS`
- React state: `[value, setValue]` destructuring pattern — `[isGenerating, setIsGenerating]`, `[qrExpanded, setQrExpanded]`
- Unused variables prefixed with `_` to satisfy ESLint `argsIgnorePattern`

**Types and Interfaces:**
- TypeScript interfaces: PascalCase — `PlayerInfo`, `RoundHistory`, `PodAssignment`, `PodAssignmentResult`
- Type aliases: PascalCase — `Event`, `Player`, `Round`, `Pod`, `PodPlayer`, `RoundTimer`, `PodWithPlayers`
- Props interfaces inline per component file — `PodCardProps`, `AdminControlsProps`, `TimerDisplayProps`
- Database entity types live in `src/types/database.ts`

## Code Style

**Formatting:**
- No dedicated Prettier config file detected — formatting enforced via TypeScript compiler and ESLint
- Indentation: 2 spaces (observed across all source files)
- Trailing semicolons: used throughout
- Single quotes for strings in TypeScript; backtick template literals for dynamic strings
- Arrow functions for all callbacks and most function expressions; `function` keyword for top-level named exports and helpers that need hoisting

**Linting:**
- ESLint 9 flat config: `eslint.config.js`
- Rules enabled: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `eslint-plugin-react-refresh` (Vite mode)
- `eslint-plugin-cypress` scoped to `cypress/**/*.js` files
- Key custom rule: `@typescript-eslint/no-unused-vars` set to `error` with `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'`
- ESLint directive comments used sparingly and always with explanation: `// eslint-disable-next-line react-hooks/set-state-in-effect -- Sync from localStorage on mount is inherently an effect`

**TypeScript:**
- Strict mode via `tsconfig.app.json`
- Path alias `@/` maps to `./src/` — use `@/lib/supabase`, `@/hooks/useEvent`, `@/components/PodCard`
- Generic type parameters on hooks and queries — `useQuery<RoundTimer | null>`, `useQuery<PodWithPlayers[]>`
- Type assertions kept minimal — prefer type-safe generics; use `as TypeName` only when PostgREST returns untyped `data`

## Import Organization

**Order (observed pattern):**
1. React and core framework — `import { useState, useEffect } from 'react'`
2. Third-party libraries — `import { useQuery } from '@tanstack/react-query'`, `import { toast } from 'sonner'`
3. Path-aliased internal imports — `import { supabase } from '@/lib/supabase'`, `import { useEvent } from '@/hooks/useEvent'`
4. Relative component imports — `import { PodCard } from '@/components/PodCard'`
5. Type imports (`import type { ... }`) — grouped after value imports from the same module

**Path Aliases:**
- `@/` → `./src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- Always use `@/` for cross-directory imports; relative paths only used for same-directory imports in tests

## Error Handling

**Supabase Mutations:**
- All mutations destructure `{ data, error }` from Supabase calls
- `if (error) throw error` — re-throw to propagate to React Query's `onError`
- Hook-level `onError` handlers map known error message substrings to user-facing toast messages via `toast.error()`
- Pattern: `const message = error.message.toLowerCase(); if (message.includes('...')) { toast.error('...') }`
- Unknown errors fall back to a generic message: `toast.error('Failed to ... Please try again.')`

**Component-Level:**
- `try/catch` in event handlers wrapping synchronous throws from pure functions (e.g., `generatePods` throwing on too-few players)
- `instanceof Error` check before accessing `.message`
- Loading and error states propagated from `useQuery` (`isLoading`, `error`) shown as distinct UI states with `data-testid="event-loading"` / `data-testid="event-error"`

**Async:**
- All async paths use `async/await`, not `.then()/.catch()` chains
- `try/catch` around `navigator.clipboard.writeText()` in `EventInfoBar.tsx`

## Logging

**Framework:** `console.error` / `console.warn` — no structured logging library

**Patterns:**
- Errors logged with a `[ModuleName]` prefix: `console.error('[useEventChannel] Realtime channel error:', err?.message)`
- Warnings for degraded but non-fatal states: `console.warn('[useEventChannel] Realtime channel subscription timed out')`
- No `console.log` in production code; debug logging not present

## Comments

**When to Comment:**
- JSDoc block comments on exported pure functions and complex algorithms in `src/lib/pod-algorithm.ts` — `/** Build opponent history matrix... */`
- Inline `//` comments for non-obvious logic: `// Filter active players for the algorithm`, `// Block Realtime WebSocket connections to prevent errors in mocked tests`
- ESLint disable comments must include a rationale after `--`: `// eslint-disable-next-line ... -- reason`
- `// eslint-disable-next-line react-refresh/only-export-components` used when a utility function is intentionally exported from a component file

**Regression Notes:**
- Test comments identify regression scenarios: `it('fairly rotates sit-outs across 4 rounds with 7 players (regression: sit-out-fairness-bug)', ...)`
- Mutation-test intent documented inline in test files when a specific mutant is targeted

## Function Design

**Size:** Single responsibility; complex orchestration lives in page-level components (`EventPage.tsx`), pure logic extracted to `src/lib/`

**Parameters:**
- Hooks accept a single string ID — `useEvent(eventId: string)`, `useAllRoundsPods(eventId: string, roundIds: string[])`
- Components receive explicit typed props interfaces, never spread `...rest`
- Pure algorithm functions use positional args: `generatePods(players, previousRounds, allowPodsOf3?)`

**Return Values:**
- Hooks return the React Query result object directly (`useQuery`, `useMutation`)
- Algorithm functions return typed result objects: `PodAssignmentResult` with `{ assignments, warnings }`
- Boolean returns for guard checks; never `undefined` from functions that should always return

## Module Design

**Exports:**
- One primary export per file (named, not default) for components and hooks — `export function PodCard(...)`, `export function useTimer(...)`
- Pure utility functions exported individually from `src/lib/` — `export function buildOpponentHistory(...)`, `export function computePodSizes(...)`
- Type/interface exports alongside value exports in the same file

**Barrel Files:**
- Not used — no `index.ts` barrel files; all imports reference the file directly

## React Patterns

**State:**
- `useState` for local UI state; React Query for server state
- `useRef` for values that must not trigger re-renders: `prevPlayerIdsRef`, `justJoinedRef`
- Derived values computed inline or via `useMemo` (not yet used — current computations are cheap enough)

**Side Effects:**
- `useEffect` for: localStorage reads on mount, Realtime subscriptions (`useEventChannel`), countdown timer intervals (`useCountdown`)
- Cleanup functions always provided for subscriptions and intervals

**Data-testid Convention:**
- Every interactive element and meaningful display region has a `data-testid`
- Naming convention: `kebab-case`, namespaced by component area — `event-info-name`, `pod-card-{n}`, `pod-player-{id}`, `timer-pause-btn`, `admin-remove-player-{id}`
- Dynamic testids use template literals — `data-testid={`pod-card-${podNumber}`}`
- Cypress tests use only `cy.getByTestId()` (never CSS classes or tag selectors)

---

*Convention analysis: 2026-06-27*
