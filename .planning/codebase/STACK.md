---
last_mapped_commit: 50bcfe4789ba6a53cbd13225e069dca2a142a9d8
---

# Technology Stack

**Analysis Date:** 2026-06-27

## Languages

**Primary:**
- TypeScript 5.9 — all application and test code under `src/`

**Secondary:**
- JavaScript — Cypress E2E specs (`cypress/e2e/*.cy.js`, `cypress/support/*.js`, `cypress.config.js`, `eslint.config.js`)
- SQL — Supabase migration scripts (`supabase/migrations/*.sql`)

## Runtime

**Environment:**
- Browser (React SPA — no server-side rendering)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` — present and committed

**Node.js (CI/Dev):**
- Node.js 22 (pinned in CI via `.github/workflows/ci.yml` and `cypress.yml`)
- No `.nvmrc` present; local environment may differ

## Frameworks

**Core:**
- React 19.2 — UI rendering (`src/main.tsx`, `src/app.tsx`)
- React Router v7.13 — client-side routing with `createBrowserRouter` (`src/app.tsx`)
  - Routes: `/` → `LandingPage`, `/event/:eventId` → `EventPage`

**Build:**
- Vite 7.3.1 — dev server, bundler, and Vitest host (`vite.config.ts`)
  - Plugin: `@vitejs/plugin-react-swc` v4.2.2 (SWC-based React transform)
  - Plugin: `@tailwindcss/vite` v4.2.1 (Tailwind CSS v4 Vite integration)
- TypeScript compiler (`tsc -b`) for type-checking before production build

**CSS:**
- Tailwind CSS v4.2.1 — utility-first styles, configured via Vite plugin (no `tailwind.config.js`; v4 uses CSS-native config)
- Google Fonts CDN: Cinzel (display/headings) + Inter (body) loaded via `<link>` in `index.html`

**State Management:**
- TanStack Query v5.90 (`@tanstack/react-query`) — all server state, caching, and cache invalidation (`src/lib/query-client.ts`)
  - `staleTime`: 30s default; 5s override for timer queries
  - `gcTime`: 5 minutes
  - Retry: 2 for queries, 1 for mutations
  - `refetchOnWindowFocus`: true (augmented by `useVisibilityRefetch` for coarser control)

**Testing:**
- Vitest 4.0.18 — unit and integration test runner
  - Config embedded in `vite.config.ts` under `test`
  - Environment: jsdom 28.1
  - Coverage: `@vitest/coverage-v8` with 100% threshold enforcement (statements, branches, functions, lines)
  - Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`)
- @testing-library/react 16.3 + @testing-library/user-event 14.6 — component testing
- Cypress 15.10 — E2E browser tests
  - Specs: `cypress/e2e/*.cy.js` (14 spec files)
  - Config: `cypress.config.js`; baseUrl `http://localhost:5173`; video capture on
  - Support: `cypress/support/e2e.js` (state cleanup between tests) + `cypress/support/commands.js` (custom commands)
- Stryker.js 9.5 — mutation testing
  - Config: `stryker.config.mjs`
  - Runner: vitest; Checker: typescript
  - Thresholds: high=90, low=80, break=80
  - Report: `reports/mutation/index.html`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` v2.97 — database client, REST queries, Realtime WebSocket, RPC calls (`src/lib/supabase.ts`)
- `@tanstack/react-query` v5.90 — server state management; every data-fetching hook wraps this (`src/hooks/`)
- `react-router` v7.13 — routing; used for `useParams`, `useNavigate`, `createBrowserRouter`
- `sonner` v2.0.7 — toast notifications; used in 10+ hooks and components as the primary user feedback mechanism

**UI Utilities:**
- `lucide-react` v0.575 — SVG icon library; icons used throughout (`Shuffle`, `Loader2`, `LogOut`, `Pause`, `Play`, etc.)
- `qrcode.react` v4.2 — QR code rendering in `QRCodeDisplay` component (`src/components/QRCodeDisplay.tsx`)

**Dev Tooling:**
- `husky` v9.1.7 + `lint-staged` v16.2.7 — pre-commit hook runs `eslint --fix --max-warnings 0` on staged `.ts/.tsx` files (`.lintstagedrc.json`, `.husky/`)
- `eslint` v9.39 with `typescript-eslint` v8.48, `eslint-plugin-react-hooks` v7, `eslint-plugin-react-refresh` v0.4, `eslint-plugin-cypress` v6.1 — configured in `eslint.config.js`
- `@stryker-mutator/core` v9.5, `@stryker-mutator/vitest-runner` v9.5, `@stryker-mutator/typescript-checker` v9.5

**No Prettier** — formatting is ESLint-only. No `.prettierrc` or `biome.json` detected.

## Configuration

**Environment:**
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — injected via `.env` locally; Vercel env vars in production; GitHub Secrets in CI
- Template: `.env.example` documents required vars
- Never read `.env` contents directly — see `.env.example` for var names only

**TypeScript:**
- App config: `tsconfig.app.json` — strict mode, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, ES2022 target, `@/` path alias pointing to `src/`
- Node config: `tsconfig.node.json` — for Vite config file itself
- Root: `tsconfig.json` — references both

**Path Alias:**
- `@/` → `./src/` — configured in both `vite.config.ts` (Vite resolve alias) and `tsconfig.app.json` (TypeScript paths)

**Build Output:**
- `dist/` — Vite production build output (SPA static assets)
- Build command: `tsc -b && vite build`

## Platform Requirements

**Development:**
- Node.js (22 recommended for CI parity)
- npm for dependency management
- `.env` with Supabase credentials

**Production:**
- Vercel — static hosting for the SPA (`dist/`)
- Supabase — fully managed Postgres + Realtime + PostgREST
- No server process required; all backend logic lives in Supabase RPC/RLS

## CI/CD

**Pipelines (`.github/workflows/`):**
- `ci.yml` — runs on push/PR to `main`: lint → type-check → unit tests with coverage
- `cypress.yml` — runs on push/PR to `main`: Cypress E2E against live Vite dev server; requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` secrets
- `mutation.yml` — runs on PRs to `main` only: Stryker mutation run, uploads HTML report as artifact

---

*Stack analysis: 2026-06-27*
