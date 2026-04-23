/**
 * Pure network-error classifier (Phase 23-05 / NFR-13).
 *
 * Discriminated-union result lets consumers switch exhaustively and drive
 * user-facing copy from a single source of truth. `classifyWithNetwork` is
 * pure (no Zustand import) for easy unit testing. `classifyNetworkError`
 * wraps it, reading the network store at call time — the production seam.
 *
 * Precedence (highest → lowest):
 *   1. offline      — isOnline=false  OR  TypeError with /network/i message
 *   2. rate_limit   — err.status === 429
 *   3. timeout      — err.status === 408  OR  err.name === 'AbortError'
 *   4. server       — 500 ≤ err.status ≤ 599
 *   5. unknown      — default
 */

import { useNetworkStore } from '../stores/networkStore';

export type NetworkErrorKind =
  | 'offline'
  | 'rate_limit'
  | 'timeout'
  | 'server'
  | 'unknown';

/**
 * Best-effort extraction of an HTTP-style status code from arbitrary error
 * shapes (fetch-thrown Response-like objects, custom error classes with a
 * `.status` field, bare `{ status: number }` records).
 */
function extractStatus(err: unknown): number | null {
  if (err == null || typeof err !== 'object') return null;
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && Number.isFinite(status)) return status;
  return null;
}

function extractName(err: unknown): string | null {
  if (err == null || typeof err !== 'object') return null;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}

function extractMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err !== 'object') return '';
  const msg = (err as { message?: unknown }).message;
  return typeof msg === 'string' ? msg : '';
}

/**
 * Pure classifier — inject `isOnline` for easy testing.
 */
export function classifyWithNetwork(
  err: unknown,
  isOnline: boolean,
): NetworkErrorKind {
  // Offline wins: NetInfo says we're dark, or fetch threw the canonical
  // "Network request failed" error that RN raises on connectivity loss. RN
  // sometimes surfaces this as a plain Error rather than a TypeError, so we
  // match on message heuristic for any Error-shaped input.
  if (!isOnline) return 'offline';
  if (err instanceof Error && /network request failed|network error/i.test(err.message)) {
    return 'offline';
  }

  const status = extractStatus(err);
  if (status === 429) return 'rate_limit';
  if (status === 408) return 'timeout';
  if (extractName(err) === 'AbortError') return 'timeout';
  if (status !== null && status >= 500 && status < 600) return 'server';

  // Fallback — if the message itself says "rate" or similar, still unknown.
  // Callers that want to surface raw messages should read err.message themselves.
  void extractMessage(err);
  return 'unknown';
}

/**
 * Production entry point — wraps `classifyWithNetwork` by reading the
 * current isOnline flag from the NetInfo-backed Zustand store.
 */
export function classifyNetworkError(err: unknown): NetworkErrorKind {
  const isOnline = useNetworkStore.getState().isOnline;
  return classifyWithNetwork(err, isOnline);
}
