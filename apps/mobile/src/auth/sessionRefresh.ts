/**
 * sessionRefresh — owns two concerns that are too small to warrant separate
 * files and are referenced together from authedFetch + the app root layout:
 *
 *   1. `attemptSessionRefresh()` — single-flight wrapper around
 *      `supabase.auth.refreshSession()`. Concurrent callers share one in-flight
 *      promise; resolves to { success, accessToken? }.
 *   2. `setReAuthHandler(handler)` / `triggerReAuth()` — module-level registry
 *      used by authedFetch to surface a hard-401 to the root-level ReAuthModal
 *      without importing React. _layout.tsx registers a handler at mount time
 *      that flips a React state; calling triggerReAuth() after refresh
 *      ultimately fails pops the modal.
 *
 * Also re-exports `authedFetch` from ../lib/authedFetch so Wave-0 red stubs
 * that import `authedFetch` from `./sessionRefresh.js` (per 23-00 contract)
 * see the same implementation.
 *
 * Requirement: NFR-08 (silent refresh), NFR-12 (ReAuthModal on hard 401).
 */
import { supabase } from '../lib/supabase';

type RefreshOutcome = { success: boolean; accessToken?: string };

let pendingRefresh: Promise<RefreshOutcome> | null = null;

export async function attemptSessionRefresh(): Promise<RefreshOutcome> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data?.session?.access_token) {
        return { success: false };
      }
      return { success: true, accessToken: data.session.access_token };
    } catch {
      return { success: false };
    } finally {
      // Release the single-flight slot on the next microtask so chained
      // awaiters in the same call site still see the same settled result.
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

type ReAuthHandler = () => void;
let reAuthHandler: ReAuthHandler | null = null;

export function setReAuthHandler(handler: ReAuthHandler | null): void {
  reAuthHandler = handler;
}

export function triggerReAuth(): void {
  if (reAuthHandler) {
    try {
      reAuthHandler();
    } catch {
      // Never let a handler error escape — triggerReAuth is called from
      // catch blocks and must not throw.
    }
  }
}

// Re-export authedFetch so the Wave-0 sessionRefresh test stub — which
// imports `{ authedFetch, setReAuthHandler }` from `./sessionRefresh.js` —
// resolves to the canonical implementation in ../lib/authedFetch.
export { authedFetch } from '../lib/authedFetch';
