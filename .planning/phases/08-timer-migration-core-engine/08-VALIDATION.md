---
phase: 8
slug: timer-migration-core-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/integration) + Stryker (mutation); SQL has no runner today |
| **Config file** | `vitest.config.ts`, `stryker.config.mjs` |
| **Quick run command** | `npx vitest run src/hooks/useCountdown.test.ts src/hooks/useTimerNotification.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~12 seconds (full unit suite) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched hook(s)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green + `npx stryker run --mutate "src/hooks/useCountdown.ts,src/hooks/useTimerNotification.ts"` at 100%
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Filled by the planner per task. Anchor rows below reflect the known engine surface.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-xx | — | — | TIMER-03 | — | three-phase derivation (main→overtime→count-up) | unit | `npx vitest run src/hooks/useCountdown.test.ts` | ✅ | ⬜ pending |
| 08-xx | — | — | TIMER-05 | — | one notification per boundary, deduped | unit | `npx vitest run src/hooks/useTimerNotification.test.ts` | ✅ | ⬜ pending |
| 08-xx | — | — | TIMER-06 | — | signed remaining preserved across pause/refresh | unit | `npx vitest run src/hooks/useCountdown.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Decide the SQL/RPC verification approach for the migration `00005` changes (signed-pause clamp removal + `generate_round` overload drop).** Per RESEARCH.md there is no SQL test harness today (`supabase.rpc` is mocked in hook tests; Stryker only mutates `src/**`). Pick one before Wave 1:
  - (a) real-Supabase integration test using the currently-unused `cy.createRealEvent()` seed, or
  - (b) pgTAP unit tests on the RPCs, or
  - (c) a documented manual checkpoint (apply migration to a scratch DB, exercise pause-in-overtime then resume).
- [ ] Client-side timer logic is covered by existing Vitest infra — no framework install needed.

*Hook-layer behavior (TIMER-03/05/06 client derivation) is fully automatable with existing Vitest; the gap is SQL-only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration `00005` applies cleanly and `pause_timer` stores signed remaining (no `GREATEST(0,…)` clamp) | TIMER-06 | No SQL test runner in repo (unless Wave 0 picks (a)/(b)) | Apply migration to scratch Supabase; start 80+20 timer; let it enter overtime; pause; assert `remaining_seconds < 0`; resume; assert position restored |
| `generate_round` overload ambiguity removed | TIMER-06 | PostgREST resolves overloads at runtime; not unit-testable without live DB | After migration, call `generate_round` with overtime param; confirm no `PGRST203` error |

*Client hook behaviors all have automated Vitest verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the SQL verification decision)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
