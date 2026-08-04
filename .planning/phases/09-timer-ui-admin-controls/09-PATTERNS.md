# Phase 9: Timer UI & Admin Controls - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 11 (3 new, 8 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/00006_timer_pending.sql` (NEW) | migration | request-response (RPC) | `00004_timer_system.sql` (resume_timer RPC) + `00005_timer_overtime.sql` (generate_round) | exact |
| `src/hooks/useStartTimer.ts` (NEW) | hook | request-response (mutation) | `src/hooks/useResumeTimer.ts` | exact |
| `src/hooks/useStartTimer.test.ts` (NEW) | test | request-response | `src/hooks/useResumeTimer.test.ts` | exact |
| `cypress/e2e/timer-80-20.cy.js` (NEW) | test (E2E) | request-response | `cypress/e2e/timer.cy.js` | exact |
| `src/types/database.ts` (MOD) | model | — | self (RoundTimer type) | self |
| `src/hooks/useTimer.ts` (MOD) | hook | CRUD (query) | self | self |
| `src/hooks/useCountdown.ts` (MOD) | hook | transform (derivation) | self | self |
| `src/components/TimerDisplay.tsx` (MOD) | component | transform (presentational) | self | self |
| `src/components/TimerControls.tsx` (MOD) | component | request-response | self (running/paused branch) | self |
| `src/components/AdminControls.tsx` (MOD) | component | request-response | self (duration picker + generate) | self |
| `src/hooks/useCountdown.test.ts` (MOD) | test | transform | self (extend existing) | self |

---

## Pattern Assignments

### `supabase/migrations/00006_timer_pending.sql` (NEW migration, RPC)

**Analogs:** `supabase/migrations/00004_timer_system.sql` (resume_timer, lines 193-239) for the new RPC; `supabase/migrations/00005_timer_overtime.sql` (generate_round, lines 28-127) for the conditional-status edit.

**(1) CHECK-constraint extension** — original inline CHECK at `00004:13` (`status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'cancelled'))`). The default Postgres name for this inline constraint is `round_timers_status_check` (verify with `\d round_timers` before applying — Pitfall 4):
```sql
ALTER TABLE round_timers DROP CONSTRAINT round_timers_status_check;
ALTER TABLE round_timers ADD CONSTRAINT round_timers_status_check
  CHECK (status IN ('running', 'paused', 'cancelled', 'pending'));
```

**(2) generate_round edits** — copy the whole `00005:28-127` function (CREATE OR REPLACE, identical signature so no DROP/overload concern). Two surgical changes:
- Cancel sweep at `00005:94-95` — add `'pending'` to the IN list:
```sql
-- WAS (00005:94-95):
UPDATE round_timers SET status = 'cancelled'
WHERE event_id = p_event_id AND status IN ('running', 'paused');
-- BECOMES:
WHERE event_id = p_event_id AND status IN ('running', 'paused', 'pending');
```
- INSERT at `00005:97-100` — add a conditional `status` column:
```sql
INSERT INTO round_timers (round_id, event_id, duration_minutes, overtime_seconds, status, expires_at)
VALUES (v_round_id, p_event_id, p_timer_duration_minutes,
        COALESCE(p_overtime_minutes, 0) * 60,
        CASE WHEN COALESCE(p_overtime_minutes, 0) > 0 THEN 'pending' ELSE 'running' END,
        now() + (p_timer_duration_minutes || ' minutes')::INTERVAL);
```
`expires_at` stays NOT NULL (placeholder while pending; the not-started card never reads it). No nullable migration.

