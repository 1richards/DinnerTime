/**
 * Stable user-facing error envelope for rate-limit + upstream-AI failures
 * (Phase 23-05 / NFR-14).
 *
 * Rewrites any error surfaced from the Hono pipeline into one of three
 * shapes:
 *
 *   1. 429  / rate_limit_exceeded  →
 *        status 429, { error: 'rate_limit',    message, retryAfter }
 *   2. 5xx from Anthropic (or any upstream AI)  →
 *        status 503, { error: 'ai_unavailable', message }
 *   3. anything else  →
 *        delegated to Hono's default handling (HTTPException#getResponse()
 *        when available, otherwise 500 with a generic message).
 *
 * Mounted via `app.onError(...)` — Hono's recommended catch-all hook. Pure
 * function, no side-effects, so it's trivially testable in isolation.
 */
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface ErrorLike {
  status?: number;
  message?: string;
  cause?: unknown;
}

function getStatus(err: unknown): number | null {
  if (err == null || typeof err !== 'object') return null;
  if (err instanceof HTTPException) return err.status;
  const maybe = (err as ErrorLike).status;
  return typeof maybe === 'number' && Number.isFinite(maybe) ? maybe : null;
}

function getMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message ?? '';
  if (typeof err === 'object') {
    const msg = (err as ErrorLike).message;
    return typeof msg === 'string' ? msg : '';
  }
  return '';
}

function looksLikeRateLimit(err: unknown): boolean {
  if (getStatus(err) === 429) return true;
  const msg = getMessage(err);
  return /rate.?limit|rate_limit_exceeded|too many requests/i.test(msg);
}

function looksLikeAnthropic5xx(err: unknown): boolean {
  const status = getStatus(err);
  if (status === null || status < 500 || status >= 600) return false;
  const msg = getMessage(err);
  if (/anthropic|claude|openai|gemini|upstream.*ai|ai.*upstream/i.test(msg)) {
    return true;
  }
  // Also treat a `cause.provider === 'anthropic'` tag (if set by the caller)
  // as a positive signal — future-proofing for services that attach metadata.
  if (err && typeof err === 'object') {
    const cause = (err as ErrorLike).cause;
    if (cause && typeof cause === 'object') {
      const provider = (cause as { provider?: unknown }).provider;
      if (
        typeof provider === 'string' &&
        /anthropic|claude|openai|gemini/i.test(provider)
      ) {
        return true;
      }
    }
  }
  return false;
}

function parseRetryAfter(c: Context): number {
  // Preserve upstream Retry-After header when present; fall back to 60s.
  const raw = c.res.headers.get('Retry-After');
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 60;
}

/**
 * Exported for Hono's `app.onError(handler)` registration AND for direct
 * unit testing. Keep the signature minimal — no middleware `next()` — so
 * callers can forward thrown errors without juggling the request pipeline.
 */
export function rateLimitErrorHandler(err: Error, c: Context): Response {
  if (looksLikeRateLimit(err)) {
    const retryAfter = parseRetryAfter(c);
    return c.json(
      {
        error: 'rate_limit',
        message: "We're a bit busy — try again in a minute",
        retryAfter,
      },
      429,
    );
  }

  if (looksLikeAnthropic5xx(err)) {
    return c.json(
      {
        error: 'ai_unavailable',
        message: 'Our AI service hiccuped — try again shortly',
      },
      503,
    );
  }

  // Fall through to Hono's default error rendering. HTTPException carries
  // its own `.getResponse()`; everything else becomes a generic 500.
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json(
    {
      error: 'internal_error',
      message: 'Something went wrong',
    },
    500,
  );
}

/**
 * Alias kept for the plan's `rateLimitErrorsMiddleware` naming (frontmatter
 * `exports: rateLimitErrorsMiddleware`). The underlying function is the
 * same handler shape Hono expects from `app.onError`.
 */
export const rateLimitErrorsMiddleware = rateLimitErrorHandler;
