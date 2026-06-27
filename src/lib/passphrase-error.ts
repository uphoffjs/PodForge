/**
 * Helpers for detecting and surfacing admin passphrase rejections.
 *
 * Admin RPCs (`generate_round`, `end_event`, timer ops, player management)
 * validate the passphrase server-side and reject with a message containing
 * "invalid passphrase". The mutation hooks already translate this into a toast;
 * these helpers let the UI additionally re-open the passphrase modal with inline
 * feedback so the admin can correct a stale/wrong passphrase.
 */

/** Human-readable message shown inline in the passphrase modal on a failed attempt. */
export const INVALID_PASSPHRASE_RETRY_MESSAGE =
  'Invalid passphrase. Please re-enter to continue.'

/**
 * Returns true when an error thrown by an admin mutation was caused by an
 * invalid passphrase. Mirrors the detection used in the mutation hooks.
 */
export function isInvalidPassphraseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('invalid passphrase')
  )
}
