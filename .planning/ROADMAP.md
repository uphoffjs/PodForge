# Roadmap: Commander Pod Pairer

## Overview

Commander Pod Pairer is a web app for casual MTG Commander playgroups. Players join via QR code, see real-time pod assignments with seat order and round timers, and can self-drop. Admin actions are gated behind a per-event passphrase.

## Milestones

- ✅ **v1.0 Foundation & Player Flow** — Phases 1-1.4 (shipped 2026-02-24) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Complete App** — Phases 2-3 (shipped 2026-02-25) — [archive](milestones/v2.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Foundation & Player Flow (Phases 1-1.4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Foundation and Player Flow (4/5 plans) — completed 2026-02-23
- [x] Phase 1.1: Cypress E2E Tests (2/3 plans) — completed 2026-02-23
- [x] Phase 1.2: Audit Bug Fixes (3/3 plans) — completed 2026-02-23
- [x] Phase 1.3: Missing Coverage + Verification (2/2 plans) — completed 2026-02-23
- [x] Phase 1.4: Sync Unit Tests (1/1 plan) — completed 2026-02-24

</details>

<details>
<summary>✅ v2.0 Complete App (Phases 2-3) — SHIPPED 2026-02-25</summary>

- [x] Phase 2: Pod Generation and Admin Controls (5/5 plans) — completed 2026-02-24
- [x] Phase 2.1: Phase 2 E2E and Integration Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Timer System (3/3 plans) — completed 2026-02-25

</details>

### Phase 4: Event Polish, Testing, and Deployment
**Goal**: Event page shows full info bar with QR code and share link, all critical paths have test coverage, and the app is deployable to Vercel + Supabase
**Depends on**: Phase 3
**Requirements**: EVNT-05, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. Event page displays info bar with event name, expandable QR code, shareable link with copy button, active player count, and current round number
  2. Pod generation algorithm has unit tests covering player counts 4-20 across multiple rounds, including bye rotation edge cases
  3. Integration tests cover major user flows (create event, join, generate round, timer, self-drop)
  4. Deployment instructions exist and the app deploys successfully to Vercel (frontend) + Supabase (backend)
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Event info bar component (EVNT-05)
- [x] 04-02-PLAN.md — Pod algorithm comprehensive test coverage (INFR-04)
- [x] 04-03-PLAN.md — Timer E2E tests and deployment documentation (INFR-05)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Player Flow | v1.0 | 4/5 | Complete | 2026-02-23 |
| 1.1 Cypress E2E Tests | v1.0 | 2/3 | Complete | 2026-02-23 |
| 1.2 Audit Bug Fixes | v1.0 | 3/3 | Complete | 2026-02-23 |
| 1.3 Missing Coverage + Verification | v1.0 | 2/2 | Complete | 2026-02-23 |
| 1.4 Sync Unit Tests | v1.0 | 1/1 | Complete | 2026-02-24 |
| 2. Pod Generation and Admin Controls | v2.0 | 5/5 | Complete | 2026-02-24 |
| 2.1 Phase 2 E2E and Integration Tests | v2.0 | 3/3 | Complete | 2026-02-25 |
| 3. Timer System | v2.0 | 3/3 | Complete | 2026-02-25 |
| 4. Event Polish, Testing, and Deployment | — | 3/3 | Complete | 2026-02-25 |
| 5. Bulletproof CI/CD Pipeline | — | 3/3 | Complete | 2026-02-27 |

### Phase 5: Bulletproof CI/CD Pipeline

**Goal:** Every push and PR is gated by automated quality checks: unit tests with 100% coverage enforcement, lint, type-check, pre-commit hooks, and mutation testing on PRs
**Depends on:** Phase 4
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04, CICD-05
**Success Criteria** (what must be TRUE):
  1. npm run test, test:coverage, and test:mutation scripts exist and work correctly
  2. Vitest coverage thresholds enforce 100% on all four metrics (statements, branches, functions, lines)
  3. Husky pre-commit hook runs lint-staged (ESLint) on all staged TypeScript files
  4. GitHub Actions CI workflow runs lint, type-check, and unit tests with coverage on push to main and PRs
  5. Stryker mutation testing runs as a PR-only CI job with 80% break threshold
  6. All surviving mutants in critical paths are killed; mutation score >= 80%
**Plans:** 3 plans (Wave 1: local tooling, Wave 2: CI workflows)

Plans:
- [x] 05-01-PLAN.md — npm scripts, coverage thresholds, Husky pre-commit hooks (CICD-01, CICD-02) [Wave 1]
- [x] 05-02-PLAN.md — GitHub Actions CI for unit tests, lint, type-check (CICD-03) [Wave 2]
- [x] 05-03-PLAN.md — Stryker mutation testing CI + kill surviving mutants (CICD-04, CICD-05) [Wave 2]
