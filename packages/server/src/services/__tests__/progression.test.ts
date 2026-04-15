import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAnalyzeImageStructured, mockGenerateStructured, mockGenerateText, mockGetClientFor } =
  vi.hoisted(() => {
    const mockAnalyzeImageStructured = vi.fn();
    const mockGenerateStructured = vi.fn();
    const mockGenerateText = vi.fn();
    const mockGetClientFor = vi.fn(() => ({
      generateText: mockGenerateText,
      generateStructured: mockGenerateStructured,
      analyzeImageStructured: mockAnalyzeImageStructured,
    }));
    return {
      mockAnalyzeImageStructured,
      mockGenerateStructured,
      mockGenerateText,
      mockGetClientFor,
    };
  });

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

import {
  logRecipeCook,
  getCookStats,
  computeComplexity,
  rankAmbition,
  getRecipeVariations,
} from '../progression.js';

// ---------- Helpers ----------

interface InsertCall {
  table: string;
  row: unknown;
}

function makeSupabaseMock(opts: {
  insertError?: { message: string } | null;
  cookRows?: Array<{ recipe_id: string; cooked_at: string; recipes: { title: string } | null }>;
  recipeRow?: { id: string; profile_id: string; steps: unknown[]; ingredients: unknown[]; total_time_minutes: number | null; title: string } | null;
  recipeError?: { message: string } | null;
}) {
  const insertCalls: InsertCall[] = [];
  const supabase = {
    insertCalls,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'recipe_cooks') {
        return {
          insert: vi.fn().mockImplementation((row: unknown) => {
            insertCalls.push({ table, row });
            return Promise.resolve({ error: opts.insertError ?? null });
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: opts.cookRows ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === 'recipes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: opts.recipeRow ?? null,
                  error: opts.recipeError ?? null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  return supabase as unknown as Parameters<typeof logRecipeCook>[0] & { insertCalls: InsertCall[] };
}

// ---------- logRecipeCook ----------

describe('logRecipeCook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row into recipe_cooks', async () => {
    const supabase = makeSupabaseMock({});
    await logRecipeCook(supabase, 'profile-1', 'recipe-1');
    expect(supabase.insertCalls).toHaveLength(1);
    expect(supabase.insertCalls[0]).toMatchObject({
      table: 'recipe_cooks',
      row: { profile_id: 'profile-1', recipe_id: 'recipe-1' },
    });
  });

  it('swallows insert errors and does not throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const supabase = makeSupabaseMock({ insertError: { message: 'boom' } });
    await expect(logRecipeCook(supabase, 'p', 'r')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ---------- getCookStats ----------

describe('getCookStats', () => {
  it('aggregates rows by recipe_id with counts and last_cooked_at', async () => {
    const supabase = makeSupabaseMock({
      cookRows: [
        { recipe_id: 'r1', cooked_at: '2026-04-01T10:00:00Z', recipes: { title: 'Tacos' } },
        { recipe_id: 'r1', cooked_at: '2026-04-05T10:00:00Z', recipes: { title: 'Tacos' } },
        { recipe_id: 'r2', cooked_at: '2026-04-03T10:00:00Z', recipes: { title: 'Pasta' } },
      ],
    });
    const stats = await getCookStats(supabase, 'profile-1');
    expect(stats).toHaveLength(2);
    const r1 = stats.find((s) => s.recipe_id === 'r1');
    const r2 = stats.find((s) => s.recipe_id === 'r2');
    expect(r1).toBeDefined();
    expect(r1?.cook_count).toBe(2);
    expect(r1?.title).toBe('Tacos');
    expect(r1?.last_cooked_at).toBe('2026-04-05T10:00:00Z');
    expect(r2?.cook_count).toBe(1);
    expect(r2?.last_cooked_at).toBe('2026-04-03T10:00:00Z');
  });
});

// ---------- computeComplexity ----------

describe('computeComplexity', () => {
  it.each([
    [{ steps: [], ingredients: [], total_time_minutes: 0 }, 0],
    [{ steps: [1, 2, 3], ingredients: [1, 2], total_time_minutes: 30 }, 3 + 2 + 2],
    [{ steps: new Array(5), ingredients: new Array(7), total_time_minutes: 75 }, 5 + 7 + 5],
  ])('computes complexity for %j', (recipe, expected) => {
    expect(
      computeComplexity({
        steps: recipe.steps as unknown[],
        ingredients: recipe.ingredients as unknown[],
        total_time_minutes: recipe.total_time_minutes,
      }),
    ).toBe(expected);
  });

  it('handles null total_time_minutes as 0', () => {
    expect(
      computeComplexity({ steps: [1], ingredients: [1], total_time_minutes: null }),
    ).toBe(2);
  });
});

// ---------- rankAmbition ----------

describe('rankAmbition', () => {
  beforeEach(() => {
    mockGenerateStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('returns 3 suggestions from AI structured response', async () => {
    mockGenerateStructured.mockResolvedValue({
      recommendations: [
        { recipe_id: 'c1', rationale: 'Builds knife skills' },
        { recipe_id: 'c2', rationale: 'New cuisine' },
        { recipe_id: 'c3', rationale: 'Stretch goal' },
      ],
    });
    const result = await rankAmbition({
      history: [{ recipe_id: 'h1', title: 'Tacos', complexity: 5, cook_count: 1 }],
      candidates: [
        { recipe_id: 'c1', title: 'Risotto', complexity: 8 },
        { recipe_id: 'c2', title: 'Pad Thai', complexity: 7 },
        { recipe_id: 'c3', title: 'Souffle', complexity: 12 },
      ],
    });
    expect(mockGetClientFor).toHaveBeenCalledWith('progression.ambition');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ recipe_id: 'c1', title: 'Risotto', rationale: 'Builds knife skills' });
    expect(result[1]).toMatchObject({ recipe_id: 'c2', title: 'Pad Thai' });
  });

  it('drops recommendations whose recipe_id is not in candidates (no hallucinations)', async () => {
    mockGenerateStructured.mockResolvedValue({
      recommendations: [
        { recipe_id: 'c1', rationale: 'ok' },
        { recipe_id: 'GHOST', rationale: 'fake' },
        { recipe_id: 'c2', rationale: 'ok' },
      ],
    });
    const result = await rankAmbition({
      history: [],
      candidates: [
        { recipe_id: 'c1', title: 'A', complexity: 3 },
        { recipe_id: 'c2', title: 'B', complexity: 4 },
      ],
    });
    expect(result.find((r) => r.recipe_id === 'GHOST')).toBeUndefined();
    expect(result).toHaveLength(2);
  });

  it('falls back to lowest-complexity candidates when AI returns nothing usable', async () => {
    mockGenerateStructured.mockResolvedValue({ recommendations: [] });
    const result = await rankAmbition({
      history: [],
      candidates: [
        { recipe_id: 'c1', title: 'High', complexity: 20 },
        { recipe_id: 'c2', title: 'Low', complexity: 2 },
        { recipe_id: 'c3', title: 'Mid', complexity: 10 },
        { recipe_id: 'c4', title: 'Lowest', complexity: 1 },
      ],
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.recipe_id)).toEqual(['c4', 'c2', 'c3']);
  });
});

// ---------- getRecipeVariations ----------

describe('getRecipeVariations', () => {
  beforeEach(() => {
    mockGenerateStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  function makeStatsSupabase(cookCount: number, owned = true) {
    const cookRows = Array.from({ length: cookCount }, (_, i) => ({
      recipe_id: 'r1',
      cooked_at: `2026-04-0${i + 1}T10:00:00Z`,
      recipes: { title: 'Risotto' },
    }));
    return makeSupabaseMock({
      cookRows,
      recipeRow: owned
        ? {
            id: 'r1',
            profile_id: 'profile-1',
            steps: ['stir'],
            ingredients: ['rice'],
            total_time_minutes: 30,
            title: 'Risotto',
          }
        : null,
    });
  }

  it('returns string[] variations regardless of cook count', async () => {
    // Variations are no longer gated — they should work even for a fresh
    // recipe the user has never cooked.
    const supabase = makeStatsSupabase(0);
    mockGenerateStructured.mockResolvedValue({
      variations: ['Try with mushroom stock', 'Add saffron', 'Finish with truffle oil'],
    });
    const result = await getRecipeVariations(supabase, 'profile-1', 'r1');
    expect(mockGetClientFor).toHaveBeenCalledWith('progression.variations');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain('mushroom');
  });

  it('accepts a remix mode and passes it through', async () => {
    const supabase = makeStatsSupabase(0);
    mockGenerateStructured.mockResolvedValue({
      variations: ['Swap chicken for tofu', 'Use pork tenderloin', 'Try white fish'],
    });
    const result = await getRecipeVariations(supabase, 'profile-1', 'r1', 'protein');
    expect(result).toHaveLength(3);
    // Should have called generateStructured with a prompt mentioning protein swapping
    const call = mockGenerateStructured.mock.calls[mockGenerateStructured.mock.calls.length - 1][0];
    expect(call.user).toMatch(/protein/i);
  });
});

// ---------- markCooked integration ----------

describe('markCooked → logRecipeCook', () => {
  it('markCooked invokes recipe_cooks insert after successful cook', async () => {
    const insertCalls: unknown[] = [];
    const fakeEntry = {
      id: 'e1',
      meal_plan_id: 'plan-1',
      day_of_week: 0,
      title: 'Tacos',
      status: 'planned',
      ingredients: [],
      recipe_id: 'recipe-99',
    };
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'meal_plan_entries') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ single: () => Promise.resolve({ data: fakeEntry, error: null }) }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { ...fakeEntry, status: 'cooked', cooked_at: 'now' },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'pantry_items') {
          return {
            select: () => ({
              eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
            }),
          };
        }
        if (table === 'recipe_cooks') {
          return {
            insert: vi.fn().mockImplementation((row) => {
              insertCalls.push(row);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    };

    const { markCooked } = await import('../mealPlanner.js');
    await markCooked(supabase as unknown as Parameters<typeof markCooked>[0], 'profile-1', 'plan-1', 0);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({ profile_id: 'profile-1', recipe_id: 'recipe-99' });
  });
});
