/**
 * Red test stub (Phase 23 Wave 0) — module ships in 23-04.
 *
 * Imports `../authedFetch.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../authedFetch.js'" — that is the red signal.
 *
 * Companion to sessionRefresh.test.ts (which covers 401→refresh→retry).
 * THIS file asserts the base-URL + Bearer-attachment contract.
 *
 *   export async function authedFetch(
 *     input: RequestInfo,
 *     init?: RequestInit,
 *   ): Promise<Response>;
 *
 * Contract:
 *   - If input is a path starting with '/', prepend EXPO_PUBLIC_API_URL
 *   - Always attach Authorization: Bearer <access_token> from current session
 *   - If no session, still fires fetch (so 401 can be produced naturally)
 *
 * Requirement: NFR-12 (session lifecycle).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'tok-abc' } },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: { access_token: 'tok-abc' } },
        error: null,
      })),
    },
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));
vi.mock('../supabase', () => ({ supabase }));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-04)
const { authedFetch } = await import('../authedFetch.js');

describe('authedFetch — base URL + Bearer attachment', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const origBaseUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = origBaseUrl;
    fetchSpy.mockReset();
  });

  it("prepends EXPO_PUBLIC_API_URL when input starts with '/'", async () => {
    await authedFetch('/foo/bar');
    const url = fetchSpy.mock.calls[0][0];
    expect(String(url)).toBe('https://api.test.local/foo/bar');
  });

  it('leaves absolute URLs unchanged', async () => {
    await authedFetch('https://other.example/foo');
    const url = fetchSpy.mock.calls[0][0];
    expect(String(url)).toBe('https://other.example/foo');
  });

  it('attaches Authorization: Bearer <access_token>', async () => {
    await authedFetch('/foo');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = (init.headers as Record<string, string>) ?? {};
    const auth = headers['Authorization'] ?? (headers as any).Authorization;
    expect(auth).toBe('Bearer tok-abc');
  });

  it('preserves caller-provided headers while adding Bearer', async () => {
    await authedFetch('/foo', { headers: { 'Content-Type': 'application/json' } });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = (init.headers as Record<string, string>) ?? {};
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer tok-abc');
  });

  it('still fires fetch when no session exists (no bearer)', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await authedFetch('/foo');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit | undefined;
    const headers = (init?.headers as Record<string, string>) ?? {};
    expect(headers['Authorization']).toBeUndefined();
  });
});
