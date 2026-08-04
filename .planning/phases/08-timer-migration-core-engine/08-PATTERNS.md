# Phase 8: Timer Migration & Core Engine - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 8 (1 new migration, 1 type, 3 hooks, 3 hook tests)
**Analogs found:** 8 / 8 (every file extends or mirrors a first-party analog already in the repo)

> Engine-only phase (no UI). All work is additive: one SQL migration + two client hooks extended + one mutation hook threaded + types + tests. Every file has a strong same-repo analog; there are **no** no-analog files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/00005_timer_overtime.sql` (NEW) | migration | CRUD (DDL + RPC) | `supabase/migrations/00004_timer_system.sql` | exact (same table, same RPCs being redefined) |
| `src/types/database.ts` (MODIFY) | model/type | n/a (shape) | `src/types/database.ts` `RoundTimer` (self, lines 37-48) | exact (add one field) |
| `src/hooks/useCountdown.ts` (MODIFY) | hook | transform (derive) | `src/hooks/useCountdown.ts` (self — extend `computeRemaining`/`CountdownState`) | exact |
| `src/hooks/useCountdown.test.ts` (MODIFY) | test | transform | `src/hooks/useCountdown.test.ts` (self — `makeTimer` factory + `vi.useFakeTimers`) | exact |
| `src/hooks/useTimerNotification.ts` (MODIFY) | hook | event-driven | `src/hooks/useTimerNotification.ts` (self — replace single-ref dedup with per-boundary `Set`) | exact |
| `src/hooks/useTimerNotification.test.ts` (MODIFY) | test | event-driven | `src/hooks/useTimerNotification.test.ts` (self — `makeCountdown`/`makeExpiredCountdown` + Notification mock) | exact |
| `src/hooks/useGenerateRound.ts` (MODIFY) | hook | request-response (RPC mutation) | `src/hooks/useGenerateRound.ts` (self — mirror `timerDurationMinutes` threading) | exact |
| `src/hooks/useGenerateRound.test.ts` (MODIFY) | test | request-response | `src/hooks/useGenerateRound.test.ts` (self — `mockRpc` + `toHaveBeenCalledWith` assertion) | exact |

---

## Pattern Assignments

### `supabase/migrations/00005_timer_overtime.sql` (NEW — migration, DDL + RPC)

**Analog:** `supabase/migrations/00004_timer_system.sql` (entire file). Sequential numbering confirmed: existing files are `00001`–`00004`, so the new file is `00005`. Follow the section-banner comment style (`-- ===...===`) used throughout `00004`.

Three required edits (CONTEXT LOCKED; RESEARCH Pattern 2 + overload hazard):

**1. Add the column** — additive, backward compatible. Mirror the column-comment style at `00004:15`:
```sql
ALTER TABLE round_timers
  ADD COLUMN overtime_seconds INTEGER NOT NULL DEFAULT 0;  -- 0 = plain timer (today's behavior); 1200 = 80+20
```
No publication/replica change needed — `00004:35,41` already set `REPLICA IDENTITY FULL` + added the table to `supabase_realtime`; a new column rides the existing publication.

**2. Redefine `generate_round` with the overload DROP** (RESEARCH "overload hazard", Pitfall 2). Two prior overloads exist — 3-arg in `00002_rounds_pods_admin.sql:83` and 4-arg in `00004:47`. `CREATE OR REPLACE` keys on name+arg-types, so it would create a *third* overload and PostgREST throws `PGRST203`. Drop both first:
```sql
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb);            -- 00002 overload
DROP FUNCTION IF EXISTS generate_round(uuid, text, jsonb, integer);  -- 00004 overload
```
Then copy the **entire** `00004:47-138` body verbatim, adding `p_overtime_minutes INTEGER DEFAULT 0` as the final parameter and extending the timer INSERT at `00004:110-111`:
```sql
INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, expires_at)
VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
        COALESCE(p_overtime_minutes, 0) * 60,
        now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
