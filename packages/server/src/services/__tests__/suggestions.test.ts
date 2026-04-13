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

// Must import after mock setup
import { buildSuggestionPrompt, getSuggestions } from '../suggestions.js';
import type { DinnerSuggestion } from '../suggestions.js';

// ---------- Test Data ----------

const makePantryItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'item-1',
  profile_id: 'profile-1',
  name: 'Chicken Breast',
  normalized_name: 'chicken breast',
  quantity: 2,
  unit: 'lb',
  category: 'protein',
  source_location: 'fridge',
  confidence: 0.9,
  status: 'available',
  last_seen_at: new Date().toISOString(),
  ...overrides,
});

const makeAdult = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'member-1',
  profile_id: 'profile-1',
  name: 'Alice',
  member_type: 'adult',
  age_range: null,
  dietary_restrictions: [],
  dietary_allergies: [],
  disliked_ingredients: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const makeKid = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'member-2',
  profile_id: 'profile-1',
  name: 'Bobby',
  member_type: 'kid',
  age_range: 'toddler',
  dietary_restrictions: [],
  dietary_allergies: [],
  disliked_ingredients: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const defaultProfile = {
  cuisine_preferences: ['Italian', 'Mexican'],
  skill_level: 'intermediate',
};

const basePantryItems = [
  makePantryItem({ id: 'item-1', name: 'Chicken Breast', normalized_name: 'chicken breast', quantity: 2, unit: 'lb', category: 'protein' }),
  makePantryItem({ id: 'item-2', name: 'Rice', normalized_name: 'rice', quantity: 3, unit: 'cup', category: 'grain' }),
  makePantryItem({ id: 'item-3', name: 'Bell Pepper', normalized_name: 'bell pepper', quantity: 2, unit: 'piece', category: 'produce' }),
  makePantryItem({ id: 'item-4', name: 'Onion', normalized_name: 'onion', quantity: 1, unit: 'piece', category: 'produce' }),
];

// ---------- buildSuggestionPrompt Tests ----------

describe('buildSuggestionPrompt', () => {
  it('includes ingredient list formatted as "- name (quantity unit, category)"', () => {
    const prompt = buildSuggestionPrompt(basePantryItems, [makeAdult()], defaultProfile);

    expect(prompt).toContain('- Chicken Breast (2 lb, protein)');
    expect(prompt).toContain('- Rice (3 cup, grain)');
    expect(prompt).toContain('- Bell Pepper (2 piece, produce)');
  });

  it('includes household member count with adult/kid breakdown', () => {
    const members = [makeAdult(), makeKid()];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).toContain('2 members');
    expect(prompt).toContain('1 adults');
    expect(prompt).toContain('1 kids');
  });

  it('includes kid ages and kid-friendly instruction when household has children', () => {
    const members = [makeAdult(), makeKid({ age_range: 'toddler' })];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).toContain('kid-friendly');
    expect(prompt).toContain('toddler');
  });

  it('does NOT contain "kid-friendly" when no kids in household', () => {
    const members = [makeAdult(), makeAdult({ id: 'member-3', name: 'Bob' })];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).not.toContain('kid-friendly');
  });

  it('lists allergies as HARD CONSTRAINTS with NEVER', () => {
    const members = [makeAdult({ dietary_allergies: ['Nut Allergy'] })];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).toContain('NEVER');
    expect(prompt).toContain('Nut Allergy');
  });

  it('lists dietary restrictions as SOFT PREFERENCES', () => {
    const members = [makeAdult({ dietary_restrictions: ['Vegetarian'] })];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).toContain('SOFT PREFERENCES');
    expect(prompt).toContain('Vegetarian');
  });

  it('includes disliked ingredients', () => {
    const members = [makeAdult({ disliked_ingredients: ['mushrooms', 'olives'] })];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    expect(prompt).toContain('mushrooms');
    expect(prompt).toContain('olives');
  });

  it('includes cuisine preferences from profile', () => {
    const prompt = buildSuggestionPrompt(basePantryItems, [makeAdult()], defaultProfile);

    expect(prompt).toContain('Italian');
    expect(prompt).toContain('Mexican');
  });

  it('includes skill level from profile', () => {
    const prompt = buildSuggestionPrompt(basePantryItems, [makeAdult()], defaultProfile);

    expect(prompt).toContain('intermediate');
  });

  it('deduplicates allergies across multiple members', () => {
    const members = [
      makeAdult({ dietary_allergies: ['Nut Allergy', 'Shellfish'] }),
      makeAdult({ id: 'member-3', name: 'Carol', dietary_allergies: ['Nut Allergy'] }),
    ];
    const prompt = buildSuggestionPrompt(basePantryItems, members, defaultProfile);

    const nutMatches = prompt.match(/Nut Allergy/g);
    expect(nutMatches).toHaveLength(1);
  });

  it('marks uncertain items when effectiveConfidence < 0.5', () => {
    const staleItem = makePantryItem({
      id: 'item-stale',
      name: 'Old Yogurt',
      normalized_name: 'old yogurt',
      category: 'dairy',
      confidence: 0.3,
      last_seen_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const items = [...basePantryItems, staleItem];
    const prompt = buildSuggestionPrompt(items, [makeAdult()], defaultProfile);

    expect(prompt).toContain('uncertain');
    expect(prompt).toContain('Old Yogurt');
  });
});

