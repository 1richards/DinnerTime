import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 11-04: cookingTips now routes via the AIClient factory (Gemini
// flash-lite). We mock the factory directly so the test has zero
// coupling to any vendor SDK.
const { mockGenerateText, mockGetClientFor } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetClientFor: vi.fn(),
}));

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

// Import after mocks
import { getOrGenerateTip } from '../cookingTips.js';

// ---------- Supabase test double ----------

interface BuilderState {
  maybeSingleResult: { data: unknown; error: unknown };
  insertResult: { data: unknown; error: unknown };
  insertCalls: unknown[];
}

function makeSupabase(state: BuilderState) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => state.maybeSingleResult),
    insert: vi.fn(async (row: unknown) => {
      state.insertCalls.push(row);
      return state.insertResult;
    }),
  };
  return {
    from: vi.fn(() => builder),
    _builder: builder,
    _state: state,
  } as any;
}

function freshState(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    maybeSingleResult: { data: null, error: null },
    insertResult: { data: null, error: null },
    insertCalls: [],
    ...overrides,
  };
}

// ============================================================
// getOrGenerateTip
// ============================================================

describe('getOrGenerateTip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientFor.mockReturnValue({
      generateText: mockGenerateText,
      generateStructured: vi.fn(),
      analyzeImageStructured: vi.fn(),
    });
  });

  it('cache hit: returns stored tip without invoking the AI client', async () => {
    const state = freshState({
      maybeSingleResult: { data: { tip: 'cached tip text' }, error: null },
    });
    const supabase = makeSupabase(state);

    const result = await getOrGenerateTip(
      supabase,
      'recipe-1',
      0,
      'Whisk dry ingredients.'
    );

    expect(result).toBe('cached tip text');
    expect(mockGetClientFor).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(supabase.from).toHaveBeenCalledWith('recipe_step_tips');
  });

  it('cache miss: calls AI client with cooking.tips task, inserts row, returns generated tip', async () => {
    const state = freshState({
      maybeSingleResult: { data: null, error: null },
    });
    const supabase = makeSupabase(state);

    mockGenerateText.mockResolvedValueOnce(
      'Braising means cooking low and slow with a little liquid.'
    );

    const result = await getOrGenerateTip(
      supabase,
      'recipe-2',
      3,
      'Braise the short ribs for two hours.'
    );

    expect(result).toBe(
      'Braising means cooking low and slow with a little liquid.'
    );
    expect(mockGetClientFor).toHaveBeenCalledTimes(1);
    expect(mockGetClientFor).toHaveBeenCalledWith('cooking.tips');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.maxTokens).toBe(120);
    expect(call.user).toContain('Braise the short ribs for two hours.');

    // Insert was called with composite key + tip
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0]).toMatchObject({
      recipe_id: 'recipe-2',
      step_index: 3,
      tip: 'Braising means cooking low and slow with a little liquid.',
    });
  });

  it('AI empty response: returns empty, does NOT insert (uncertainty path)', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockGenerateText.mockResolvedValueOnce('');

    const result = await getOrGenerateTip(
      supabase,
      'recipe-3',
      1,
      'Some obscure technique step.'
    );

    expect(result).toBe('');
    expect(state.insertCalls).toHaveLength(0);
  });

  it('AI whitespace-only response: normalized to empty, does NOT insert', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockGenerateText.mockResolvedValueOnce('   \n\t  ');

    const result = await getOrGenerateTip(
      supabase,
      'recipe-4',
      0,
      'Another mysterious step.'
    );

    expect(result).toBe('');
    expect(state.insertCalls).toHaveLength(0);
  });

  it('system prompt contains the uncertainty guard (Pitfall 5)', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockGenerateText.mockResolvedValueOnce('A useful tip.');

    await getOrGenerateTip(supabase, 'recipe-5', 0, 'Sear the protein.');

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const call = mockGenerateText.mock.calls[0][0];
    const system: string = call.system;
    expect(system).toContain('uncertain');
    expect(system).toContain('empty string');
    // Forbid hedging language must be explicitly named
    expect(system).toContain('traditionally');
  });

  it('AI throws: error propagates to caller', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockGenerateText.mockRejectedValueOnce(new Error('boom'));

    await expect(
      getOrGenerateTip(supabase, 'recipe-6', 0, 'Step text.')
    ).rejects.toThrow('boom');
    expect(state.insertCalls).toHaveLength(0);
  });
});
