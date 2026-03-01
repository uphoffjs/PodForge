---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - cypress.config.js
  - .github/workflows/cypress.yml
autonomous: false
requirements: [QUICK-4]
must_haves:
  truths:
    - "Cypress Cloud receives test recordings from CI"
    - "CI runs E2E tests across 3 parallel containers with auto-balancing"
    - "Visual regression tests run in a separate non-parallel job to avoid baseline mismatch"
    - "All 75 tests still pass end-to-end"
  artifacts:
    - path: "cypress.config.js"
      provides: "Cypress Cloud projectId configuration"
      contains: "projectId"
    - path: ".github/workflows/cypress.yml"
      provides: "Parallel CI workflow with Cypress Cloud recording"
      contains: "matrix"
  key_links:
    - from: "cypress.config.js"
      to: "Cypress Cloud"
      via: "projectId linking local config to cloud project"
      pattern: "projectId:"
    - from: ".github/workflows/cypress.yml"
      to: "Cypress Cloud"
      via: "CYPRESS_RECORD_KEY secret and record: true"
      pattern: "record: true"
---

<objective>
Connect PodForge's Cypress E2E test suite to Cypress Cloud and configure parallel CI runners for faster feedback loops.

Purpose: 14 spec files with 75 tests running on a single CI runner is slow. Cypress Cloud's auto-balancing across parallel containers will cut CI time significantly and provide a dashboard for test analytics, flake detection, and failure debugging.

Output: Updated cypress.config.js with projectId, restructured GitHub Actions workflow with 3 parallel containers for functional tests and a separate sequential job for visual regression tests.
</objective>

<execution_context>
@/Users/jacobstoragepug/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jacobstoragepug/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@cypress.config.js
@.github/workflows/cypress.yml
@cypress/e2e/visual-regression.cy.js

Current state:
- Cypress 15.10.0, 14 spec files, 75 tests
- Single CI runner, no Cloud connection
- Visual regression plugin (cypress-visual-regression) configured with base/diff/actual snapshot dirs
- cypress-io/github-action@v6 in use
- Env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as GitHub secrets
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Create Cypress Cloud project and provide credentials</name>
  <files>N/A</files>
  <action>
User must complete these steps manually (requires browser login to cloud.cypress.io):

1. Go to https://cloud.cypress.io and sign in (or create an account)
2. Create a new project named "PodForge"
3. Copy the **projectId** shown in the setup instructions (looks like "abc123")
4. Copy the **Record Key** shown in the setup instructions (looks like a UUID)
5. In your GitHub repo settings (Settings > Secrets and variables > Actions), add a new repository secret:
   - Name: `CYPRESS_RECORD_KEY`
   - Value: the record key from step 4
6. Provide the projectId to Claude so it can be added to cypress.config.js

Note: Cypress Cloud free tier includes 500 test recordings per month. With 75 tests across 3 parallel containers, each CI run uses ~75 recordings. Budget for ~6-7 full runs per month, or upgrade if needed.
  </action>
  <verify>User confirms they have the projectId and have added CYPRESS_RECORD_KEY to GitHub secrets</verify>
  <done>projectId string provided, CYPRESS_RECORD_KEY secret exists in GitHub repo settings</done>
</task>

<task type="auto">
  <name>Task 2: Configure Cypress Cloud and parallel CI workflow</name>
  <files>cypress.config.js, .github/workflows/cypress.yml</files>
  <action>
**cypress.config.js** -- Add projectId from user:
- Add `projectId: '{USER_PROVIDED_ID}'` as a top-level property inside `defineConfig({...})`, right before the `e2e` key.
- Keep all existing configuration unchanged (baseUrl, specPattern, visual regression, etc.).

**cypress.yml** -- Restructure into two jobs: parallel functional tests + sequential visual regression tests.