```
Preserve verbatim from `00004`: the `SECURITY DEFINER` + `SET search_path = public, extensions` header (`:55-56`), the passphrase block (`:68-78`), and the active-player / round-number logic (`:85-136`). V2/V4 security: do NOT add a new write path or skip `crypt()`.

**3. Redefine `pause_timer` removing the clamp** (the single most important change for TIMER-06). Copy `00004:145-190` verbatim, changing ONLY line `185`:
```sql
-- BEFORE (00004:185 — clamps, destroys signed overtime/count-up position):
remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER),
-- AFTER (signed — preserves position):
remaining_seconds = EXTRACT(EPOCH FROM (v_expires_at - now()))::INTEGER,
```

**Do NOT restate** `resume_timer` (`00004:193-239`), `extend_timer` (`:242-292`), or `cancel_timer` (`:295-336`). RESEARCH Pattern 2 proves they are already correct once `remaining_seconds` is signed — `resume` does `expires_at = now() + (v_remaining * INTERVAL '1 second')` (`:233`) which works for negative `v_remaining`; `extend` paused path adds to signed `remaining_seconds` (`:288`). Restating them only risks regressions and bloats the diff.

> **No SQL test harness exists** (no pgTAP, no `supabase/tests`; `supabase.rpc` is mocked in hook tests). The signed-pause fix, `overtime_seconds` persistence, and overload DROP are NOT machine-verified. Planner must pick a Wave-0 SQL validation option (RESEARCH Validation Architecture → Wave 0).

---

### `src/types/database.ts` (MODIFY — model/type)

**Analog:** the `RoundTimer` type itself (`src/types/database.ts:37-48`). Single additive field; keep the existing `field: type` + inline-comment style.
```typescript
export type RoundTimer = {
  // ...existing fields (lines 38-47)...
  remaining_seconds: number | null   // now SIGNED (negative = into overtime/count-up)
  overtime_seconds: number           // NEW — 0 for plain timers, 1200 for 80+20
  paused_at: string | null
  expires_at: string
  created_at: string
}
```
**Ripple:** this is the type all three test `makeTimer` factories build (`useCountdown.test.ts:6`, `useTimerNotification.test.ts:7`, and the `TimerDisplay.test.tsx` factory). Each factory MUST add `overtime_seconds: 0` or TS won't compile (RESEARCH Wave 0 checklist).

---

### `src/hooks/useCountdown.ts` (MODIFY — hook, transform/derive)

**Analog:** the hook itself. Extend three existing pure functions; keep the `setInterval` tick (`:50-73`) and `formatDisplay` (`:34-44`) untouched.

**Imports** (unchanged, `:1-2`): `useState, useEffect, useRef` from react; `import type { RoundTimer } from '@/types/database'` (path alias `@/`).

**Current `computeRemaining`** (`:19-25`) becomes `mainRemaining` source — its existing two-branch shape (paused → `remaining_seconds ?? 0`; running → `floor((expires_at-now)/1000)`) is reused exactly:
```typescript
const mainRemaining = timer.status === 'paused'
  ? (timer.remaining_seconds ?? 0)
  : Math.floor((new Date(timer.expires_at).getTime() - Date.now()) / 1000)
const overtime = timer.overtime_seconds ?? 0
const overtimeRemaining = mainRemaining + overtime

