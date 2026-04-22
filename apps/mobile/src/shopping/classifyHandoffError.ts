/**
 * Phase 20 Wave 0 stub — real implementation lands in 20-01.
 *
 * Maps a thrown error from the /shopping/:id/order flow to one of three
 * discriminated-union variants consumed by HandoffSheet (SHOP-DC-06):
 *
 *   - 'network'       — TypeError with /network|fetch/i, or unknown shape
 *   - 'instacart_api' — status 5xx (502, 500, etc.)
 *   - 'auth'          — status 401 or 403
 *
 * TODO(phase-20-01): ship the real map. Currently returns the 'network'
 * default for everything so the happy-path tests pass and the 5xx/401
 * cases correctly fail red.
 */

export type HandoffErrorVariant = 'network' | 'instacart_api' | 'auth';

export function classifyHandoffError(_err: unknown): HandoffErrorVariant {
  // Stub: always returns the default. Wave 1 implementation splits by
  // error shape (TypeError message match, HTTP status bands).
  return 'network';
}