Job 1: `cypress-functional` (parallel, recorded)
- `runs-on: ubuntu-24.04`
- `strategy.fail-fast: false`
- `strategy.matrix.containers: [1, 2, 3]` (3 parallel runners)
- Steps:
  1. `actions/checkout@v4`
  2. `cypress-io/github-action@v6` with:
     - `build: npm run build`
     - `start: npm run dev -- --host`
     - `wait-on: 'http://127.0.0.1:5173'`
     - `wait-on-timeout: 60`
     - `record: true`
     - `parallel: true`
     - `group: 'PodForge E2E'`
     - `spec: 'cypress/e2e/**/*.cy.js'` (all specs -- Cloud handles balancing)
     - `config: 'excludeSpecPattern=cypress/e2e/visual-regression.cy.js'` (exclude visual regression from parallel)
  3. env block with `CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}`, `VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}`, `VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}`
  4. Upload screenshots artifact on failure (use `name: cypress-screenshots-${{ matrix.containers }}` to avoid name collisions across parallel runners)
  5. Upload videos artifact on failure (use `name: cypress-videos-${{ matrix.containers }}` to avoid name collisions)

Job 2: `cypress-visual` (sequential, NOT parallel, NOT recorded)
- `runs-on: ubuntu-24.04` (single runner, no matrix)
- No `needs` field (runs independently alongside functional jobs)
- Steps:
  1. `actions/checkout@v4`
  2. `cypress-io/github-action@v6` with:
     - `build: npm run build`
     - `start: npm run dev -- --host`
     - `wait-on: 'http://127.0.0.1:5173'`
     - `wait-on-timeout: 60`
     - `spec: 'cypress/e2e/visual-regression.cy.js'` (ONLY visual regression)
     - NO `record`, NO `parallel` (visual regression baselines must run on consistent environment)
  3. env block with `VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}`, `VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}`
  4. Upload screenshots/diffs/videos artifacts on failure (names: cypress-screenshots-visual, cypress-diffs, cypress-videos-visual)

Why visual regression is separated:
- Visual regression compares pixel snapshots against committed baselines
- Different parallel containers may have subtle rendering differences (font hinting, anti-aliasing)
- Running on a single consistent runner avoids false positive visual diffs
- Not recorded to Cloud since visual diffs are managed via committed baseline images, not Cloud analytics
  </action>
  <verify>
Validate YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cypress.yml'))"`
Validate config syntax: `node -e "import('./cypress.config.js').then(() => console.log('OK'))"`
Confirm projectId present: `grep 'projectId' cypress.config.js`
Confirm parallel matrix: `grep -A2 'matrix' .github/workflows/cypress.yml`
Confirm visual regression excluded from parallel job: `grep 'excludeSpecPattern' .github/workflows/cypress.yml`
Confirm visual regression has its own job: `grep 'cypress-visual' .github/workflows/cypress.yml`
  </verify>
  <done>
cypress.config.js contains projectId. Workflow has two jobs: cypress-functional with 3-container parallel matrix + record:true, and cypress-visual running only visual-regression.cy.js without parallelization. YAML and JS both parse without errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify Cypress Cloud connection and parallel CI run</name>
  <files>N/A</files>
  <action>
Push changes to a feature branch and open a PR against main to trigger CI. Verify:
1. GitHub Actions shows TWO job groups: cypress-functional (1/2/3) running in parallel, and cypress-visual running independently
2. Cypress Cloud dashboard at https://cloud.cypress.io shows the run under "PodForge" project with specs distributed across 3 machines
3. All 75 tests pass across both jobs
4. Visual regression job runs ONLY visual-regression.cy.js
5. Functional jobs do NOT run visual-regression.cy.js
  </action>
  <verify>User confirms CI passes and Cloud dashboard shows recordings</verify>
  <done>All tests pass in parallel CI, Cypress Cloud dashboard receives and displays test recordings with spec distribution</done>
</task>

</tasks>

<verification>
- cypress.config.js has projectId set
- .github/workflows/cypress.yml has two jobs: cypress-functional (parallel, recorded) and cypress-visual (sequential, unrecorded)
- Parallel job uses matrix strategy with 3 containers
- Parallel job excludes visual-regression.cy.js
- Visual job runs ONLY visual-regression.cy.js
- YAML and JS parse without errors
- CI run shows parallel execution in GitHub Actions
- Cypress Cloud dashboard receives recordings
</verification>

<success_criteria>
- All 75 E2E tests pass in CI (split across functional + visual jobs)
- Cypress Cloud dashboard shows test recordings with spec distribution across 3 machines
- Visual regression tests run in isolation on a single runner with no false positive diffs
- CI wall-clock time for functional tests is measurably reduced compared to single-runner baseline
</success_criteria>

<output>
After completion, create `.planning/quick/4-set-up-cypress-cloud-with-parallel-ci-ru/4-SUMMARY.md`
</output>
