import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase (same shape as pantryStore.test.ts)
const mockSupabase = vi.hoisted(() => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };

  return {
    from: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_table?: string): any => chainable(),
    ),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'test-token' } },
          error: null,
        }),
      ),
    },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import store after mocks
import { usePantryStore } from '../pantryStore';

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const errJson = (status: number, body: unknown = { error: 'bad' }) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

function resetRulesState() {
  usePantryStore.setState({
    rules: { name_mapping: [], location_mapping: [] },
    suggestions: [],
  });
  vi.clearAllMocks();
  mockFetch.mockReset();
}

describe('pantryStore — rules & suggestions', () => {
  beforeEach(resetRulesState);

  describe('loadRules', () => {
    it('fetches /rules and populates state.rules', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          name_mapping: [
            { id: 'n1', alias_name: 'creamer', canonical_ingredient_id: 'can-milk' },
          ],
          location_mapping: [
            {
              id: 'l1',
              canonical_ingredient_id: 'can-butter',
              source_location: 'fridge',
              precedence: 0,
            },
          ],
        }),
      );

      await usePantryStore.getState().loadRules();

      const state = usePantryStore.getState();
      expect(state.rules.name_mapping).toHaveLength(1);
      expect(state.rules.location_mapping).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/pantry\/rules$/),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('createRule — name_mapping', () => {
    it('POSTs /rules with name_mapping body and reloads on success', async () => {
      mockFetch
        .mockResolvedValueOnce(okJson({ data: { rule_type: 'name_mapping' } }))
        .mockResolvedValueOnce(
          okJson({ name_mapping: [], location_mapping: [] }),
        );

      await usePantryStore.getState().createRule({
        rule_type: 'name_mapping',
        alias_name: 'creamer',
        target_canonical_id: 'can-milk',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/pantry\/rules$/);
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        rule_type: 'name_mapping',
        alias_name: 'creamer',
        target_canonical_id: 'can-milk',
      });
    });
  });

  describe('createRule — location_mapping', () => {
    it('POSTs /rules with location_mapping body', async () => {
      mockFetch
        .mockResolvedValueOnce(okJson({ data: { rule_type: 'location_mapping' } }))
        .mockResolvedValueOnce(
          okJson({ name_mapping: [], location_mapping: [] }),
        );

      await usePantryStore.getState().createRule({
        rule_type: 'location_mapping',
        canonical_ingredient_id: 'can-butter',
        source_location: 'fridge',
      });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        rule_type: 'location_mapping',
        canonical_ingredient_id: 'can-butter',
        source_location: 'fridge',
      });
    });
  });

  describe('reorderRules', () => {
    it('optimistically reorders location rules, PATCHes /rules/reorder, and rolls back on error', async () => {
      // Seed state
      const initial = [
        {
          id: 'l1',
          canonical_ingredient_id: 'c1',
          source_location: 'fridge' as const,
          precedence: 0,
        },
        {
          id: 'l2',
          canonical_ingredient_id: 'c2',
          source_location: 'pantry' as const,
          precedence: 1,
        },
      ];
      usePantryStore.setState({
        rules: { name_mapping: [], location_mapping: initial },
      });

      // Test error path first — PATCH fails, state must roll back.
      mockFetch.mockResolvedValueOnce(errJson(500));
      await expect(
        usePantryStore.getState().reorderRules(['l2', 'l1']),
      ).rejects.toThrow();

      const state = usePantryStore.getState();
      expect(state.rules.location_mapping.map((r) => r.id)).toEqual(['l1', 'l2']);
    });

    it('persists the new order when PATCH succeeds', async () => {
      usePantryStore.setState({
        rules: {
          name_mapping: [],
          location_mapping: [
            {
              id: 'l1',
              canonical_ingredient_id: 'c1',
              source_location: 'fridge' as const,
              precedence: 0,
            },
            {
              id: 'l2',
              canonical_ingredient_id: 'c2',
              source_location: 'pantry' as const,
              precedence: 1,
            },
          ],
        },
      });
      mockFetch.mockResolvedValueOnce(okJson({ data: { reordered: 2 } }));

      await usePantryStore.getState().reorderRules(['l2', 'l1']);

      const state = usePantryStore.getState();
      expect(state.rules.location_mapping.map((r) => r.id)).toEqual(['l2', 'l1']);
      expect(state.rules.location_mapping.map((r) => r.precedence)).toEqual([0, 1]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/pantry\/rules\/reorder$/),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteRule', () => {
    it('optimistically removes the rule and rolls back on error', async () => {
      usePantryStore.setState({
        rules: {
          name_mapping: [
            { id: 'n1', alias_name: 'a', canonical_ingredient_id: 'c1' },
          ],
          location_mapping: [
            {
              id: 'l1',
              canonical_ingredient_id: 'c2',
              source_location: 'fridge' as const,
              precedence: 0,
            },
          ],
        },
      });
      mockFetch.mockResolvedValueOnce(errJson(500));

      await expect(usePantryStore.getState().deleteRule('n1')).rejects.toThrow();

      const state = usePantryStore.getState();
      expect(state.rules.name_mapping).toHaveLength(1);
    });
  });

  describe('loadSuggestions', () => {
    it('fetches /suggestions and populates state.suggestions', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          data: [
            {
              id: 's1',
              rule_type: 'location_mapping',
              payload: {
                canonical_ingredient_id: 'can-butter',
                user_location: 'fridge',
                item_name: 'butter',
              },
              occurrence_count: 3,
              first_seen: '2026-04-10T00:00:00Z',
              last_seen: '2026-04-15T00:00:00Z',
            },
          ],
        }),
      );

      await usePantryStore.getState().loadSuggestions();

      expect(usePantryStore.getState().suggestions).toHaveLength(1);
      expect(usePantryStore.getState().suggestions[0].id).toBe('s1');
    });
  });

  describe('acceptSuggestion', () => {
    it('POSTs /accept, removes from suggestions, and reloads rules', async () => {
      usePantryStore.setState({
        suggestions: [
          {
            id: 's1',
            rule_type: 'location_mapping',
            payload: {},
            occurrence_count: 2,
            first_seen: '',
            last_seen: '',
          },
        ],
      });
      mockFetch
        .mockResolvedValueOnce(okJson({ data: { accepted: true } }))
        .mockResolvedValueOnce(
          okJson({ name_mapping: [], location_mapping: [] }),
        );

      await usePantryStore.getState().acceptSuggestion('s1');

      const state = usePantryStore.getState();
      expect(state.suggestions).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/pantry\/suggestions\/s1\/accept$/),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('dismissSuggestion', () => {
    it('POSTs /dismiss and removes from suggestions', async () => {
      usePantryStore.setState({
        suggestions: [
          {
            id: 's1',
            rule_type: 'location_mapping',
            payload: {},
            occurrence_count: 2,
            first_seen: '',
            last_seen: '',
          },
        ],
      });
      mockFetch.mockResolvedValueOnce(okJson({ data: { dismissed: true } }));

      await usePantryStore.getState().dismissSuggestion('s1');

      expect(usePantryStore.getState().suggestions).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/pantry\/suggestions\/s1\/dismiss$/),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
