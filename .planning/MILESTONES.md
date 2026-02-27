# Milestones

## v1.0 Foundation & Player Flow (Shipped: 2026-02-24)

**Phases completed:** 5 phases, 14 plans, 0 tasks

**Key accomplishments:**
- Full project scaffold: Vite + React 19 + Supabase + Tailwind dark theme with MTG-inspired purple/blue palette
- Real-time event creation and player join flow with QR code sharing and duplicate name prevention
- Supabase Realtime subscriptions for live player updates, self-drop with confirmation dialog
- Cypress E2E test infrastructure with 44 tests across 7 spec files + visual regression baselines
- Production bug fixes: player join race condition, PostgREST mocking, unique testid split
- 226 unit tests (Vitest) + 15 visual regression baselines at 3 breakpoints, 96.15% Stryker mutation score

**Stats:**
- Files modified: 50
- Lines of code: 5,386 TypeScript/CSS
- Tests: 226 unit + 44 E2E + 15 visual baselines
- Timeline: 4 days (2026-02-20 to 2026-02-24)
- Tech debt: 7 items (none blocking)

---


## v2.0 Complete App (Shipped: 2026-02-25)

**Phases completed:** 3 phases (2, 2.1, 3), 11 plans, 22 tasks

**Key accomplishments:**
- Greedy pod generation algorithm with opponent history matrix, fair bye rotation, and 90.6% Stryker mutation score (40 tests)
- Admin controls: passphrase-gated round generation, player remove/reactivate, end event with read-only view
- Server-authoritative round timer with pause/resume/extend/cancel and Supabase Realtime sync across all clients
- Countdown UI with urgency color transitions (yellow <10m, red <5m, flashing at 0:00) and overtime tracking
- Browser notifications at timer expiry with explicit permission flow and graceful iOS PWA fallback
- 75 Cypress E2E tests covering admin flow, pod display, player management, and sit-out fairness integration

**Stats:**
- Files changed: 71
- Lines of code: 10,477 TypeScript/CSS
- Tests: 346 Vitest + 75 Cypress E2E
- Timeline: 2 days (2026-02-24 to 2026-02-25)
- Git range: feat(02-01) → feat(03-03)
- Tech debt: 5 items (none blocking)

---


## v3.0 Event Polish & CI/CD (Shipped: 2026-02-27)

**Phases completed:** 2 phases (4, 5), 6 plans, 11 tasks

**Key accomplishments:**
- EventInfoBar component with expandable QR code, share link with copy, player count, and round number
- Comprehensive pod algorithm test suite covering all player counts 4-20 (115 tests, up from 54)
- Deployment documentation for Vercel + Supabase with verified production build
- Bulletproof CI/CD: GitHub Actions for lint, type-check, and 100% coverage enforcement on every push/PR
- Stryker mutation testing as PR-only CI gate (80% break threshold, 100% score on all 8 critical hooks)
- Husky pre-commit hooks with lint-staged for ESLint auto-fix on staged TypeScript

**Stats:**
- Files changed: 77
- Lines of code: 16,227 TypeScript/CSS
- Tests: 678 Vitest + 75 Cypress E2E
- Timeline: 3 days (2026-02-25 to 2026-02-27)
- Git range: test(04-02) → docs(quick-3)
- Tech debt: 8 items (none blocking)

---

