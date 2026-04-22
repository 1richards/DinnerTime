/**
 * Phase 23 Wave 2 (plan 23-06): structured request-logging middleware.
 *
 * Emits one JSON-stringified line per request to stdout with:
 *   { ts, request_id, profile_id, method, path, status, latency_ms }
 *
 * - request_id: short nanoid/random string, also stored on context for
 *   downstream handlers (so ai telemetry can correlate).
 * - profile_id: null when unauthenticated; otherwise c.get('user').id.
 * - Mounted BEFORE authMiddleware so it wraps 401s too.
 *
 * Requirement: NFR-16 (server structured logs with request correlation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requestLoggingMiddleware } from '../requestLogging.js';

function makeAppWith(
  handler: (c: import('hono').Context) => Response | Promise<Response>,
) {
  const app = new Hono();
  app.use('*', requestLoggingMiddleware);
  app.get('/ok', handler);
  app.get('/slow', async (c) => {
    await new Promise((r) => setTimeout(r, 25));
    return c.json({ ok: true });
  });
  return app;
}

describe('requestLoggingMiddleware', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits one JSON log line per request with method + path + status + latency_ms', async () => {
    const app = makeAppWith((c) => c.json({ ok: true }));
    const res = await app.request('/ok');
    expect(res.status).toBe(200);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/ok');
    expect(parsed.status).toBe(200);
    expect(typeof parsed.latency_ms).toBe('number');
    expect(parsed.latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof parsed.ts).toBe('string');
    expect(typeof parsed.request_id).toBe('string');
    expect(parsed.request_id.length).toBeGreaterThanOrEqual(8);
  });

  it('profile_id is null when unauthenticated (no user on context)', async () => {
    const app = makeAppWith((c) => c.json({ ok: true }));
    await app.request('/ok');

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.profile_id).toBeNull();
  });

  it('profile_id reflects c.get("user").id when set by a downstream middleware', async () => {
    const app = new Hono();
    app.use('*', requestLoggingMiddleware);
    app.use('*', async (c, next) => {
      c.set('user', { id: 'user-42' });
      await next();
    });
    app.get('/ok', (c) => c.json({ ok: true }));

    await app.request('/ok');
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.profile_id).toBe('user-42');
  });

  it('stores request_id on context for downstream correlation', async () => {
    const capture: { id?: unknown } = {};
    const app = new Hono();
    app.use('*', requestLoggingMiddleware);
    app.get('/ok', (c) => {
      capture.id = c.get('request_id');
      return c.json({ ok: true });
    });

    await app.request('/ok');
    expect(typeof capture.id).toBe('string');
    expect((capture.id as string).length).toBeGreaterThanOrEqual(8);

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.request_id).toBe(capture.id);
  });

  it('latency_ms measures elapsed time (slow handler > 20ms)', async () => {
    const app = makeAppWith((c) => c.json({ ok: true }));
    await app.request('/slow');

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.latency_ms).toBeGreaterThanOrEqual(20);
    expect(parsed.path).toBe('/slow');
  });

  it('logs the line even when the handler throws (via finally)', async () => {
    const app = new Hono();
    app.use('*', requestLoggingMiddleware);
    app.get('/boom', () => {
      throw new Error('boom');
    });
    // Hono converts uncaught throws to 500s.
    app.onError((_err, c) => c.json({ error: 'server_error' }, 500));

    await app.request('/boom');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.status).toBe(500);
    expect(parsed.path).toBe('/boom');
  });
});
