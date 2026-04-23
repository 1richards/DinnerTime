/**
 * Phase 23-07 (NFR-24): deep-link allowlist.
 *
 * Router-level filter for incoming URLs. `_layout.tsx` subscribes to
 * `Linking.addEventListener('url', ...)` and `Linking.parseInitialURLAsync()`
 * and consults `isDeepLinkAllowed(url)` as a gate before handing off to
 * expo-router. Rejected URLs are dropped silently (breadcrumb-logged via
 * `captureBreadcrumb('deep_link', 'rejected', { path })`) — the user never
 * sees an error, but the attempt is recorded in Sentry context for future
 * crashes.
 *
 * ## Accepted paths
 *
 *   /                      root (cold-boot universal link)
 *   /recipes/<id>          view recipe
 *   /scan/*                pantry scan flows
 *   /auth/reset-password/* Supabase email recovery link
 *   /plan/<iso>            plan day drill-down
 *   /settings/*            settings sub-screens
 *
 * Everything else → false. In particular:
 *   - `javascript:alert(1)` (XSS vector) → false (scheme not allowed)
 *   - `dinnertime://recipes/../admin/secrets` (path traversal) → false
 *   - arbitrary unknown paths → false
 *   - empty string → false
 *
 * ## Scheme handling
 *
 * Accepts two canonical input shapes:
 *
 *   1. `dinnertime://<rest>` — our custom scheme. `rest` is treated as the
 *      path (optionally starting with `/`). Query strings and fragments are
 *      stripped before matching.
 *   2. `https://<host>/<path>` — universal link form. The URL object's
 *      pathname is matched directly.
 *
 * Any other scheme (javascript:, mailto:, http: without s, etc.) is rejected.
 *
 * ## Path-traversal guard
 *
 * After building the candidate path, we reject any string containing `..`
 * segments — these cannot appear in legitimate deep links we generate, and
 * allowing them would let a crafted link escape the allowlisted prefix
 * (e.g. `/recipes/../admin/secrets` would pass a naive prefix check).
 */
// NOTE: `captureBreadcrumb` is loaded lazily via require() inside
// `safeBreadcrumb` rather than imported at the top of this file. The Sentry
// wrapper pulls in `@sentry/react-native`, whose native bridge cannot be
// resolved under vitest-node without an explicit module mock. Lazy-requiring
// from inside a try/catch lets this module ship green under vitest-node
// (where the require will throw and the catch swallows it — breadcrumbs
// only matter in the native app at runtime anyway).

/**
 * Allowed path prefixes, as anchored regexes. Matched against the
 * normalized path (after scheme strip + query strip + traversal guard).
 *
 * Order does not matter — we short-circuit on the first match. Kept as a
 * readonly tuple of RegExp (not strings) because the test stub asserts
 * `Array.isArray(ALLOWED_DEEP_LINK_PATHS)` and `.length > 0` — both hold.
 */
export const ALLOWED_DEEP_LINK_PATHS: readonly RegExp[] = [
  /^\/recipes(\/|$)/,
  /^\/scan(\/|$)/,
  /^\/auth\/reset-password(\/|$)/,
  /^\/plan(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/$/,
] as const;

const CUSTOM_SCHEME_PREFIX = 'dinnertime://';

/**
 * Returns true iff `url` is a deep link we're willing to follow. See file
 * header for full contract.
 */
export function isDeepLinkAllowed(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  let path: string;

  try {
    if (url.startsWith(CUSTOM_SCHEME_PREFIX)) {
      // `dinnertime://recipes/123`  → rest = 'recipes/123'
      // `dinnertime:///recipes/123` → rest = '/recipes/123'
      const rest = url.slice(CUSTOM_SCHEME_PREFIX.length);
      // Strip query + fragment.
      const pathOnly = rest.split(/[?#]/)[0];
      // Normalize — always leading slash.
      path = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    } else if (url.startsWith('https://')) {
      // Universal link. Let URL do the heavy lifting.
      path = new URL(url).pathname || '/';
    } else {
      // Unsupported scheme (javascript:, mailto:, http:, exp+dinnertime://, …).
      // Reject silently. `exp+dinnertime://` is the dev-client launcher — it
      // wraps real URLs via `?url=`, but deep-link payload extraction is
      // expo-router's job, not ours. Anything that actually reaches routing
      // will already be on the custom scheme.
      safeBreadcrumb('rejected_scheme', url);
      return false;
    }

    // Path-traversal guard. `..` segments cannot appear in links we generate
    // and would let a crafted link escape the allowlisted prefix.
    if (path.includes('..')) {
      safeBreadcrumb('rejected_traversal', path);
      return false;
    }

    const ok = ALLOWED_DEEP_LINK_PATHS.some((re) => re.test(path));
    if (!ok) safeBreadcrumb('rejected_path', path);
    return ok;
  } catch {
    // URL constructor throws on malformed input. Treat as rejection.
    return false;
  }
}

/**
 * Breadcrumb helper. Wrapped in try/catch because Sentry may not be
 * initialized (local dev, unit tests) and we never want link-rejection to
 * throw into the Linking subscription.
 */
function safeBreadcrumb(reason: string, detail: string): void {
  try {
    // Lazy require so vitest-node (which cannot resolve the native Sentry
    // bridge) doesn't explode when this file is imported by a test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('./sentry') as {
      captureBreadcrumb?: (
        cat: string,
        msg: string,
        data?: Record<string, unknown>,
      ) => void;
    };
    sentry.captureBreadcrumb?.('deep_link', 'rejected', { reason, detail });
  } catch {
    // no-op — Sentry not available (unit tests, cold boot before init, etc.)
  }
}
