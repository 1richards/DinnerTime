import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mirror mealPlanStore.test.ts pattern: hoist supabase mock, stub global fetch.
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn<
      () => Promise<{
        data: { session: { access_token: string } | null };
        error: Error | null;
      }>
    >(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    ),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mocks are registered.
import { askAssistant } from '../askAssistant';

describe('askAssistant', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  it('POSTs to /api/v1/cooking/ask with auth header and returns answer string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'Stir gently for two minutes.' }),
    });

    const answer = await askAssistant('recipe-1', 2, 'How long do I stir?');

    expect(answer).toBe('Stir gently for two minutes.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/cooking\/ask$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body)).toEqual({
      recipe_id: 'recipe-1',
      current_step_index: 2,
      question: 'How long do I stir?',
    });
  });

  it('throws with server error code on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'ASK_FAILED', code: 'ASK_FAILED' }),
    });

    await expect(askAssistant('recipe-1', 0, 'What now?')).rejects.toThrow(
      'ASK_FAILED',
    );
  });

  it('throws with HTTP_<status> fallback when error body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(askAssistant('recipe-1', 0, 'What now?')).rejects.toThrow(
      'HTTP_502',
    );
  });

  it('throws "Not authenticated" when no supabase session', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(askAssistant('recipe-1', 0, 'What?')).rejects.toThrow(
      'Not authenticated',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
