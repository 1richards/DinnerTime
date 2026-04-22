import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCookingStore } from '../cookingStore';
import type { Recipe } from '../../types/recipe';
import AsyncStorage from '@react-native-async-storage/async-storage';

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe =>
  ({
    id: 'r1',
    profile_id: 'p1',
    title: 'Test Recipe',
    description: null,
    ingredients: [],
    steps: ['step one', 'step two', 'step three'],
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: null,
    servings: null,
    source_url: null,
    source_type: 'manual',
    image_url: null,
    ...overrides,
  }) as Recipe;

const resetStore = () => {
  useCookingStore.setState({
    recipe: null,
    stepIndex: 0,
    voiceEnabled: true,
    ttsEnabled: true,
    listening: false,
    timers: [],
    lastAssistantAnswer: null,
    ingredientChecks: {},
    darkMode: false,
    lastCommandToast: null,
    currentSessionId: null,
  });
};

describe('cookingStore', () => {
  beforeEach(async () => {
    resetStore();
    // Clear the in-memory AsyncStorage shim between tests so persist snapshots
    // don't leak across cases.
    await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has expected defaults', () => {
      const s = useCookingStore.getState();
      expect(s.recipe).toBeNull();
      expect(s.stepIndex).toBe(0);
      expect(s.voiceEnabled).toBe(true);
      expect(s.ttsEnabled).toBe(true);
      expect(s.listening).toBe(false);
      expect(s.timers).toEqual([]);
      expect(s.lastAssistantAnswer).toBeNull();
      // Phase 16 additions
      expect(s.ingredientChecks).toEqual({});
      expect(s.darkMode).toBe(false);
      expect(s.lastCommandToast).toBeNull();
      expect(s.currentSessionId).toBeNull();
    });
  });

  describe('enter', () => {
    it('sets recipe and resets stepIndex', () => {
      useCookingStore.setState({ stepIndex: 5 });
      const recipe = makeRecipe();
      useCookingStore.getState().enter(recipe);
      const s = useCookingStore.getState();
      expect(s.recipe).toBe(recipe);
      expect(s.stepIndex).toBe(0);
    });

    it('clears ingredientChecks and mints a fresh sess- id on enter', () => {
      // Seed dirty state.
      useCookingStore.setState({
        ingredientChecks: { 'rice-0': true, 'chicken-1': true },
        currentSessionId: 'sess-old-abcdef',
      });
      useCookingStore.getState().enter(makeRecipe());
      const s = useCookingStore.getState();
      expect(s.ingredientChecks).toEqual({});
      expect(s.currentSessionId).toMatch(/^sess-[0-9a-z]+-[0-9a-z]{6}$/);
      expect(s.currentSessionId).not.toBe('sess-old-abcdef');
    });
  });

  describe('exit', () => {
    it('resets recipe, stepIndex, timers, listening', () => {
      useCookingStore.setState({
        recipe: makeRecipe(),
        stepIndex: 2,
        listening: true,
        timers: [
          { id: 't1', label: '5 min', endsAt: 123, remainingMs: 1000 },
        ],
      });
      useCookingStore.getState().exit();
      const s = useCookingStore.getState();
      expect(s.recipe).toBeNull();
      expect(s.stepIndex).toBe(0);
      expect(s.timers).toEqual([]);
      expect(s.listening).toBe(false);
    });

    it('clears currentSessionId and lastCommandToast on exit', () => {
      useCookingStore.setState({
        currentSessionId: 'sess-xyz-abcdef',
        lastCommandToast: { message: 'Next step', id: 't-999' },
      });
      useCookingStore.getState().exit();
      const s = useCookingStore.getState();
      expect(s.currentSessionId).toBeNull();
      expect(s.lastCommandToast).toBeNull();
    });
  });

  describe('next', () => {
    it('advances stepIndex', () => {
      useCookingStore.getState().enter(makeRecipe());
      useCookingStore.getState().next();
      expect(useCookingStore.getState().stepIndex).toBe(1);
    });

    it('clamps at steps.length - 1', () => {
      useCookingStore.getState().enter(makeRecipe());
      useCookingStore.getState().next();
      useCookingStore.getState().next();
      useCookingStore.getState().next();
      useCookingStore.getState().next();
      expect(useCookingStore.getState().stepIndex).toBe(2);
    });

    it('no-op if recipe is null', () => {
      useCookingStore.getState().next();
      expect(useCookingStore.getState().stepIndex).toBe(0);
    });
  });

  describe('back', () => {
    it('decrements stepIndex', () => {
      useCookingStore.getState().enter(makeRecipe());
      useCookingStore.getState().next();
      useCookingStore.getState().back();
      expect(useCookingStore.getState().stepIndex).toBe(0);
    });

    it('clamps at 0 (never negative)', () => {
      useCookingStore.getState().enter(makeRecipe());
      useCookingStore.getState().back();
      useCookingStore.getState().back();
      expect(useCookingStore.getState().stepIndex).toBe(0);
    });
  });

  describe('repeat', () => {
    it('does not change stepIndex', () => {
      useCookingStore.getState().enter(makeRecipe());
      useCookingStore.getState().next();
      const before = useCookingStore.getState().stepIndex;
      useCookingStore.getState().repeat();
      expect(useCookingStore.getState().stepIndex).toBe(before);
    });
  });

  describe('addTimer', () => {
    it('pushes a timer with id, label, endsAt, remainingMs', () => {
      const before = Date.now();
      useCookingStore.getState().addTimer(5 * 60 * 1000);
      const timers = useCookingStore.getState().timers;
      expect(timers).toHaveLength(1);
      const t = timers[0];
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.label).toBe('5 min');
      expect(t.remainingMs).toBe(5 * 60 * 1000);
      expect(t.endsAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    });

    it('rounds label minutes', () => {
      useCookingStore.getState().addTimer(90 * 1000); // 1.5 min -> rounds to 2
      const t = useCookingStore.getState().timers[0];
      expect(t.label).toBe('2 min');
    });

    it('appends, does not replace', () => {
      useCookingStore.getState().addTimer(60_000);
      useCookingStore.getState().addTimer(120_000);
      expect(useCookingStore.getState().timers).toHaveLength(2);
    });
  });

  describe('removeTimer', () => {
    it('filters out the given id', () => {
      useCookingStore.getState().addTimer(60_000);
      useCookingStore.getState().addTimer(120_000);
      const [first, second] = useCookingStore.getState().timers;
      useCookingStore.getState().removeTimer(first.id);
      const remaining = useCookingStore.getState().timers;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(second.id);
    });
  });

  describe('setListening', () => {
    it('toggles listening flag', () => {
      useCookingStore.getState().setListening(true);
      expect(useCookingStore.getState().listening).toBe(true);
      useCookingStore.getState().setListening(false);
      expect(useCookingStore.getState().listening).toBe(false);
    });
  });

  describe('setAssistantAnswer', () => {
    it('stores the answer', () => {
      useCookingStore.getState().setAssistantAnswer('because salt');
      expect(useCookingStore.getState().lastAssistantAnswer).toBe(
        'because salt'
      );
    });
  });

  // ---------------------------------------------------------------------
  // Phase 16 new actions
  // ---------------------------------------------------------------------

  describe('toggleIngredient', () => {
    it('flips an entry in ingredientChecks on each call', () => {
      useCookingStore.getState().toggleIngredient('rice-0');
      expect(useCookingStore.getState().ingredientChecks['rice-0']).toBe(true);
      useCookingStore.getState().toggleIngredient('rice-0');
      expect(useCookingStore.getState().ingredientChecks['rice-0']).toBe(false);
    });

    it('accumulates multiple ids independently', () => {
      useCookingStore.getState().toggleIngredient('rice-0');
      useCookingStore.getState().toggleIngredient('chicken-1');
      useCookingStore.getState().toggleIngredient('garlic-2');
      const s = useCookingStore.getState();
      expect(s.ingredientChecks['rice-0']).toBe(true);
      expect(s.ingredientChecks['chicken-1']).toBe(true);
      expect(s.ingredientChecks['garlic-2']).toBe(true);
    });
  });

  describe('clearIngredientChecks', () => {
    it('resets ingredientChecks to {}', () => {
      useCookingStore.getState().toggleIngredient('rice-0');
      useCookingStore.getState().toggleIngredient('chicken-1');
      useCookingStore.getState().clearIngredientChecks();
      expect(useCookingStore.getState().ingredientChecks).toEqual({});
    });
  });

  describe('setDarkMode', () => {
    it('sets and resets darkMode', () => {
      useCookingStore.getState().setDarkMode(true);
      expect(useCookingStore.getState().darkMode).toBe(true);
      useCookingStore.getState().setDarkMode(false);
      expect(useCookingStore.getState().darkMode).toBe(false);
    });

    it('persists darkMode through the persist middleware with partialize (darkMode-only)', async () => {
      const setItemSpy = vi.spyOn(
        AsyncStorage as unknown as { setItem: (k: string, v: string) => Promise<void> },
        'setItem'
      );

      // Seed other slices that must NOT be persisted.
      useCookingStore.setState({
        ingredientChecks: { 'rice-0': true },
        lastCommandToast: { message: 'Next step', id: 't-123' },
        currentSessionId: 'sess-abc-def123',
        timers: [{ id: 't1', label: '1 min', endsAt: 0, remainingMs: 0 }],
      });

      useCookingStore.getState().setDarkMode(true);

      // Wait a microtask for the async persist write.
      await Promise.resolve();
      await Promise.resolve();

      expect(setItemSpy).toHaveBeenCalled();
      // Inspect the most-recent write and parse its JSON payload.
      const lastCall = setItemSpy.mock.calls[setItemSpy.mock.calls.length - 1];
      const [key, value] = lastCall as unknown as [string, string];
      expect(key).toBe('dinnertime-cooking');
      const parsed = JSON.parse(value);
      expect(parsed.state.darkMode).toBe(true);
      // Partialize must drop the other slices.
      expect(parsed.state.ingredientChecks).toBeUndefined();
      expect(parsed.state.lastCommandToast).toBeUndefined();
      expect(parsed.state.currentSessionId).toBeUndefined();
      expect(parsed.state.timers).toBeUndefined();
      expect(parsed.state.recipe).toBeUndefined();
    });

    it('rehydrates darkMode from persisted storage without mutating other slices', async () => {
      // Pre-populate the AsyncStorage shim with a persisted darkMode = true.
      await (AsyncStorage as unknown as {
        setItem: (k: string, v: string) => Promise<void>;
      }).setItem(
        'dinnertime-cooking',
        JSON.stringify({ state: { darkMode: true }, version: 1 })
      );

      // Force Zustand to re-hydrate from storage.
      await (
        useCookingStore as unknown as {
          persist: { rehydrate: () => Promise<void> };
        }
      ).persist.rehydrate();

      const s = useCookingStore.getState();
      expect(s.darkMode).toBe(true);
      // All ephemeral slices remain at initial values.
      expect(s.recipe).toBeNull();
      expect(s.ingredientChecks).toEqual({});
      expect(s.lastCommandToast).toBeNull();
      expect(s.currentSessionId).toBeNull();
      expect(s.timers).toEqual([]);
    });
  });

  describe('showCommandToast / clearCommandToast', () => {
    it('sets lastCommandToast with message + unique t-<ms> id', () => {
      useCookingStore.getState().showCommandToast('Next step');
      const t = useCookingStore.getState().lastCommandToast;
      expect(t).not.toBeNull();
      expect(t!.message).toBe('Next step');
      expect(t!.id).toMatch(/^t-\d+$/);
    });

    it('clears lastCommandToast back to null', () => {
      useCookingStore.getState().showCommandToast('Repeating');
      useCookingStore.getState().clearCommandToast();
      expect(useCookingStore.getState().lastCommandToast).toBeNull();
    });
  });

  describe('startSession', () => {
    it('mints a fresh sess- id on demand (independent of enter)', () => {
      useCookingStore.getState().startSession();
      const s = useCookingStore.getState();
      expect(s.currentSessionId).toMatch(/^sess-[0-9a-z]+-[0-9a-z]{6}$/);
    });
  });
});
