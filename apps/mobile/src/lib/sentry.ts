/**
 * Phase 23 Wave 2 (plan 23-06): Sentry client wrapper.
 *
 * Thin shim over @sentry/react-native that:
 *   - No-ops when DSN is empty/undefined (safe for local dev + tests without a
 *     Sentry project).
 *   - Scrubs PII from event payloads via `beforeSend` (strips email/password/
 *     token/transcript/raw_query/prompt/display_name/name keys at depth 0-2).
 *   - Scrubs PII from breadcrumb data before add.
 *   - Correlates crashes with authed users via `setSentryUser({ id })` — no
 *     email or display name ever leaves the device.
 *
 * Requirement: NFR-15 (client error tracking with PII hygiene + user correlation).
 *
 * NOTE: Import lazily from call sites (`await import('../lib/sentry')`) to
 * keep the `@sentry/react-native` native bridge out of the cold-start module
 * graph. First use pays the init cost; subsequent calls are free.
 */
// @sentry/react-native is a hard dep of the mobile app; the earlier
// lazy-require shim was a hold-over from a dev client that predated
// the native bridge. Import normally so vi.mock() can substitute the
// module in unit tests.
import * as Sentry from '@sentry/react-native';

// ---------------------------------------------------------------------------
// PII hygiene
// ---------------------------------------------------------------------------

/**
 * Regex of keys that MUST be stripped before any Sentry event leaves the
 * device. Applies to both event.extra / event.contexts (in beforeSend) and
 * to breadcrumb data (in captureBreadcrumb).
 *
 * Matches case-insensitively on substring — so `userEmail`, `accessToken`,
 * `rawQuery`, `displayName` all get stripped even if they weren't exact key
 * matches. Tradeoff: `name` stripping is aggressive — it will nuke `task_name`
 * and `model_name` too, but that's acceptable here because Sentry events are
 * for error context, not analytics (that's ai_events + plan_events).
 */
const PII_KEY_RE = /email|password|token|transcript|raw_query|prompt|display_name|name/i;

function stripPII(
  obj: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> {
  if (!obj || depth > 2) return obj ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEY_RE.test(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripPII(v as Record<string, unknown>, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the Sentry client. Safe to call multiple times — later calls
 * no-op inside @sentry/react-native.
 *
 * When `dsn` is undefined or empty, this function returns silently. This
 * is deliberate: local dev without a Sentry DSN should not fail to boot,
 * and CI builds that don't ship Sentry (e.g. unit-test environments) should
 * get a silent no-op.
 */
export function initSentry(dsn: string | undefined): void {
  if (!dsn) return;

  // __DEV__ is a React Native global flag. In test environments it may be
  // undefined — default to the dev sample rate for safety.
  const devFlag =
    typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'boolean'
      ? (globalThis as { __DEV__?: boolean }).__DEV__
      : true;

  Sentry.init({
    dsn,
    tracesSampleRate: devFlag ? 0.1 : 0.2,
    beforeSend(event) {
      // Scrub PII from extra + contexts before the event is transmitted.
      // Sentry types are loose here — cast and rebuild.
      const ev = event as unknown as {
        extra?: Record<string, unknown>;
        contexts?: Record<string, unknown>;
      };
      if (ev.extra) ev.extra = stripPII(ev.extra);
      if (ev.contexts) ev.contexts = stripPII(ev.contexts);
      return event;
    },
  });
}

/**
 * Correlate subsequent Sentry events with an authed user. Call with the
 * user's UUID only — no email, no display name, no profile data.
 *
 * Passing `null` clears the user (e.g. after sign-out).
 */
export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

/**
 * Add a breadcrumb for later crash correlation. Breadcrumbs are NOT sent to
 * Sentry directly — they're only attached to subsequent error events. Safe
 * to call frequently (tab switches, recipe opens, etc.).
 *
 * `data` is scrubbed for PII before attach.
 */
export function captureBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data: data ? stripPII(data) : undefined,
    level: 'info',
  });
}

/**
 * Report a caught exception to Sentry. The event goes through the
 * `beforeSend` PII filter installed in `initSentry`. Safe to call even when
 * Sentry wasn't initialized (@sentry/react-native swallows the call).
 */
export function captureException(
  err: unknown,
  options?: { tags?: Record<string, string> },
): void {
  Sentry.captureException(err, options);
}