let phase: 'main' | 'overtime' | 'countup'
let displaySeconds: number
if (mainRemaining > 0) { phase = 'main';     displaySeconds = mainRemaining }
else if (overtimeRemaining > 0) { phase = 'overtime'; displaySeconds = overtimeRemaining }
else { phase = 'countup'; displaySeconds = overtimeRemaining }  // negative → formatDisplay → "+M:SS"
```

**`CountdownState` extension** (`:4-17`): add `phase: 'main' | 'overtime' | 'countup'` as the NEW source of truth. Keep `remainingSeconds = mainRemaining` and `isOvertime = mainRemaining <= 0` for backward compat (`TimerDisplay.tsx:24` + existing tests stay green). **Do NOT widen** the `urgency` union (`:16`) — keep the 4 values; map main → existing `computeUrgency(mainRemaining)` (`:27-32`), overtime → `'danger'`, countup → `'expired'` (RESEARCH Open Question Q1; Phase 9 owns distinct styling).

**Feed `displaySeconds` (not `remainingSeconds`) into `formatDisplay`** for the returned `display`. Keep `formatDisplay` exactly as-is — it already renders `>=0 → "M:SS"` and `<0 → "+M:SS"` (`:34-44`).

**Backward compat:** with `overtime_seconds = 0`, `overtimeRemaining === mainRemaining`, so past-zero goes straight to `countup` and reproduces today's `+M:SS` behavior identically.

---

### `src/hooks/useCountdown.test.ts` (MODIFY — test)

**Analog:** the test file itself. Reuse its scaffolding exactly:
- `makeTimer(overrides)` factory (`:6-20`) — **add `overtime_seconds: 0` to the default object** so it compiles; override per-test (e.g. `overtime_seconds: 1200`).
- `vi.useFakeTimers()` / `vi.useRealTimers()` in `beforeEach`/`afterEach` (`:23-29`).
- `renderHook(() => useCountdown(timer))` + `result.current!.<field>` assertion style (`:32-53`).
- Paused-timer pattern (`:55-67`) for testing signed `remaining_seconds` derivation without ticking.

**New tests** (mirror existing `it(...)` blocks; target Stryker mutants per RESEARCH "Stryker mutation surface"):
- Boundary `mainRemaining > 0`: test at `mainRemaining = 0` w/ `overtime_seconds=1200` → `phase='overtime'`, display `20:00`; at `mainRemaining = 1` → `phase='main'`. Kills `>` ↔ `>=` mutant.
- Boundary `overtimeRemaining > 0`: at exactly 0 → `countup`; at 1 → `overtime`.
- Arithmetic `+`: paused `remaining_seconds = -300`, `overtime_seconds = 1200` → display `15:00` (distinct from the `-` mutant result). Mirror the existing paused/negative test at `:316-321`.
- Backward-compat: `overtime_seconds = 0`, past zero → `+M:SS` countup identical to today.

---

### `src/hooks/useTimerNotification.ts` (MODIFY — hook, event-driven)

**Analog:** the hook itself. Keep the `isSupported`/`permission`/`requestPermission` surface (`:14-39`) and the iOS-PWA `try/catch` around `new Notification(...)` (`:50-58`) — both unchanged. Replace ONLY the dedup mechanism and trigger.

**Replace** the single `lastNotifiedTimerIdRef` string (`:29`) with two refs (RESEARCH Pattern 3):
```typescript
const notifiedRef = useRef<Set<string>>(new Set())   // `${timer.id}:overtime`, `${timer.id}:countup`
const prevPhaseRef = useRef<string | null>(null)
```

**Replace** the `remainingSeconds <= 0 && isOvertime` trigger effect (`:42-62`) with phase-transition detection driven off `countdown.phase`:
```typescript
useEffect(() => {
  if (!countdown || !timer || countdown.isPaused || countdown.isCancelled) return  // keep guards from :43-44
  const phase = countdown.phase
  const prev = prevPhaseRef.current
  prevPhaseRef.current = phase
  if (prev === null) return            // refresh-into-overtime guard (TIMER-06, Pitfall 4) — do NOT fire pre-mount boundary
  if (permission !== 'granted') return // keep the permission gate from :49
  if (prev === 'main' && phase === 'overtime') fireOnce(`${timer.id}:overtime`, 'Overtime started')
  if (prev === 'overtime' && phase === 'countup') fireOnce(`${timer.id}:countup`, 'Round over')
}, [countdown, timer, permission])
```
`fireOnce(key, body)`: `if (notifiedRef.current.has(key)) return; notifiedRef.current.add(key)`, then construct `new Notification(...)` inside the existing `try/catch` (preserve `icon: '/favicon.ico'`, `tag` per boundary). Keying on `${timer.id}:boundary` (not the timer object ref) survives Realtime row replacement.

**Reset effect** (`:65-69`): extend so a new `timer.id` clears BOTH `notifiedRef` (`.clear()`) and `prevPhaseRef`.

**Anti-pattern (do not do):** keep gating on `remaining <= 0`/`remaining === 0` — it can't distinguish overtime from count-up and hits the zero-crossing off-by-one (Pitfall 5).

---

### `src/hooks/useTimerNotification.test.ts` (MODIFY — test, event-driven)

**Analog:** the test file itself. Reuse exactly:
- `makeTimer` (`:7-21`) — add `overtime_seconds: 0` default.
- `makeCountdown` / `makeExpiredCountdown` factories (`:23-43`) — **add a `phase` field** (default `'main'`; expired → `'countup'`).
- Notification mock setup: `Object.defineProperty(window, 'Notification', { value: Object.assign(vi.fn(), { permission, requestPermission }) ...})` (`:52-64`) and `OriginalNotification` restore (`:46, :66-76`).
- `renderHook(({ t, c }) => useTimerNotification(t, c), { initialProps })` + `rerender` for transition tests (`:132-135, :156-165`).
- Assertion idioms: `expect(mockNotificationConstructor).toHaveBeenCalledTimes(n)` / `.not.toHaveBeenCalled()` / `.toHaveBeenCalledWith(...)` (`:140-147, :161, :202`).

**New tests** (RESEARCH Stryker surface a–f): (a) main→overtime rerender fires `overtime` once; (b) overtime→countup fires `countup` once; (c) same-phase rerender fires nothing (mirror `:150-169` dedup test); (d) new `timer.id` resets the `Set` (mirror `:171-189`); (e) mount directly into `countup` (`prevPhaseRef===null`) fires nothing (Pitfall 4); (f) paused → no fire (mirror `:217-234`).

---

### `src/hooks/useGenerateRound.ts` (MODIFY — hook, RPC mutation)

**Analog:** the hook itself. Mirror exactly how `timerDurationMinutes` is threaded (RESEARCH Code Examples):
- Add `overtimeMinutes?: number` to `GenerateRoundParams` (`:11-15`).
- Destructure it in `mutationFn` and pass to the rpc call (`:21-27`), mirroring `p_timer_duration_minutes: timerDurationMinutes ?? null` (`:26`):
```typescript
p_overtime_minutes: overtimeMinutes ?? 0,
```
Keep the rest unchanged: `useMutation` + `supabase.rpc('generate_round', {...})`, `if (error) throw error`, the 5 `invalidateQueries` keys (`:33-37`), and the `onError` message-matching toast block (`:39-52`).

---

### `src/hooks/useGenerateRound.test.ts` (MODIFY — test, RPC mutation)

**Analog:** the test file itself. Reuse:
- `vi.hoisted` mock pattern for `mockRpc`/toast (`:8-20`) and `createWrapper()` with `QueryClientProvider` (`:22-28`).
- The exact `expect(mockRpc).toHaveBeenCalledWith('generate_round', { p_event_id, p_passphrase, p_pod_assignments, p_timer_duration_minutes })` assertion (`:63-68`).

**New tests:** add a case asserting `p_overtime_minutes: 1200/60→20` is forwarded when `overtimeMinutes` is passed, and `p_overtime_minutes: 0` when omitted (mirrors the existing "passes null when not provided" test at `:71-91`). This kills the "default removed" / arg-drop mutant on the new param.

---

## Shared Patterns

### Passphrase-gated SECURITY DEFINER RPC (SQL)
**Source:** `supabase/migrations/00004_timer_system.sql:55-78`
**Apply to:** both redefined RPCs in `00005` (`generate_round`, `pause_timer`)
```sql
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$ ... BEGIN
  SELECT passphrase_hash ... INTO v_hash FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF crypt(p_passphrase, v_hash) != v_hash THEN RAISE EXCEPTION 'Invalid passphrase'; END IF;