**(3) New `start_timer` RPC** — mirror `resume_timer` (`00004:193-239`) exactly: same header block (SECURITY DEFINER, `SET search_path = public, extensions`), same passphrase validation (`00004:207-217`), same `SELECT ... ORDER BY created_at DESC LIMIT 1` + null-guard RAISE pattern. Only the WHERE filter (`status = 'pending'`) and the UPDATE body differ:
```sql
CREATE OR REPLACE FUNCTION start_timer(p_event_id UUID, p_passphrase TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_timer_id UUID;
  v_duration INTEGER;
BEGIN
  -- Validate passphrase (copy 00004:207-217)
  SELECT passphrase_hash INTO v_hash FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF crypt(p_passphrase, v_hash) != v_hash THEN RAISE EXCEPTION 'Invalid passphrase'; END IF;

  -- Find latest pending timer (mirror resume_timer 00004:219-228)
  SELECT id, duration_minutes INTO v_timer_id, v_duration
  FROM round_timers
  WHERE event_id = p_event_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_timer_id IS NULL THEN RAISE EXCEPTION 'No pending timer found'; END IF;

  -- Begin the main countdown (mirror resume_timer UPDATE 00004:231-237)
  UPDATE round_timers
  SET started_at = now(),
      expires_at = now() + (v_duration || ' minutes')::INTERVAL,
      status = 'running'
  WHERE id = v_timer_id;
END;
$$;
```
`overtime_seconds` is untouched. `resume_timer` / `extend_timer` / `cancel_timer` / `pause_timer` need NO change.

---

### `src/hooks/useStartTimer.ts` (NEW hook, mutation)

**Analog:** `src/hooks/useResumeTimer.ts` (entire file, lines 1-33) — exact passphrase-gated mutation shape.

Copy `useResumeTimer` verbatim and change three things: function name, RPC name (`'resume_timer'` → `'start_timer'`), and the generic error string (`'Failed to resume timer'` → `'Failed to start timer'`). The args object (`{ p_event_id: eventId, p_passphrase: passphrase }`), `onSuccess` invalidation (`['timer', eventId]`), and the `error.message.toLowerCase().includes('invalid passphrase')` mapping all stay identical:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface StartTimerParams {
  passphrase: string
}

export function useStartTimer(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ passphrase }: StartTimerParams) => {
      const { error } = await supabase.rpc('start_timer', {
        p_event_id: eventId,
        p_passphrase: passphrase,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', eventId] })
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase()
      if (message.includes('invalid passphrase')) {
        toast.error('Invalid passphrase')
      } else {
        toast.error('Failed to start timer')
      }
    },
  })
}
```

---

### `src/hooks/useStartTimer.test.ts` (NEW test) — **100% Stryker target**

**Analog:** `src/hooks/useResumeTimer.test.ts` (entire file, lines 1-118).

Copy the whole test file and swap `resume_timer` → `start_timer`, `useResumeTimer` → `useStartTimer`, `'Failed to resume timer'` → `'Failed to start timer'`. Reuse the exact `vi.hoisted` mock harness (`mockRpc`, `mockToastSuccess`, `mockToastError`, lines 7-19), the `createWrapper` QueryClient factory (lines 21-27), and the five test cases:
1. calls `rpc('start_timer', { p_event_id, p_passphrase })` (lines 34-49)
2. invalidates `['timer', eventId]` via `invalidateSpy` (lines 51-71)
3. no success toast (lines 73-85)
4. invalid-passphrase → `toast.error('Invalid passphrase')` (lines 87-101)
5. generic failure → `toast.error('Failed to start timer')` (lines 103-117)

---

### `cypress/e2e/timer-80-20.cy.js` (NEW E2E) — TEST-05

**Analog:** `cypress/e2e/timer.cy.js` (lines 1-115 and the overtime pattern at `09-RESEARCH.md:256-263`).

Reuse the `setupTimerPage({ timer, asAdmin })` intercept harness verbatim (`timer.cy.js:26-89`): blocks the Realtime socket, mocks events/players/rounds/pods, and serves `round_timers` via the PostgREST single-object header. Key reuse points:
- **Computed `expires_at` per phase** (`timer.cy.js:95-99` pattern): mount each phase by setting `expires_at` relative to `Date.now()`:
```javascript
// pending / not-started: status 'pending', overtime_seconds 1200
const pendingTimer = { ...base, status: 'pending', overtime_seconds: 1200 }
// overtime: main expired 60s ago, 1200s overtime remaining
const overtimeTimer = { ...base, status: 'running', overtime_seconds: 1200,
  expires_at: new Date(Date.now() - 60 * 1000).toISOString() }
