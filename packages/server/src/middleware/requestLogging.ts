import type { Context, Next } from 'hono';

/**
 * Phase 23 Wave 2 (plan 23-06): structured request-logging middleware.
 *
 * Emits one JSON-stringified line per request to stdout:
 *   { ts, request_id, profile_id, method, path, status, latency_ms }
 *
 * - Must be mounted BEFORE authMiddleware so it wraps 401s. When no user is
 *   set on the context, profile_id is null.
 * - request_id is a 12-char base36 string generated per request and stored
 *   on the context so downstream handlers (aiTelemetry, ai adapters,
 *   error reporting) can correlate.
 * - Latency is measured wall-clock around next().
 * - Always logs, even when the downstream handler throws — the try/finally
 *   protects log-on-error.
 *
 * Requirement: NFR-16 (server structured logs with request_id + profile_id).
 */
function shortId(): string {
  // 10 random base36 chars + 2 time-derived chars = 12-char short id.
  // Not cryptographically secure — uniqueness-within-a-request-window is
  // all that's required for log correlation.
  return (
    Math.random().toString(36).slice(2, 12) +
    (Date.now() % 1296).toString(36).padStart(2, '0')
  );
}

export async function requestLoggingMiddleware(c: Context, next: Next) {
  const requestId = shortId();
  const t0 = Date.now();
  c.set('request_id', requestId);

  try {
    await next();
  } finally {
    const user = c.get('user') as { id?: string } | undefined;
    const line = {
      ts: new Date().toISOString(),
      request_id: requestId,
      profile_id: user?.id ?? null,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      latency_ms: Date.now() - t0,
    };
    // One JSON line per request to stdout — pipe to Fly.io / Railway / etc.
    console.log(JSON.stringify(line));
  }
}
