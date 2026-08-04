---
status: awaiting_human_verify
trigger: "Visual regression tests fail in GitHub Actions CI — investigate why and whether to keep them"
created: 2026-03-01T00:00:00Z
updated: 2026-03-02T17:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Visual regression tests fail in CI due to Retina DPR mismatch AND are not worth keeping for this project
test: Compared baseline image dimensions (2x Retina) against CI actual dimensions (1x), analyzed CI error logs, assessed test value for a functional utility app
expecting: Evidence that (1) DPR mismatch is root cause, (2) tests provide negligible value vs maintenance cost
next_action: Awaiting human confirmation to commit and push for CI verification

## Symptoms

expected: Visual regression tests pass in CI (GitHub Actions)
actual: All 15 visual regression tests fail in CI with 75-80% diff percentages. All other E2E tests (77 tests across 13 spec files) pass.
errors: "The 'landing-mobile' image is different. Threshold limit of '0.05' exceeded: '0.80'" (and similar for all 15 tests)
reproduction: Push to GitHub and check Actions results — every single CI run in the repo's history has failed due to visual-regression.cy.js
started: Since visual regression tests were first added. They have NEVER passed in CI.

## Eliminated

- hypothesis: Stale baselines from v2.0 -> v3.0 UI changes cause CI failures
  evidence: Baselines were regenerated locally and pass locally (10/10 runs), but CI still fails ALL 15 tests including landing page (which was unaffected by v3.0 changes). The CI diff percentages are 75-80%, not the 6-33% diffs from stale baselines.
  timestamp: 2026-03-02T17:00:00Z

## Evidence

- timestamp: 2026-03-01T00:00:30Z
  checked: Ran full visual regression spec locally
  found: 3 passing (all landing page), 12 failing (all event page views). Diff percentages - event-page: 0.27/0.18/0.14, event-empty: 0.19/0.09/0.06, event-join-form: 0.33/0.28/0.24, event-admin: 0.25/0.17/0.13
  implication: Only event page views are affected locally. Landing page baselines are still valid.

- timestamp: 2026-03-01T00:01:00Z
  checked: Visual comparison of diff, baseline, and actual screenshots for event-page-desktop
  found: Old baseline shows title+status+player list+Leave button+Share section with always-visible QR at bottom. New actual shows title+status+EventInfoBar (Players:2, No rounds yet, Show QR Code toggle, URL+Copy)+player list+Leave button. The layout has been restructured with Share/QR moved to a collapsible info bar at top.
  implication: Confirms root cause is v3.0 EventInfoBar refactoring that restructured event page layout. Baselines need regeneration.

- timestamp: 2026-03-01T00:01:30Z
  checked: Regenerated baselines per group with .only and verified 10x stability each
  found: event-page (with players) 10/10, event-empty 10/10, event-join-form 10/10, event-admin 10/10 - all individual groups pass perfectly.
  implication: Each group independently stable after baseline regeneration.

- timestamp: 2026-03-01T00:02:00Z
  checked: Full spec (all 15 tests) run 10 times in regression mode
  found: 15/15 passing, 10/10 runs, zero failures. No flakiness detected.
  implication: Fix is stable and complete locally.

- timestamp: 2026-03-02T17:00:00Z
  checked: Baseline image dimensions vs CI actual image dimensions
  found: |
    Baselines captured on macOS (Retina 2x DPR):
    - landing-desktop.png: 2560x1440 (viewport 1280x800 * 2)
    - landing-mobile.png: 750x1440 (viewport 375x812 * 2)
    - landing-tablet.png: 1536x1440 (viewport 768x1024 * 2)
    CI actual images (Ubuntu 1x DPR, from artifact metadata):
    - event-page-desktop.png: 1280x720 (1x, no Retina)
    - event-empty-mobile.png: 375x720 (1x, no Retina)
    - event-admin-tablet.png: 768x968 (1x, no Retina)
    The images are fundamentally different dimensions. A 2560px-wide baseline compared to a 1280px-wide actual produces ~75-80% pixel mismatch.
  implication: ROOT CAUSE for CI failures. macOS Retina (DPR 2) produces 2x resolution screenshots. Ubuntu CI (DPR 1) produces 1x resolution screenshots. cypress-visual-regression does pixel comparison, and these images are completely different sizes.

- timestamp: 2026-03-02T17:00:00Z
  checked: GitHub Actions CI run history (gh run list --workflow cypress.yml)
  found: |
    Every single CI run has failed:
    - 22583258914 (Mar 2): failure — 15 visual regression tests fail, 77 others pass
    - 22582945028 (Mar 2): failure — same pattern
    - 22550626025 (Mar 1): failure — same pattern
    - 22549885168 (Mar 1): failure — same pattern
    - 22413036132 (Feb 25): failure — same pattern
    - 22357787677 (Feb 24): failure — same pattern
    - 22318634092 (Feb 23): failure — same pattern
    Visual regression tests have NEVER passed in CI since they were added.
  implication: This is not a new regression. The CI environment was never compatible with locally-generated baselines.

