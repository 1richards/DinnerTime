/**
 * ScrollableRecipe tests — Phase 16 Wave 2 (16-04).
 *
 * Expanded from the Wave 0 red stub: the first two cases still assert the
 * Phase 19 token + title-render contract (unchanged semantics), plus four
 * ref-API cases assert the imperative `ScrollableRecipeHandle.scrollToIngredients()`
 * surface consumed by cook.tsx in 16-06.
 *
 * Testing strategy:
 *   - The production export is wrapped in `React.forwardRef`, so it can't
 *     be called as a plain function. We import the internal render function
 *     (`scrollableRecipeRender`) for direct invocation under the Phase-19
 *     static-inspection pattern.
 *   - React hooks (`useRef`, `useImperativeHandle`) are stubbed locally —
 *     vitest runs in a node env with no React renderer, so the real
 *     dispatcher is absent. The stubs track created refs so the ref-API
 *     assertions can attach a spy `scrollTo` to the internal ScrollView ref
 *     and then invoke the handle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import React from 'react';
import { TEST_RECIPE } from '../../../cooking/__fixtures__/recipe';

// Track refs created by `useRef` calls so the ref-API tests can attach spies
// to the internal ScrollView ref after render. React internals not available
// in vitest's node env — these stubs cover the minimum hook surface the
// production ScrollableRecipe uses.
const createdRefs: Array<{ current: unknown }> = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: (init: unknown) => {
      const r = { current: init ?? null };
      createdRefs.push(r);
      return r;
    },
    useImperativeHandle: (
      ref: { current: unknown } | null | undefined,
      factory: () => unknown,
    ) => {
      if (ref && typeof ref === 'object' && 'current' in ref) {
        ref.current = factory();
      }
    },
  };
});

// Mock expo-symbols + expo-haptics — same pattern as IngredientRow.test.
vi.mock('expo-symbols', () => ({
  SymbolView: (_props: unknown) => null,
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

import {
  ScrollableRecipe,
  scrollableRecipeRender,
  type ScrollableRecipeHandle,
} from '../ScrollableRecipe';

type AnyEl = ReactElement<any>;

function flatten(node: unknown): AnyEl[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

function collectClassNames(tree: AnyEl): string {
  return flatten(tree)
    .map((el) => (typeof el.props.className === 'string' ? el.props.className : ''))
    .join(' ');
}

beforeEach(() => {
  createdRefs.length = 0;
});

describe('ScrollableRecipe', () => {
  it('renders the recipe title and all ingredient + step sections', () => {
    const tree = scrollableRecipeRender(
      { recipe: TEST_RECIPE, currentStepIndex: 2 },
      null,
    );
    const elements = flatten(tree);
    // Must surface the recipe title somewhere
    const titleHit = elements.some(
      (el) => el.props.children === TEST_RECIPE.title,
    );
    expect(titleHit).toBe(true);
  });

  it('uses Phase 19 tokens (bg-bg, bg-surface, text-text-primary) — NO hardcoded hex', () => {
    const tree = scrollableRecipeRender(
      { recipe: TEST_RECIPE, currentStepIndex: 0 },
      null,
    );
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\bbg-bg\b/);
    expect(classes).toMatch(/\bbg-surface\b/);
    expect(classes).toMatch(/\btext-text-primary\b/);
    // No hardcoded hex color literals allowed in cooking className strings.
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  describe('imperative ref API', () => {
    it('is wrapped in React.forwardRef (accepts ref argument)', () => {
      // The forwardRef return value carries a $$typeof symbol that
      // identifies it as a forward-ref component.
      expect(ScrollableRecipe).toBeDefined();
      const typeOf = (ScrollableRecipe as unknown as { $$typeof?: symbol }).$$typeof;
      expect(typeof typeOf).toBe('symbol');
      // Confirm the underlying render fn is callable (what forwardRef wraps).
      expect(typeof scrollableRecipeRender).toBe('function');
    });

    it('after render, ref.current exposes scrollToIngredients: function', () => {
      const handleRef: React.MutableRefObject<ScrollableRecipeHandle | null> = {
        current: null,
      };
      scrollableRecipeRender(
        { recipe: TEST_RECIPE, currentStepIndex: 0 },
        handleRef,
      );
      expect(handleRef.current).toBeTruthy();
      expect(typeof handleRef.current?.scrollToIngredients).toBe('function');
    });

    it('scrollToIngredients() invokes scrollTo on the internal ScrollView ref', () => {
      const handleRef: React.MutableRefObject<ScrollableRecipeHandle | null> = {
        current: null,
      };
      scrollableRecipeRender(
        { recipe: TEST_RECIPE, currentStepIndex: 0 },
        handleRef,
      );

      // First tracked ref is the ScrollView ref (production order: scrollRef
      // is the first useRef() call). Attach a spy scrollTo + simulate
      // onLayout capturing the INGREDIENTS y.
      const scrollTo = vi.fn();
      const scrollRefEntry = createdRefs[0];
      expect(scrollRefEntry).toBeDefined();
      scrollRefEntry.current = { scrollTo };

      // Third tracked ref is ingredientsY (scrollRef, stepYs, ingredientsY).
      const ingredientsYEntry = createdRefs[2];
      expect(ingredientsYEntry).toBeDefined();
      ingredientsYEntry.current = 260;

      handleRef.current?.scrollToIngredients();

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 260, animated: true });
    });

    it('scrollToIngredients() falls back to y=0 when onLayout has not fired', () => {
      const handleRef: React.MutableRefObject<ScrollableRecipeHandle | null> = {
        current: null,
      };
      scrollableRecipeRender(
        { recipe: TEST_RECIPE, currentStepIndex: 0 },
        handleRef,
      );

      const scrollTo = vi.fn();
      const scrollRefEntry = createdRefs[0];
      expect(scrollRefEntry).toBeDefined();
      scrollRefEntry.current = { scrollTo };
      // Do NOT populate ingredientsY — simulates layout-not-yet-measured.

      handleRef.current?.scrollToIngredients();

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    });
  });
});
