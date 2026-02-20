# Stack Research

**Domain:** Real-time event management web app (MTG Commander pod pairing)
**Researched:** 2026-02-20
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.2.4 | UI framework | Current stable. React 19 includes use() hook for async data, improved Suspense, and better concurrent features. No SSR/RSC needed for this SPA. |
| Vite | ^7.3.1 | Build tool + dev server | Standard for React SPAs in 2026. Sub-second HMR, native ESM, built-in TypeScript support. Requires Node.js 20.19+ or 22.12+. |
| TypeScript | ^5.9.3 | Type safety | Current stable. TS 6.0 is in beta (Feb 2026) -- do not use beta for production. 5.9 is mature and well-supported. |
| Supabase JS | ^2.95.2 | Backend-as-a-service client | Provides Postgres database, Realtime subscriptions (Postgres Changes, Broadcast, Presence), and Row Level Security. No need for a custom backend. |
| Tailwind CSS | ^4.2.0 | Utility-first CSS | v4 is a ground-up rewrite: 5x faster full builds, CSS-first config via @theme directive (no tailwind.config.js needed), automatic content detection. |
| @tailwindcss/vite | ^4.2.0 | Tailwind Vite integration | First-party Vite plugin. Replaces the old PostCSS plugin approach. Zero config -- just add to vite.config.ts and `@import "tailwindcss"` in CSS. |

### Database & Backend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase (hosted) | Latest | Postgres + Realtime + Auth infrastructure | Managed Postgres with built-in Realtime via WebSockets. Free tier supports up to 500 concurrent connections. Perfect for this scale (8-16 players per event). |
| Supabase Realtime | (bundled) | Live updates for pod assignments, player joins/drops, timer state | Postgres Changes subscription pattern: `supabase.channel().on('postgres_changes', {...}).subscribe()`. Supports INSERT/UPDATE/DELETE filtering by table and column values. |

### Routing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React Router | ^7.13.0 | Client-side routing | v7 in Library Mode (not Framework Mode). Use `createBrowserRouter` + `RouterProvider` for SPA routing. Import everything from `react-router` -- `react-router-dom` package is no longer needed in v7. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrcode.react | ^4.2.0 | QR code generation | Renders QR codes as SVG or Canvas. Peer deps include React 19. Use for event join links displayed on the event info bar. |
| bcryptjs | ^3.0.3 | Client-side passphrase hashing | Pure JS bcrypt implementation that works in browsers. Use to hash admin passphrases before storing in Supabase, and to compare input against stored hash. Max input: 72 bytes. |
| sonner | ^2.x | Toast notifications | 2-3KB, no hooks required, works from anywhere. Use for "Player joined", "Round generated", error messages, and copy-to-clipboard confirmations. |
| lucide-react | ^0.575.0 | Icons | Tree-shakeable SVG icons. Each icon imported individually -- only used icons in bundle. Use for UI chrome: timer, copy, QR expand, admin controls. |

### Testing Stack

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Vitest | ^4.0.18 | Test runner | Native Vite integration -- shares your vite.config.ts, no separate config. Jest-compatible API. Fastest option for Vite projects. |
| @testing-library/react | ^16.3.2 | Component testing | User-centric testing: queries by role, text, label. Requires @testing-library/dom as peer dep. |
| @testing-library/dom | ^10.x | DOM testing utilities | Required peer dependency for @testing-library/react v16+. |
| @testing-library/jest-dom | ^6.9.1 | DOM assertion matchers | Provides `.toBeInTheDocument()`, `.toHaveTextContent()`, etc. Import `@testing-library/jest-dom/vitest` in setup file for Vitest compatibility. |
| @testing-library/user-event | ^14.6.1 | User interaction simulation | Simulates real user events (click, type, tab). Prefer over `fireEvent` for realistic behavior. |
| jsdom | latest | Browser environment simulation | Use as Vitest environment (`environment: 'jsdom'`). More complete browser API than happy-dom. Choose jsdom over happy-dom because this project uses Notifications API and other browser APIs that happy-dom may not support. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Use flat config (eslint.config.mjs). Include: @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh. Vite template includes a working config. |
| Prettier | Code formatting | Pair with eslint-config-prettier to avoid conflicts. Use .prettierrc for consistency. |
| typescript-eslint | TS-aware linting | Provides type-checked rules. Use `tseslint.configs.recommended` for sensible defaults. |

## Installation