// ---------- getSuggestions Tests ----------

describe('getSuggestions', () => {
  const mockSuggestions: DinnerSuggestion[] = [
    {
      title: 'Chicken Stir Fry',
      description: 'Quick and easy chicken stir fry with vegetables.',
      ingredients_used: ['Chicken Breast', 'Bell Pepper', 'Rice'],
      ingredients_needed: ['Soy Sauce'],
      estimated_time_minutes: 25,
      difficulty: 'easy',
      kid_friendly: true,
      cuisine_type: 'Asian',
      why_suggested: 'Uses 3 pantry ingredients, quick to prepare.',
    },
  ];

  const makeMockSupabase = (
    pantryItems = basePantryItems,
    members = [makeAdult()],
    profile = defaultProfile,
  ) => {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pantry_items') {
          return {
            select: () => ({
              eq: (_col: string, _val: string) => ({
                eq: (_col2: string, _val2: string) => ({
                  data: pantryItems,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'household_members') {
          return {
            select: () => ({
              eq: (_col: string, _val: string) => ({
                data: members,
                error: null,
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: (_col: string, _val: string) => ({
                single: () => ({
                  data: profile,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
  };

  beforeEach(() => {
    mockGenerateStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('returns DinnerSuggestion[] parsed from AIClient structured response', async () => {
    mockGenerateStructured.mockResolvedValue({ suggestions: mockSuggestions });

    const supabase = makeMockSupabase();
    const result = await getSuggestions(supabase as never, 'profile-1');

    expect(mockGetClientFor).toHaveBeenCalledWith('suggestions.dinner');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].title).toBe('Chicken Stir Fry');
    expect(result.suggestions[0].difficulty).toBe('easy');
    expect(result.pantry_item_count).toBe(4);
    expect(result.generated_at).toBeDefined();
  });

  it('throws error when fewer than 3 available pantry items', async () => {
    const fewItems = [
      makePantryItem({ id: 'item-1', name: 'Milk' }),
      makePantryItem({ id: 'item-2', name: 'Eggs' }),
    ];
    const supabase = makeMockSupabase(fewItems);

    await expect(getSuggestions(supabase as never, 'profile-1')).rejects.toThrow(
      'Not enough pantry items'
    );

    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('calls AIClient.generateStructured with suggest_dinners tool', async () => {
    mockGenerateStructured.mockResolvedValue({ suggestions: mockSuggestions });

    const supabase = makeMockSupabase();
    await getSuggestions(supabase as never, 'profile-1');

    expect(mockGenerateStructured).toHaveBeenCalledOnce();
    const callArgs = mockGenerateStructured.mock.calls[0][0];
    expect(callArgs.tool.name).toBe('suggest_dinners');
    expect(typeof callArgs.user).toBe('string');
    expect(callArgs.user).toContain('AVAILABLE INGREDIENTS');
  });
});
