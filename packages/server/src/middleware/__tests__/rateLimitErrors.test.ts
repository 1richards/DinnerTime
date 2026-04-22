/**
 * TDD RED — Hono onError handler that rewrites upstream 429 / 5xx errors
 * into a stable user-facing JSON contract (Phase 23-05 / NFR-14).
 *
 * Contract:
 *   - 429 (or error message matching /rate.limit|rate_limit_exceeded/i) →
 *     body { error: 'rate_limit', message, retryAfter: number } at status 429.
 *   - 5xx with source hint (cause.provider === 'anthropic' OR message matching
 *     /anthropic|ai/i) → { error: 'ai_unavailable', message } at status 503.
 *   - Other errors → pass-through (default Hono error JSON at 500).
 *
 * These tests exercise the handler in isolation using a minimal Hono app so
 * 23-06's Sentry wiring doesn't need to be present for the suite to go green.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { rateLimitErrorHandler } from '../rateLimitErrors.js';

function makeApp(thrower: () => never) {
  const app = new Hono();
  app.get('/boom', () => {
    thrower();
  });
  app.onError((err, c) => rateLimitErrorHandler(err, c));
  return app;
}

describe('rateLimitErrorHandler', () => {
  it('rewrites 429 errors into { error: "rate_limit", message, retryAfter }', async () => {
    const app = makeApp(() => {
      throw new HTTPException(429, { message: 'Too Many Requests' });
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: string;
      message: string;
      retryAfter: number;
    };
    expect(body.error).toBe('rate_limit');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('rewrites rate_limit_exceeded upstream errors (no explicit 429 status) into rate_limit payload', async () => {
    const app = makeApp(() => {
      const err = new Error('Anthropic rate_limit_exceeded');
      (err as Error & { status?: number }).status = 429;
      throw err;
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('rate_limit');
  });

  it('rewrites 5xx Anthropic errors into { error: "ai_unavailable", ... }', async () => {
    const app = makeApp(() => {
      const err = new Error('anthropic upstream failure');
      (err as Error & { status?: number }).status = 502;
      throw err;
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('ai_unavailable');
    expect(body.message).toMatch(/AI/i);
  });

  it('passes through non-rate-limit 4xx errors unchanged', async () => {
    const app = makeApp(() => {
      throw new HTTPException(404, { message: 'Not found' });
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(404);
    const body = (await res.json().catch(() => ({ error: 'unknown' }))) as {
      error: string;
    };
    // Pass-through may be either Hono's default { message } OR a raw text
    // response; critically, it must not be our `rate_limit` envelope.
    expect(body.error).not.toBe('rate_limit');
  });
});