// countup: main + overtime both elapsed
const countupTimer = { ...base, status: 'running', overtime_seconds: 1200,
  expires_at: new Date(Date.now() - (1200 + 60) * 1000).toISOString() }
```
- **Phase assertion via `data-phase`** (added to `timer-display` in TimerDisplay): `cy.getByTestId('timer-display').should('have.attr', 'data-phase', 'overtime')`.
- **Status label assertion**: `cy.getByTestId('timer-status').should('contain', 'OVERTIME' | 'OVERRUN' | 'READY TO START')`.
- **RPC body assertions** via `cy.intercept('POST', '**/rest/v1/rpc/generate_round*')` asserting `p_overtime_minutes === 20`, and `**/rest/v1/rpc/start_timer*` on the `timer-start-btn` click.
- **Selectors**: `data-testid` kebab-case only; no `cy.wait(ms)` — use intercept aliases (CLAUDE.md Cypress standard).
- **Pitfall 3 (RESOLVED)**: existing `timer.cy.js:~104` asserts `'Round Timer'`. LOCKED decision: render the main-phase literal as `ROUND TIMER` (matching the verified UI-SPEC) and UPDATE that E2E assertion to `'ROUND TIMER'` in Plan 09-04 — changing display copy is in-scope for this UI phase. New phases use the `OVERTIME`/`OVERRUN` literals.

---

### `src/types/database.ts` (MOD model)

**Self.** Widen the `RoundTimer.status` union at line 42:
```typescript
// WAS:  status: 'running' | 'paused' | 'cancelled'
status: 'running' | 'paused' | 'cancelled' | 'pending'
```
`overtime_seconds: number` (line 45) is already present. Regenerate manually (no codegen for this project per RESEARCH:230).

---

### `src/hooks/useTimer.ts` (MOD query)

**Self.** Widen the status filter at line 13 so the pending row is fetched (`ORDER BY created_at DESC LIMIT 1` already masks stale rows):
```typescript
// WAS:  .in('status', ['running', 'paused'])
.in('status', ['running', 'paused', 'pending'])
```

---

### `src/hooks/useCountdown.ts` (MOD transform) — **100% Stryker target**

**Self.** Pattern: early-return for the not-started state BEFORE `derivePhase` runs, keeping `derivePhase`'s 3-way logic (lines 43-55) and `phaseUrgency` (lines 58-62) untouched and exhaustive (Pitfall 5).

1. Extend the `phase` union (line 18): `'main' | 'overtime' | 'countup' | 'not-started'`.
2. In the effect (lines 80-107): the existing `if (timer.status === 'running')` tick guard (line 94) already means `pending` never starts a `setInterval` — no change needed there, but add a render-time short-circuit.
3. Before the `derivePhase` call (line 116), short-circuit `status === 'pending'` to a static state — no `setInterval`, static `display` from `duration_minutes`:
```typescript
if (timer.status === 'pending') {
  return {
    remainingSeconds: timer.duration_minutes * 60,
    display: `${timer.duration_minutes}:00`,
    isOvertime: false,
    isPaused: false,
    isCancelled: false,
    urgency: 'normal',
    phase: 'not-started',
  }
}
```
Keep the existing cancelled guard (lines 109-111) above/below as-is. Do NOT route `not-started` through `derivePhase`/`phaseUrgency` (Pitfall 2 + 5).

---

### `src/components/TimerDisplay.tsx` (MOD presentational) — TIMER-04

**Self.** Replace the single `urgencyStyles[countdown.urgency]` lookup (line 30) with a phase-first band map; only `main` falls back to the existing `urgencyStyles` progression (lines 9-14, KEEP — no regression to plain 60/90/120 timers). Source band tokens from `09-UI-SPEC.md:110-117`:
```tsx
const phaseBands = {
  'not-started': 'bg-surface-raised text-text-secondary border-border',
  overtime: 'bg-accent/15 text-accent-bright border-accent',
  countup: 'bg-red-900/50 text-red-300 border-red-500 animate-pulse',
} as const

