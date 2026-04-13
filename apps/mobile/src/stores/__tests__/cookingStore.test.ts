import { describe, it, expect, beforeEach } from 'vitest';
import { useCookingStore } from '../cookingStore';
import type { Recipe } from '../../types/recipe';

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
  });
};

describe('cookingStore', () => {
  beforeEach(() => {
    resetStore();
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
});
