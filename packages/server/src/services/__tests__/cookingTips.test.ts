import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock for Anthropic SDK (mirrors shoppingList.test.ts pattern)
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

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

function claudeText(text: string) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
  };
}

// ============================================================
// getOrGenerateTip
// ============================================================

describe('getOrGenerateTip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cache hit: returns stored tip without calling Anthropic', async () => {
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
    expect(mockCreate).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(supabase.from).toHaveBeenCalledWith('recipe_step_tips');
  });

  it('cache miss: calls Haiku, inserts new row, returns generated tip', async () => {
    const state = freshState({
      maybeSingleResult: { data: null, error: null },
    });
    const supabase = makeSupabase(state);

    mockCreate.mockResolvedValueOnce(
      claudeText('Braising means cooking low and slow with a little liquid.')
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
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    // Haiku model id (per project conventions, claude-haiku-4-*)
    expect(call.model).toMatch(/haiku/);
    expect(call.max_tokens).toBe(120);
    expect(call.temperature).toBe(0.3);

    // Insert was called with composite key + tip
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0]).toMatchObject({
      recipe_id: 'recipe-2',
      step_index: 3,
      tip: 'Braising means cooking low and slow with a little liquid.',
    });
  });

  it('Haiku empty response: returns empty, does NOT insert', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockCreate.mockResolvedValueOnce(claudeText(''));

    const result = await getOrGenerateTip(
      supabase,
      'recipe-3',
      1,
      'Some obscure technique step.'
    );

    expect(result).toBe('');
    expect(state.insertCalls).toHaveLength(0);
  });

  it('Haiku whitespace-only response: normalized to empty, does NOT insert', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockCreate.mockResolvedValueOnce(claudeText('   \n\t  '));

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
    mockCreate.mockResolvedValueOnce(claudeText('A useful tip.'));

    await getOrGenerateTip(supabase, 'recipe-5', 0, 'Sear the protein.');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    const system: string = call.system;
    expect(system).toContain('uncertain');
    expect(system).toContain('empty string');
    // Forbid hedging language must be explicitly named
    expect(system).toContain('traditionally');
  });

  it('Haiku throws: error propagates to caller', async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    mockCreate.mockRejectedValueOnce(new Error('boom'));

    await expect(
      getOrGenerateTip(supabase, 'recipe-6', 0, 'Step text.')
    ).rejects.toThrow('boom');
    expect(state.insertCalls).toHaveLength(0);
  });
});
