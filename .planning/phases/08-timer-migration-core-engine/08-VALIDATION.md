---
phase: 8
slug: timer-migration-core-engine
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| 08-01-T1 | 08-01 | 1 | TIMER-03, TIMER-06 | T-08-01/02 | migration: column + overload DROP + signed pause + bounded p_overtime_minutes | source grep | `grep` gate in plan (column/DROP/no-clamp) | ✅ | ⬜ pending |
| 08-01-T2 | 08-01 | 1 | TIMER-06 | T-08-03 | migration applied to live DB (no false-positive type pass) | cli | `supabase db push` | ✅ | ⬜ pending |
| 08-01-T3 | 08-01 | 1 | TIMER-03, TIMER-06 | T-08-01/02 | overtime_seconds 1200/0 persisted; signed pause; single overload; bounds raise | manual (Wave 0 option c) | human-verify on pushed DB | n/a | ⬜ pending |
| 08-02-T1 | 08-02 | 1 | TIMER-03 | — | RoundTimer.overtime_seconds contract; repo type-checks | type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-02-T2 | 08-02 | 1 | TIMER-03 | T-08-04 | useGenerateRound forwards p_overtime_minutes (0 default) | unit | `npx vitest run src/hooks/useGenerateRound.test.ts` | ✅ | ⬜ pending |
| 08-03-T1 | 08-03 | 2 | TIMER-03, TIMER-06 | T-08-05 | three-phase derivation incl. paused/backward-compat | unit | `npx vitest run src/hooks/useCountdown.test.ts` | ✅ | ⬜ pending |
| 08-03-T2 | 08-03 | 2 | TIMER-03 | — | new derivation branches 100% mutation | mutation | `npx stryker run --mutate "src/hooks/useCountdown.ts"` | ✅ | ⬜ pending |
| 08-04-T1 | 08-04 | 3 | TIMER-05 | T-08-07 | one notification per boundary, deduped, refresh-safe | unit | `npx vitest run src/hooks/useTimerNotification.test.ts` | ✅ | ⬜ pending |
| 08-04-T2 | 08-04 | 3 | TIMER-05 | — | notification branches 100% mutation | mutation | `npx stryker run --mutate "src/hooks/useTimerNotification.ts"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] **DECISION (option c): documented manual checkpoint against the live DB.** Rationale: the repo has no pgTAP/SQL runner and `supabase.rpc` is mocked in hook tests, so options (a)/(b) require new infra disproportionate to a 3-edit migration. Because Plan 08-01 already pushes `00005` to the live DB via `supabase db push` (Task 2), the SQL behaviors are verified there by a `checkpoint:human-verify` (Plan 08-01 Task 3): overtime_seconds=1200/0 persistence, signed pause (remaining_seconds<0) + resume position, single generate_round overload (no PGRST203), and the p_overtime_minutes bounds RAISE. This is the research-sanctioned lowest-cost option and is recorded as a Manual-Only Verification below.
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

- [x] All tasks have `<automated>` verify or a Wave 0 manual checkpoint (SQL row → Plan 08-01 Task 3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (SQL verification = Plan 08-01 Task 3 checkpoint)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-27 (planner)
