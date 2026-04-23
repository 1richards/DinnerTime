/**
 * Phase 20 Wave 1: handoff error → HandoffSheet variant discriminator.
 *
 * Maps a thrown error from the /shopping/:id/order flow to one of three
 * discriminated-union variants consumed by HandoffSheet (SHOP-DC-06):
 *
 *   - 'auth'          — status 401 or 403 (user needs to sign in again)
 *   - 'instacart_api' — status 5xx (Instacart side is down; retry-later copy)
 *   - 'network'       — TypeError /network|fetch/i, or any unknown shape
 *                        (default — fail-safe so retry CTA shows)
 *
 * Priority: auth → instacart_api → network. Network catches the common case
 * so a flaky fetch reads as retriable, and unknown shapes default to
 * retriable rather than stranding the user.
 */

export type HandoffErrorVariant = 'network' | 'instacart_api' | 'auth';

export function classifyHandoffError(err: unknown): HandoffErrorVariant {
  // Status-bearing object (fetch Response or structured api-error thrown by
  // the shopping createOrder wrapper). Check auth before instacart_api so
  // an API that bubbles 403 Forbidden doesn't read as a 5xx.
  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as { status: unknown }).status);
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500 && status < 600) return 'instacart_api';
  }

  // Network-style throwable (RN + DOM fetch both surface these).
  if (err instanceof TypeError) return 'network';
  if (err instanceof Error && /network|fetch/i.test(err.message)) {
    return 'network';
  }

  // Fail-safe default: show the retry CTA rather than strand the user.
  return 'network';
}