const band = countdown.phase === 'main'
  ? urgencyStyles[countdown.urgency]          // existing progression, unchanged
  : phaseBands[countdown.phase]
const dimmed = countdown.isPaused ? 'opacity-70' : ''
```
Replace the `statusLabel` ternary (lines 22-26) with a phase-aware version:
```tsx
const statusLabel = countdown.isPaused ? 'PAUSED'
  : countdown.phase === 'not-started' ? 'READY TO START'
  : countdown.phase === 'overtime' ? 'OVERTIME'
  : countdown.phase === 'countup' ? 'OVERRUN'
  : 'ROUND TIMER'   // main — UI-SPEC literal; timer.cy.js:~104 assertion updated to 'ROUND TIMER' in Plan 09-04 (Pitfall 3 RESOLVED)
```
Add `data-phase={countdown.phase}` to the `timer-display` div (line 29-32) — the E2E phase hook (UI-SPEC:108). Apply `${band} ${dimmed}` in the className. Keep the existing `timer-countdown`, `timer-status`, and notification-prompt blocks (lines 33-67) untouched.

---

### `src/components/TimerControls.tsx` (MOD request-response) — TIMER-07

**Self.** The existing `running ? Pause : Resume` branch (lines 92-114) already covers `main`/`overtime`/`countup` (Phase 8 made the RPCs phase-agnostic — no change to pause/resume/+5/cancel). Add a NEW `pending` branch that renders ONLY the Start button. Reuse the established passphrase-guard pattern (`handleResume`, lines 52-58: `if (!passphrase) { onPassphraseNeeded(); return }` then `mutate({ passphrase }, { onError: handlePassphraseRejection })`):
```tsx
const startTimer = useStartTimer(eventId)   // import mirrors useResumeTimer (line 4)

