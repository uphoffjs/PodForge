---
status: complete
phase: 03-timer-system
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-02-25T18:30:00Z
updated: 2026-02-25T18:50:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Generate Round with Timer Duration
expected: When generating a round as admin, you see three duration preset buttons: 60 min, 90 min, 120 min. Selecting one highlights it; clicking the same one again deselects it (timer is optional). After generating the round with a duration selected, a countdown timer appears on the page.
result: pass

### 2. Timer Countdown Display
expected: Timer is sticky at the top of the page with large, bold numbers in mm:ss format. It counts down every second. The timer remains visible as you scroll down.
result: pass

### 3. Timer Urgency Colors
expected: Timer displays in default color when more than 10 minutes remain. Turns yellow when under 10 minutes. Turns red when under 5 minutes. Flashes with a red pulse animation when it hits 0:00.
result: pass

### 4. Timer Overtime Display
expected: After the timer reaches 0:00, it does not stop. Instead it starts counting UP, displaying overtime in "+m:ss" format (e.g., "+2:30"). The flashing/expired styling continues.
result: pass

### 5. Pause and Resume Timer
expected: Admin clicks Pause — countdown stops and timer shows a paused state. Admin clicks Resume — countdown resumes from where it left off, no time lost or gained.
result: pass

### 6. Extend Timer (+5 Minutes)
expected: Admin clicks the +5 min button. The remaining time immediately increases by 5 minutes. No confirmation dialog is shown. Works while timer is running or paused.
result: pass

### 7. Cancel Timer with Confirmation
expected: Admin clicks Cancel. A confirmation dialog appears (same pattern as End Event). Confirming removes the timer from the page entirely. Dismissing the dialog keeps the timer running.
result: pass

### 8. Real-time Multi-client Sync
expected: Open the event page in two browser windows/tabs. Timer changes made in one (pause, resume, extend, cancel, or initial creation) are reflected in the other within 1-2 seconds. Both clients show the same countdown value (no drift).
result: pass

### 9. Notification Permission Prompt
expected: Near the timer display, a subtle "Enable" prompt or banner appears inviting you to enable notifications. Clicking it triggers the browser's notification permission dialog. After granting, the prompt disappears. If denied, a "Notifications blocked" message appears instead.
result: pass

### 10. Notification at Timer Expiry
expected: With notification permission granted, when the timer reaches zero a browser notification fires with a message about the timer expiring. The notification fires even if the tab is in the background. Only one notification fires per timer expiry (no duplicates).
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