```bash
# Scaffold project
npm create vite@latest pod-pairer -- --template react-swc-ts

# Core dependencies
npm install react react-dom @supabase/supabase-js react-router qrcode.react bcryptjs sonner lucide-react

# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Dev dependencies -- testing
npm install -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom

# Dev dependencies -- types
npm install -D @types/bcryptjs

# Dev dependencies -- linting (included by Vite template, verify versions)
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

## Key Configuration

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

### src/test/setup.ts

```typescript
import '@testing-library/jest-dom/vitest'
```

### src/app.css (Tailwind v4 -- no config file needed)

```css
@import "tailwindcss";

@theme {
  --color-pod-1: #3b82f6;
  --color-pod-2: #10b981;
  --color-pod-3: #f59e0b;
  --color-pod-4: #ef4444;
  --color-timer-warning: #f59e0b;
  --color-timer-danger: #ef4444;
}
```

### tsconfig.json additions

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React Router (Library Mode) | TanStack Router | If you want file-based routing or type-safe route params. Overkill for this project's simple URL structure (/event/:id). |
| bcryptjs | Web Crypto PBKDF2 | Never for password hashing. PBKDF2 via SubtleCrypto is not suitable -- it lacks bcrypt/scrypt's resistance to GPU/ASIC attacks. |
| bcryptjs | Supabase Edge Function | If you want server-side hashing. Adds complexity (Edge Function deployment) for a casual app where client-side hashing of a shared passphrase is acceptable. |
| Sonner | React Hot Toast | If you prefer a different API style. Sonner is smaller (2-3KB) and doesn't require hooks. Both are fine choices. |
| jsdom | happy-dom | If test speed is critical and you don't use advanced browser APIs. happy-dom is faster but less complete. This project needs Notification API mocking, favoring jsdom. |
| Vitest | Jest | Never for a Vite project. Jest requires separate config, slower startup, no native ESM. Vitest shares Vite's config and transform pipeline. |
| qrcode.react | react-qr-code | Either works. qrcode.react has explicit React 19 peer dep support (v4.2.0), wider adoption (1188+ dependents), and renders both SVG and Canvas. |
| Zustand | React Context + useReducer | For this project, React Context is likely sufficient. Zustand only needed if state management becomes complex. Start with Context, add Zustand if pain emerges. |
| Lucide React | Heroicons, React Icons | Heroicons if using Tailwind UI. React Icons bundles everything (large). Lucide is tree-shakeable and actively maintained. |
| Tailwind CSS v4 | Tailwind CSS v3 | Never. v3 is legacy. v4 is faster, simpler config, and the only actively developed version. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Next.js | This is a pure client-side SPA with no SSR/SSG needs. Next.js adds server complexity, deployment constraints, and unnecessary abstraction for a Supabase-backed SPA. | Vite + React + React Router |
| Redux / Redux Toolkit | Massive overkill for this project's state needs. Event data lives in Supabase; local state is minimal (current view, admin auth status, timer display). | React Context + useState, or Zustand if needed |
| Supabase Auth | The spec explicitly requires no user accounts. Supabase Auth is for user registration/login flows. This project uses per-event passphrases, not user auth. | bcryptjs for client-side passphrase hash comparison |
| Firebase / Firestore | Supabase is prescribed. Firebase lacks Postgres, RLS, and the SQL-based data model defined in the spec. | Supabase |
| Create React App (CRA) | Deprecated and unmaintained since 2023. | Vite |
| CSS Modules / styled-components | Tailwind CSS is prescribed. Adding a second styling system creates confusion. | Tailwind CSS v4 |
| Moment.js | Deprecated. For timer countdown display (mm:ss), raw Date arithmetic or a tiny helper function is sufficient. No date library needed. | Native Date/Math for mm:ss countdown |
| Socket.IO | Supabase Realtime uses WebSockets internally. Adding Socket.IO creates a parallel real-time system with no benefit. | Supabase Realtime (Postgres Changes) |
| TypeScript 6.0 beta | Currently in beta (announced Feb 11, 2026). Not stable. TS 7.0 (Go-based rewrite) is the future, but 5.9 is the correct production choice today. | TypeScript 5.9.3 |

## Stack Patterns

**Passphrase verification pattern (client-side):**
- On event creation: hash passphrase with `bcryptjs.hash(passphrase, 10)`, store hash in `events.admin_passphrase_hash`
- On admin action: prompt for passphrase, compare with `bcryptjs.compare(input, storedHash)`
- On success: store verification flag in `sessionStorage` (per-event key) so user isn't re-prompted
- Security note: This is a casual shared passphrase for a game night app, not a bank. Client-side hashing is appropriate for this threat model.

**Realtime subscription pattern:**
- Subscribe to Postgres Changes on mount via `useEffect`
- Filter by `event_id` column to scope updates to current event
- Unsubscribe in cleanup: `supabase.removeChannel(channel)`
- Tables to watch: `players` (joins/drops), `rounds` (new rounds), `pods` + `pod_players` (assignments), `events` (timer state changes)

**Timer pattern (no library needed):**
- Store `timer_duration`, `timer_started_at`, `timer_paused_remaining` in `events` table
- Client calculates remaining time: `duration - (now - started_at)` or uses `paused_remaining` when paused
- Update display every second with `setInterval` in `useEffect`
- Color thresholds: normal (> 10min), warning (5-10min), danger (< 5min), expired (0:00)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Vite 7.3.x | Node.js 20.19+ or 22.12+ | Node 18 dropped. Ensure CI uses Node 20 or 22. |
| React 19.2.x | @testing-library/react 16.x | RTL 16 requires React 18+, works with 19. |
| qrcode.react 4.2.0 | React 16.8 - 19.x | Explicit React 19 peer dep added in 4.2.0. |
| Tailwind CSS 4.2.x | Vite 7.x via @tailwindcss/vite | No PostCSS plugin needed. Direct Vite plugin. |
| Vitest 4.0.x | Vite 7.x | Vitest 4 designed for Vite 7. Same config file. |
| TypeScript 5.9.x | All above packages | Stable, well-tested. Do not use 6.0 beta. |
| @supabase/supabase-js 2.95.x | React 19, Vite 7 | Framework-agnostic. No peer dep conflicts. |
| bcryptjs 3.0.x | Browser + Node | Pure JS, no native deps. Works in Vite bundle. |

## Sources

- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) -- verified Node.js requirements, version 7.3.1 current (HIGH confidence)
- [Vite releases](https://vite.dev/releases) -- version history (HIGH confidence)
- [React versions](https://react.dev/versions) -- React 19.2.4 current stable (HIGH confidence)
- [Supabase JS releases](https://github.com/supabase/supabase-js/releases) -- v2.95.2 current (HIGH confidence)
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) -- subscription API patterns (HIGH confidence)
- [Tailwind CSS v4.0 blog](https://tailwindcss.com/blog/tailwindcss-v4) -- v4 architecture, CSS-first config (HIGH confidence)
- [Tailwind CSS v4 Vite installation](https://tailwindcss.com/docs) -- @tailwindcss/vite plugin setup (HIGH confidence)
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.0.18 current (HIGH confidence)
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) -- Vite 7 compatibility (HIGH confidence)
- [React Router npm](https://www.npmjs.com/package/react-router) -- v7.13.0, Library Mode docs (HIGH confidence)
- [React Router modes](https://reactrouter.com/start/modes) -- Library Mode vs Framework Mode (HIGH confidence)
- [qrcode.react npm](https://www.npmjs.com/package/qrcode.react) -- v4.2.0, React 19 peer dep (HIGH confidence)
- [qrcode.react React 19 support](https://github.com/zpao/qrcode.react/compare/v4.1.0...v4.2.0) -- peer dep change confirmed (HIGH confidence)
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs) -- v3.0.3, browser support (HIGH confidence)
- [Web Crypto API limitations for password hashing](https://gist.github.com/chrisveness/770ee96945ec12ac84f134bf538d89fb) -- PBKDF2 not suitable vs bcrypt/scrypt (MEDIUM confidence)
- [TypeScript npm](https://www.npmjs.com/package/typescript) -- 5.9.3 stable, 6.0 beta (HIGH confidence)
- [TypeScript 6.0 Beta announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-beta/) -- not production-ready (HIGH confidence)
- [@testing-library/react npm](https://www.npmjs.com/package/@testing-library/react) -- v16.3.2 (HIGH confidence)
- [@testing-library/jest-dom npm](https://www.npmjs.com/package/@testing-library/jest-dom) -- v6.9.1, Vitest integration (HIGH confidence)
- [@testing-library/user-event npm](https://www.npmjs.com/package/@testing-library/user-event) -- v14.6.1 (HIGH confidence)
- [jsdom vs happy-dom discussion](https://github.com/vitest-dev/vitest/discussions/1607) -- completeness vs speed tradeoff (MEDIUM confidence)
- [Sonner npm](https://www.npmjs.com/package/sonner) -- toast library, 2-3KB (MEDIUM confidence)
- [Lucide React npm](https://www.npmjs.com/package/lucide-react) -- v0.575.0, tree-shakeable (HIGH confidence)
- [ESLint flat config](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) -- flat config standard in 2026 (HIGH confidence)

---
*Stack research for: Commander Pod Pairer -- real-time event management SPA*
*Researched: 2026-02-20*