const handleStart = () => {
  if (!passphrase) { onPassphraseNeeded(); return }
  startTimer.mutate({ passphrase }, { onError: handlePassphraseRejection })
}
```
At the top of the returned row, branch on `pending` and render the accent Start button (icon `Play`, already imported line 2). Use the accent primary style from the Generate button (`AdminControls.tsx:223`: `bg-accent ... hover:bg-accent-bright ... min-h-[44px]`), NOT the neutral surface style of pause/resume:
```tsx
if (timer.status === 'pending') {
  return (
    <div className="w-full max-w-lg flex items-center justify-center gap-2 mt-2 mb-4">
      <button
        type="button"
        onClick={handleStart}
        disabled={startTimer.isPending}
        data-testid="timer-start-btn"
        className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        <Play className="w-4 h-4" />
        Start Timer
      </button>
    </div>
  )
}
```
Keep the existing `if (timer.status === 'cancelled') return null` guard (line 34). LOCKED decision (RESEARCH Open Question 2 RESOLVED): the `pending` branch renders BOTH `timer-start-btn` AND `timer-cancel-btn` — an admin who generated a round but isn't ready can cancel the clock. `cancel_timer` is widened to accept `pending` in migration `00006` (Plan 09-01 T1).

---

### `src/components/AdminControls.tsx` (MOD request-response) — TIMER-01

**Self.** Two gaps to close: (a) the picker maps `[60, 90, 120]` (line 183) with no 80+20; (b) `handleGenerateRound` passes only `timerDurationMinutes` (line 110) — `overtimeMinutes` is never threaded though `useGenerateRound` supports it (`useGenerateRound.ts:22,28`).

Replace the lone `selectedDuration: number | null` (line 56) with a preset-object model:
```tsx
const PRESETS = [
  { id: 60, label: '60 min', duration: 60, overtime: 0 },
  { id: 90, label: '90 min', duration: 90, overtime: 0 },
  { id: 120, label: '120 min', duration: 120, overtime: 0 },
  { id: '80-20', label: '80+20', duration: 80, overtime: 20 },
] as const
const [selectedPreset, setSelectedPreset] = useState<(typeof PRESETS)[number] | null>(null)
```
Render the picker by mapping `PRESETS` (replacing the `[60, 90, 120].map` at lines 183-199), reusing the EXACT existing chip className (selected = `bg-accent text-surface border border-accent`; unselected = `bg-surface border border-border ...`, lines 191-195) and `min-h-[36px]`. `data-testid={`timer-duration-${p.id}`}` keeps `timer-duration-60/90/120` stable (existing `generate-round.cy.js` assertions) and adds `timer-duration-80-20` (UI-SPEC:132).

Thread both durations into the mutate call (line 110) — keep the same `onSuccess`/`onError` block (lines 112-124), resetting `setSelectedPreset(null)`:
```tsx
generateRound.mutate(
  { passphrase, podAssignments,
    timerDurationMinutes: selectedPreset?.duration,
    overtimeMinutes: selectedPreset?.overtime ?? 0 },
  { /* existing onSuccess/onError */ },
)
```
Do NOT put a Start button here — Start belongs on the timer card in `TimerControls` (RESEARCH Anti-Pattern; UI-SPEC:139).

---

## Shared Patterns

### Passphrase-gated RPC (server-side)
**Source:** `supabase/migrations/00004_timer_system.sql:207-217` (resume_timer validation block)
**Apply to:** `start_timer` in migration 00006
```sql
SELECT passphrase_hash INTO v_hash FROM events WHERE id = p_event_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
IF crypt(p_passphrase, v_hash) != v_hash THEN RAISE EXCEPTION 'Invalid passphrase'; END IF;
```
SECURITY DEFINER + `SET search_path = public, extensions` header (`00004:197-201`) is mandatory on every timer RPC.

### Mutation error → toast mapping (client)
**Source:** `src/hooks/useResumeTimer.ts:24-31`
**Apply to:** `useStartTimer`
```typescript
onError: (error: Error) => {
  const message = error.message.toLowerCase()
  if (message.includes('invalid passphrase')) toast.error('Invalid passphrase')
  else toast.error('Failed to start timer')
}
```

### Passphrase-rejection UX (component)
**Source:** `src/components/TimerControls.tsx:38-42` + `src/lib/passphrase-error`
**Apply to:** the new Start handler in TimerControls
```tsx
const handlePassphraseRejection = (error: unknown) => {
  if (isInvalidPassphraseError(error)) onPassphraseNeeded(INVALID_PASSPHRASE_RETRY_MESSAGE)
}
// ...and the guard: if (!passphrase) { onPassphraseNeeded(); return }
```

### Vitest mutation-hook test harness
**Source:** `src/hooks/useResumeTimer.test.ts:7-27` (`vi.hoisted` mocks + `createWrapper`)
**Apply to:** `useStartTimer.test.ts`
```typescript
const { mockRpc, mockToastSuccess, mockToastError } = vi.hoisted(() => ({ ... }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mockRpc } }))
vi.mock('sonner', () => ({ toast: { success: mockToastSuccess, error: mockToastError } }))
```

### Cypress intercept harness (E2E)
**Source:** `cypress/e2e/timer.cy.js:26-89` (`setupTimerPage`)
**Apply to:** `timer-80-20.cy.js` and any TIMER-07 overtime/countup extensions to `timer.cy.js`
- Block Realtime socket, mock REST endpoints, serve `round_timers` with `vnd.pgrst.object+json` header.
- Computed `expires_at` relative to `Date.now()` to mount a given phase deterministically (no `cy.wait(ms)`).

---

## No Analog Found

None. Every file has either an exact in-repo analog or is a self-modification.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All 11 files map to existing in-repo patterns. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/hooks/`, `src/components/`, `src/types/`, `src/pages/`, `cypress/e2e/`
**Files scanned:** 12 (3 migrations partial, 6 hooks/components, 1 type, 1 page, 1 cypress spec, 1 hook test)
**Pattern extraction date:** 2026-06-28
**Key constraint:** `useCountdown.ts` and `useStartTimer.ts` are 100%-Stryker targets (CLAUDE.md + TEST-05) — early-return / verbatim-mirror patterns chosen specifically to preserve mutation coverage.