- timestamp: 2026-03-02T17:00:00Z
  checked: CI error messages from run 22583258914 (most recent)
  found: |
    All 15 tests fail with 75-80% diff:
    - landing-mobile: threshold 0.05 exceeded at 0.80
    - landing-tablet: 0.77
    - landing-desktop: 0.76
    - event-page-mobile: 0.75
    - event-page-tablet: 0.76
    - event-page-desktop: 0.75
    - event-empty-mobile: 0.75
    - event-empty-tablet: 0.75
    - event-empty-desktop: 0.75
    - event-join-form-mobile: 0.77
    - event-join-form-tablet: 0.76
    - event-join-form-desktop: 0.76
    - event-admin-mobile: 0.78
    - event-admin-tablet: 0.77
    - event-admin-desktop: 0.76
  implication: 75-80% diff = fundamentally different images (DPR mismatch), not subtle rendering differences. Even setting threshold to 100% would defeat the purpose.

- timestamp: 2026-03-02T17:00:00Z
  checked: Value assessment of visual regression tests for PodForge
  found: |
    PROJECT NATURE:
    - PodForge is a functional utility app: pod assignment tool for game events
    - Two pages: landing page (create/join event) and event page (player management, round generation, timers)
    - Uses Tailwind CSS with a dark theme — standard utility styling, not custom design-heavy UI
    - The value proposition is functionality (assign players to pods correctly), not pixel-perfect design

    EXISTING TEST COVERAGE:
    - 830 unit tests across 49 files (comprehensive)
    - 77 functional E2E tests across 13 spec files covering all user flows
    - These tests verify actual behavior: event creation, player joining, pod generation, timer controls, admin actions, etc.

    WHAT VISUAL REGRESSION TESTS ACTUALLY CHECK:
    - "Does the page look the same as last time?" at 3 breakpoints for 5 views
    - They don't test any functionality — just pixel appearance
    - With Tailwind CSS, visual changes come from class changes which are obvious in code review

    MAINTENANCE BURDEN:
    - Must regenerate baselines for ANY intentional UI change
    - Cross-platform DPR mismatch makes CI fundamentally incompatible without Docker or CI-generated baselines
    - Fixing for CI would require either: (a) generating baselines in CI and committing back, (b) running local Cypress in a Docker container matching CI, or (c) using a cloud service like Percy/Chromatic ($$$)
    - 15 PNG baselines add ~2.8MB to the repo (binary files in git)
    - Every CI run has been red since inception, creating alert fatigue

    BUGS THESE TESTS WOULD CATCH:
    - Accidental CSS class removal/typo — but functional E2E tests already catch layout-breaking issues via data-testid visibility assertions
    - Font loading failures — the waitForFonts() helper itself shows this was a pain point during setup
    - Nothing that isn't already covered by functional tests + code review
  implication: Visual regression tests provide near-zero marginal value for this project while imposing significant maintenance cost and making CI perpetually red.

## Resolution

root_cause: |
  TWO issues:
  1. CI FAILURE: Baselines are captured on macOS Retina (2x DPR = 2560px-wide images) but CI runs on Ubuntu (1x DPR = 1280px-wide images). cypress-visual-regression does pixel-by-pixel comparison, so fundamentally different image dimensions produce 75-80% diff — guaranteed failure regardless of threshold.
  2. DESIGN ISSUE: Visual regression tests provide negligible value for PodForge (a functional utility app with standard Tailwind styling, 830 unit tests, and 77 functional E2E tests that already cover all user flows). The maintenance burden (baseline regeneration on every UI change, cross-platform incompatibility, repo bloat) far exceeds any bugs they could catch.

fix: Removed visual regression tests entirely. Changes:
  - Deleted cypress/e2e/visual-regression.cy.js (test spec)
  - Deleted cypress/snapshots/ directory (15 baseline PNGs + actual/diff dirs)
  - Removed cypress-visual-regression from package.json devDependencies
  - Removed compareSnapshot command registration from cypress/support/e2e.js
  - Removed visual regression config from cypress.config.js (screenshotsFolder, all visualRegression* env vars, configureVisualRegression setupNodeEvents)
  - Removed cy:base npm script from package.json
  - Simplified cypress.yml workflow (removed snapshot/diff artifact uploads, kept screenshots + videos)
  - Updated .gitignore (cypress/snapshots/* -> cypress/screenshots/)
  - Ran npm uninstall to clean package-lock.json
verification: |
  Local verification:
  - All 83 remaining E2E tests pass (14 spec files, 0 failures)
  - All 830 unit tests pass (49 test files)
  - Lint passes (0 errors, 3 pre-existing coverage/ warnings)
  - No remaining code references to visual-regression or cypress-visual-regression
  CI verification: pending push to GitHub
files_changed:
  - cypress/e2e/visual-regression.cy.js (deleted)
  - cypress/snapshots/ (deleted - 15 baseline PNGs)
  - cypress.config.js (removed visual regression config)
  - cypress/support/e2e.js (removed compareSnapshot import)
  - package.json (removed dependency and cy:base script)
  - package-lock.json (removed cypress-visual-regression)
  - .github/workflows/cypress.yml (simplified artifact uploads)
  - .gitignore (updated cypress ignore paths)
