# Deferred Items — Phase 02.1

## Visual Regression Baseline Staleness

**Discovered during:** 02.1-03 Task 2 (full regression suite run)
**Scope:** Pre-existing issue, not caused by Phase 2.1 changes

The visual regression baselines for "Event Page (admin view)" are stale after Phase 2 UI changes. The 3 failing tests are:

1. `matches baseline at mobile (375x812)` — threshold 0.30 vs limit 0.05
2. `matches baseline at tablet (768x1024)` — threshold 0.26 vs limit 0.05
3. `matches baseline at desktop (1280x800)` — threshold 0.23 vs limit 0.05

**Fix:** Update visual regression baselines by running:
```bash
npx cypress run --headless --spec cypress/e2e/visual-regression.cy.js --env updateSnapshots=true
```
**Note:** Verify the new snapshots visually before committing to ensure the admin view looks correct.
