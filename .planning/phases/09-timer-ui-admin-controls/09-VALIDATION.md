---
phase: 9
slug: timer-ui-admin-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (component + hook unit/integration) + Stryker (mutation); Cypress (E2E). SQL has no runner. |
| **Config file** | `vitest.config.ts`, `stryker.config.mjs`, `cypress.config.js` |
| **Quick run command** | `npx vitest run src/components/TimerDisplay.test.tsx src/components/TimerControls.test.tsx src/components/AdminControls.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **E2E command** | `npx cypress run --spec cypress/e2e/timer*.cy.js` |
| **Estimated runtime** | ~12s unit; E2E per-spec ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched component/hook
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full unit suite green + relevant Cypress timer specs green + Stryker (where the plan targets it) at the project bar
- **Max feedback latency:** ~15s (unit); E2E run on wave close

---

## Per-Task Verification Map

> Anchor rows; the planner fills exact task IDs. Phase 9 = TIMER-01/02/04/07 + TEST-05.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-xx | — | 1 | TIMER-02 | T-09 | migration 00006: `pending` status + `start_timer` RPC (passphrase-gated, bounded) | source grep | grep gate in plan (CHECK + start_timer + passphrase) | ✅ | ⬜ pending |
| 09-xx | — | 1 | TIMER-02 | T-09 | migration applied to live DB | cli | `supabase db push --linked` | ✅ | ⬜ pending |
| 09-xx | — | 1 | TIMER-02 | — | start_timer flips pending→running, sets expires_at | manual (Wave 0) | human-verify on pushed DB | n/a | ⬜ pending |
| 09-xx | — | 2 | TIMER-01, TIMER-02 | T-09 | 80+20 preset + Start Timer button + useStartTimer | unit | `npx vitest run src/components/AdminControls.test.tsx` | ✅ | ⬜ pending |
| 09-xx | — | 2 | TIMER-04 | — | phase-band styling keyed off useCountdown().phase + not-started card | unit | `npx vitest run src/components/TimerDisplay.test.tsx` | ✅ | ⬜ pending |
| 09-xx | — | 2 | TIMER-07 | — | pause/resume/+5/cancel + pending Start across all phases | unit | `npx vitest run src/components/TimerControls.test.tsx` | ✅ | ⬜ pending |
| 09-xx | — | 3 | TEST-05 | — | E2E: select 80+20, Start, observe main→overtime→count-up | e2e | `npx cypress run --spec cypress/e2e/timer*.cy.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Decide the SQL/RPC verification approach for migration `00006` (new `pending` status + `start_timer` RPC).** Same gap as Phase 8 — no SQL test harness; `supabase.rpc` is mocked in hook tests. Default: documented manual checkpoint on the pushed DB (mirror Phase 8 option c) — apply migration, confirm `generate_round` inserts `pending` for 80+20, `start_timer` flips to `running` + sets `expires_at`, and passphrase gating holds.
- [ ] Component/hook behavior (TIMER-01/04/07 + the `useStartTimer`/`useCountdown` not-started branch) is fully automatable with existing Vitest infra — no framework install needed.
- [ ] Cypress E2E for the 80+20 flow uses the existing timer spec patterns (intercept or real-Supabase per existing convention) — no new E2E framework.

*Hook/component behavior is automatable; the gap is SQL-only (the new RPC + status).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration `00006` applies; `generate_round` inserts `status='pending'` for 80+20; plain timers stay `running` | TIMER-02 | No SQL test runner in repo | Apply migration to scratch/linked DB; generate a round with `p_overtime_minutes=20`; assert the row is `pending` with the duration; generate a plain round; assert `running` |
| `start_timer` flips `pending → running` and sets `expires_at = now() + duration`; passphrase-gated | TIMER-02 | RPC behavior needs live DB | Call `start_timer` with valid passphrase → status `running`, `expires_at` set; with invalid passphrase → RAISE |

*Client behaviors all have automated Vitest/Cypress verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 manual checkpoint (SQL → live-DB checkpoint)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the SQL verification decision
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
