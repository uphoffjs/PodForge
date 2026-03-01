---
phase: quick-4
plan: 01
subsystem: infra
tags: [cypress, cypress-cloud, ci, parallel, github-actions, visual-regression]

# Dependency graph
requires:
  - phase: phase-05
    provides: "CI/CD pipeline with Cypress E2E tests"
provides:
  - "Cypress Cloud projectId configuration (placeholder)"
  - "Parallel CI workflow with 3-container matrix"
  - "Isolated visual regression job"
affects: [ci, e2e-testing]

# Tech tracking
tech-stack:
  added: [cypress-cloud]
  patterns: [parallel-ci-matrix, job-isolation-for-visual-regression]

key-files:
  created: []
  modified:
    - cypress.config.js
    - .github/workflows/cypress.yml

key-decisions:
  - "Used placeholder projectId -- user must replace after creating Cypress Cloud project"
  - "3 parallel containers chosen as balance between speed and free-tier recording budget"
  - "Visual regression tests isolated to single sequential runner to prevent false diffs from rendering variance"
  - "Visual regression tests NOT recorded to Cloud since diffs are managed via committed baselines"

patterns-established:
  - "Job isolation: visual regression runs separately from functional tests to avoid environment-sensitive false positives"
  - "Matrix artifact naming: append matrix index to artifact names to prevent upload collisions"

requirements-completed: [QUICK-4]

# Metrics
duration: 1min
completed: 2026-03-01
---

# Quick Task 4: Set Up Cypress Cloud with Parallel CI Runners Summary

**Parallel CI workflow with 3-container matrix via Cypress Cloud and isolated visual regression job**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-01T18:20:00Z
- **Completed:** 2026-03-01T18:20:47Z
- **Tasks:** 3 (1 handled via placeholder, 1 auto, 1 documented for user verification)
- **Files modified:** 2

## Accomplishments
- Split single monolithic CI job into two specialized jobs: `cypress-functional` (parallel, recorded) and `cypress-visual` (sequential, unrecorded)
- Configured 3-container parallel matrix with Cypress Cloud auto-balancing for functional E2E tests
- Visual regression tests isolated on single consistent runner to prevent false positive pixel diffs
- All artifact uploads use matrix-indexed names to avoid collisions across parallel runners

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Cypress Cloud project and provide credentials** - Handled via placeholder (no commit -- user action required)
2. **Task 2: Configure Cypress Cloud and parallel CI workflow** - `63107f8` (feat)
3. **Task 3: Verify Cypress Cloud connection and parallel CI run** - No commit (user verification step)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `cypress.config.js` - Added Cypress Cloud projectId placeholder with TODO comment
- `.github/workflows/cypress.yml` - Restructured from single job to two jobs: cypress-functional (3-container parallel with recording) and cypress-visual (sequential)

## Decisions Made
- **Placeholder projectId:** Used `'your-project-id'` since user has not yet created a Cypress Cloud project. Must be replaced before CI recording will work.
- **3 parallel containers:** Balances speed improvement against free-tier recording budget (~75 recordings per CI run, ~500/month free = ~6-7 full runs)
- **No `needs` dependency:** `cypress-visual` runs independently alongside `cypress-functional` for maximum parallelism
- **excludeSpecPattern config override:** Used `config:` param in GitHub Action to exclude visual-regression.cy.js from parallel job rather than modifying specPattern

## Deviations from Plan

None - plan executed exactly as written. Task 1 (human-action checkpoint) was handled via placeholder per execution constraints rather than blocking.

## User Setup Required

**IMPORTANT: Manual steps required before Cypress Cloud recording will work.**

The following steps must be completed by the user:

1. **Create Cypress Cloud project:**
   - Go to https://cloud.cypress.io and sign in (or create account)
   - Create a new project named "PodForge"
   - Copy the **projectId** from the setup instructions

2. **Update cypress.config.js:**
   - Replace `'your-project-id'` with the actual projectId from step 1
   - The placeholder is at line 7 of `cypress.config.js`

3. **Add GitHub Actions secret:**
   - In the GitHub repo: Settings > Secrets and variables > Actions
   - Add new repository secret: `CYPRESS_RECORD_KEY`
   - Value: the Record Key from the Cypress Cloud project setup

4. **Verify by pushing to a feature branch:**
   - GitHub Actions should show two job groups: `cypress-functional` (3 parallel) and `cypress-visual` (1 sequential)
   - Cypress Cloud dashboard should show recordings under "PodForge" project

**Free tier note:** 500 recordings/month. With 75 tests x 3 containers, each CI run uses ~75 recordings (~6-7 full runs/month).

## Verification Checklist (for Task 3)

When verifying after Cypress Cloud setup:
- [ ] GitHub Actions shows TWO job groups: cypress-functional (1/2/3) and cypress-visual
- [ ] Cypress Cloud dashboard shows the run under "PodForge" project with specs distributed across 3 machines
- [ ] All 75 tests pass across both jobs
- [ ] Visual regression job runs ONLY visual-regression.cy.js
- [ ] Functional jobs do NOT run visual-regression.cy.js

## Issues Encountered
None

## Next Phase Readiness
- CI workflow is ready for parallel execution once Cypress Cloud credentials are configured
- No code changes needed beyond the placeholder replacement and secret addition

## Self-Check: PASSED

- FOUND: cypress.config.js
- FOUND: .github/workflows/cypress.yml
- FOUND: 4-SUMMARY.md
- FOUND: commit 63107f8

---
*Quick Task: 4-set-up-cypress-cloud-with-parallel-ci-ru*
*Completed: 2026-03-01*