```
Must be preserved verbatim (V2 Authentication / V4 Access Control). New params never bypass it.

### Migration file conventions (SQL)
**Source:** `00004_timer_system.sql:1-6, 21-41`
**Apply to:** `00005_timer_overtime.sql`
- Header comment describing the migration; `-- ===...===` section banners.
- Sequential zero-padded filename: next is `00005`.
- Additive DDL (`ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT`) backfills existing rows automatically — no data migration.

### Hook path-alias imports (TS)
**Source:** `useCountdown.ts:1-2`, `useGenerateRound.ts:1-3`
**Apply to:** all hook edits — `import type { RoundTimer } from '@/types/database'`, `import { supabase } from '@/lib/supabase'`, `CountdownState` from `@/hooks/useCountdown`. Use the `@/` alias, never relative `../`.

### Vitest hook-test factory + assertion idiom (TS test)
**Source:** `useCountdown.test.ts:6-20`, `useTimerNotification.test.ts:23-43`, `useGenerateRound.test.ts:8-28`
**Apply to:** all test edits
- `makeTimer(overrides: Partial<RoundTimer> = {})` factory pattern — **every factory adds `overtime_seconds: 0`** to stay type-compatible.
- `renderHook` + `result.current!` non-null assertion; `vi.useFakeTimers` + `act(() => vi.advanceTimersByTime(...))` for tick tests.
- For RPC hooks: `vi.hoisted` + `vi.mock('@/lib/supabase')` + `toHaveBeenCalledWith` arg assertion.

### Coverage / mutation gate (process)
**Source:** `vite.config.ts` (100% statements/branches/functions/lines), `stryker.config.mjs` (`break:80`, `high:90`)
**Apply to:** all new TS branches — every new `if`/boundary needs a covering test or CI fails. Target 100% Stryker on the new timer branches (critical-path rule). Note: Stryker `mutate` globs are `src/**/*.{ts,tsx}` only — **SQL is never mutated**, so `00005` correctness is out of Stryker scope (see Wave 0).

## No Analog Found

None. Every file in this phase extends an existing first-party file or mirrors an established same-repo pattern. The planner does not need to fall back to RESEARCH-only patterns for any file.

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/hooks/`, `src/types/`
**Files scanned:** 9 (00004 migration, migrations listing, useCountdown[.test], useTimerNotification[.test], useGenerateRound[.test], database.ts)
**Pattern extraction date:** 2026-06-27
