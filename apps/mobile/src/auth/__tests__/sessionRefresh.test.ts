/**
 * Red test stub (Phase 23 Wave 0) — module ships in 23-04.
 *
 * Imports `../sessionRefresh.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../sessionRefresh.js'" — that is the red signal.
 *
 * Wave 2 ships the 401→refreshSession→retry-once→ReAuthModal contract on
 * top of authedFetch. The Bearer-attachment concern is covered in
 * authedFetch.test.ts; this file asserts the retry-on-401 behavior.
 *
 *   export async function authedFetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
 *   export function setReAuthHandler(handler: () => void): void;
 *
 * Requirement: NFR-12 (session lifecycle).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { supabase, reAuthHandler } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'tok-1' } },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: { access_token: 'tok-2' } },
        error: null,
      })),
    },
  },
  reAuthHandler: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-04)
const { authedFetch, setReAuthHandler } = await import('../sessionRefresh.js');

describe('authedFetch 401-refresh-retry contract', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
    setReAuthHandler(reAuthHandler);
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('on 401, calls supabase.auth.refreshSession and retries once with new token', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const res = await authedFetch('https://api.test/foo');
    expect(res.status).toBe(200);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Second call uses the refreshed token.
    const secondCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
    const headers = secondCallInit.headers as Record<string, string>;
    expect(headers['Authorization'] ?? headers.Authorization).toContain('tok-2');
  });

  it('on second 401 (refresh succeeded but retried request still rejected), triggers re-auth handler and throws', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

    await expect(authedFetch('https://api.test/foo')).rejects.toBeInstanceOf(Error);
    expect(reAuthHandler).toHaveBeenCalledTimes(1);
  });

  it('when refreshSession itself fails, triggers re-auth handler and throws', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    supabase.auth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'refresh_token_expired' },
    });

    await expect(authedFetch('https://api.test/foo')).rejects.toBeInstanceOf(Error);
    expect(reAuthHandler).toHaveBeenCalledTimes(1);
  });

  it('non-401 responses pass through untouched (no refresh, no retry)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const res = await authedFetch('https://api.test/foo');
    expect(res.status).toBe(200);
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
