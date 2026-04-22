/**
 * authedFetch — canonical fetch wrapper for the DinnerTime mobile app.
 *
 * Responsibilities:
 *   - Prepend EXPO_PUBLIC_API_URL when input is a path starting with '/'.
 *   - Attach Authorization: Bearer <access_token> from the current Supabase
 *     session (when present).
 *   - On 401: delegate to sessionRefresh.attemptSessionRefresh() — if the
 *     refresh succeeds, retry the original request ONCE with the new token.
 *     If the retry also 401s OR the refresh itself fails, call
 *     triggerReAuth() (which pops the root-level ReAuthModal) and throw.
 *
 * The 401-retry concern is shared between this module and sessionRefresh.ts;
 * sessionRefresh.ts re-exports `authedFetch` so Wave 0 test stubs that import
 * either path see the same implementation.
 *
 * Requirement: NFR-08, NFR-12 (session lifecycle — silent refresh + hard-401
 * fallback to ReAuthModal).
 */
import { supabase } from './supabase';
import { attemptSessionRefresh, triggerReAuth } from '../auth/sessionRefresh';

function resolveUrl(input: RequestInfo): RequestInfo {
  if (typeof input !== 'string') return input;
  if (input.startsWith('/')) {
    const base = process.env.EXPO_PUBLIC_API_URL ?? '';
    return `${base}${input}`;
  }
  return input;
}

async function currentAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: HeadersInit,
): Record<string, string> {
  const merged: Record<string, string> = { ...base };
  if (!extra) return merged;
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) merged[k] = v;
  } else if (typeof (extra as Headers).forEach === 'function') {
    (extra as Headers).forEach((v, k) => {
      merged[k] = v;
    });
  } else {
    Object.assign(merged, extra as Record<string, string>);
  }
  return merged;
}

async function fireFetch(
  url: RequestInfo,
  init: RequestInit | undefined,
  token: string | null,
): Promise<Response> {
  const callerHeaders = init?.headers;
  const merged = mergeHeaders({}, callerHeaders);
  if (token) {
    merged['Authorization'] = `Bearer ${token}`;
  }
  const nextInit: RequestInit = {
    ...(init ?? {}),
    headers: merged,
  };
  return fetch(url, nextInit);
}

const REAUTH_ERROR = 'REAUTH_REQUIRED';

export async function authedFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const url = resolveUrl(input);
  const token = await currentAccessToken();
  const res = await fireFetch(url, init, token);

  if (res.status !== 401) return res;

  const refreshed = await attemptSessionRefresh();
  if (!refreshed.success) {
    triggerReAuth();
    throw new Error(REAUTH_ERROR);
  }

  const retry = await fireFetch(url, init, refreshed.accessToken ?? null);
  if (retry.status === 401) {
    triggerReAuth();
    throw new Error(REAUTH_ERROR);
  }
  return retry;
}
