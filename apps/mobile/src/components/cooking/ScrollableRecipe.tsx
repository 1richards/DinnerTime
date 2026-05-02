/**
 * ScrollableRecipe — Phase 16 Wave 2 (16-04).
 *
 * Claude.ai-artifact-style full-recipe ScrollView: INGREDIENTS section up
 * top, STEPS below with the current step highlighted. Handles the three
 * cook-screen motions locked by COOK-UX-04 / UI-SPEC §Interaction Contract:
 *
 *   1. Render the entire recipe in one vertical ScrollView (no step-by-step
 *      carousel). Upcoming + prior steps visible while user cooks.
 *   2. On `currentStepIndex` change, auto-center the active step via
 *      useCurrentStepScroll (Pattern 2, -120pt offset).
 *   3. Voice "show ingredients" scrolls the container to the captured
 *      INGREDIENTS section y. Exposed via the imperative handle
 *      `ScrollableRecipeHandle` (forwardRef + useImperativeHandle). The
 *      dispatcher side (intentRouter + handleTranscript) ships in 16-05;
 *      the wiring (cook.tsx ref) ships in 16-06.
 *
 * Phase 01-01 — wires per-row missing-ingredient indicators into each
 * `IngredientRow` so cooking mode shows the same trailing cart-add
 * affordance as PreviewSheet (Recipe Box detail / Discover preview /
 * Plan day modal).
 *
 * Architecture: store wiring lives in a thin outer wrapper
 * (`ScrollableRecipe`) so the inner render fn (`scrollableRecipeRender`)
 * stays presentational and pure — the existing 16-04 ScrollableRecipe
 * tests invoke `scrollableRecipeRender` directly, and adding store
 * subscriptions inside it would (a) trip vitest-node import resolution
 * via the supabase.ts → react-native-get-random-values CJS chain, and
 * (b) call `useState` outside a renderer ("Invalid hook call"). The
 * outer wrapper owns the hooks; the inner fn just consumes injected
 * props. Mirrors the dayRowHelpers / IngredientChecklist pattern.
 *
 * Tokens only — NativeWind Phase 19 classes. Zero hardcoded hex. Dark-mode
 * flag handling belongs in cook.tsx's root View (16-06), so this component
 * stays theme-agnostic.
 *
 * Testing note — the internal render fn (`scrollableRecipeRender`) is
 * exported so unit tests can invoke it directly with (props, ref). The
 * forwardRef return value is an opaque object (`{$$typeof, render}`) that
 * can't be called like a normal function, so the Wave-0-style
 * static-inspection pattern needs the raw render function.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import type { Recipe, ParsedIngredient } from '../../types/recipe';
import { IngredientRow } from './IngredientRow';
import { StepCard } from './StepCard';
import { useCurrentStepScroll } from '../../cooking/useCurrentStepScroll';
import { isIngredientInPantry } from '../recipes/ingredientHelpers';

/** Imperative handle exposed to cook.tsx (16-06 voice dispatcher wiring). */
export interface ScrollableRecipeHandle {
  /**
   * Scroll the recipe container to the measured y-position of the
   * INGREDIENTS section (captured via onLayout). Falls back to y=0 if
   * layout has not fired yet. Called from handleTranscript's
   * onShowIngredients branch (16-05 → 16-06).
   */
  scrollToIngredients: () => void;
}

export interface ScrollableRecipeProps {
  recipe: Recipe;
  currentStepIndex: number;
  ingredientChecks?: Record<string, boolean>;
  onToggleIngredient?: (id: string) => void;
  /**
   * Direct-tap step navigation. When provided, each step card becomes a
   * Pressable that calls onStepTap with the tapped step index. Lets the
   * user jump between steps without using the back/next controls.
   */
  onStepTap?: (index: number) => void;
  /**
   * Phase 01-01 — pantry/shopping injection for the missing-ingredient
   * indicator. Optional: omit and the inner render fn renders rows with
   * no trailing icon column (back-compat for existing tests + any
   * caller that can't pass these). The production `ScrollableRecipe`
   * outer wrapper supplies these from `usePantryStore` + `useShoppingStore`.
   */
  pantryNames?: readonly string[];
  /** Trim+lowercased ingredient names already added this session. */
  addedKeys?: ReadonlySet<string>;
  /** Tapped on a missing-ingredient row's trailing cart-add icon. */
  onAddIngredient?: (ing: ParsedIngredient) => void;
  /**
   * Gate the active-step auto-centering. When false, the recipe stays
   * scrolled to the top so the INGREDIENTS section is visible on first
   * mount; the cooking screen flips this to true once the user has
   * tapped Back/Next at least once. Defaults to true so existing
   * callers/tests render unchanged.
   */
  autoScrollEnabled?: boolean;
}

/**
 * Internal render function — exported for tests (see module doc). Real
 * consumers should use `ScrollableRecipe` (the forwardRef wrapper below)
 * which owns the pantry/shopping store wiring.
 */
export function scrollableRecipeRender(
  {
    recipe,
    currentStepIndex,
    ingredientChecks,
    onToggleIngredient,
    onStepTap,
    pantryNames,
    addedKeys,
    onAddIngredient,
    autoScrollEnabled = true,
  }: ScrollableRecipeProps,
  ref: React.Ref<ScrollableRecipeHandle>,
): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const stepYs = useRef<number[]>([]);
  const ingredientsY = useRef<number | null>(null);
  // Y of the STEPS section's containing View, absolute within the
  // ScrollView contentContainer. Per-step onLayout reports y relative
  // to this container, so we add stepsBaseY to get the absolute target
  // y the ScrollView's scrollTo expects. Without this offset the
  // auto-scroll on currentStepIndex change lands far above the active
  // step (UAT report: "directions don't scroll past step 1").
  const stepsBaseY = useRef<number>(0);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIngredients: () => {
        const y = ingredientsY.current ?? 0;
        const scroller = scrollRef.current as unknown as
          | { scrollTo?: (opts: { y: number; animated: boolean }) => void }
          | null;
        scroller?.scrollTo?.({ y, animated: true });
      },
    }),
    [],
  );

  // Center the current step card on index change. See useCurrentStepScroll
  // for why this is a sync function call (vitest node env / Wave 0 test).
  // `autoScrollEnabled` is false on initial mount in cooking mode so the
  // ingredients section stays visible; flips true after the first user
  // navigation (Back/Next/jumpToStep).
  useCurrentStepScroll({
    scrollRef,
    stepYs,
    currentStepIndex,
    enabled: autoScrollEnabled,
  });

  const checks = ingredientChecks ?? {};
  const onToggle = onToggleIngredient ?? (() => undefined);
  const indicatorEnabled = pantryNames !== undefined;

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Recipe title — surface it for voice + screen-reader context. */}
      <View className="px-4 pt-8 bg-surface">
        <Text
          className="text-title text-text-primary"
          numberOfLines={2}
          accessibilityRole="header"
        >
          {recipe.title}
        </Text>
      </View>

      {/* INGREDIENTS section — y captured for scrollToIngredients() handle. */}
      <View
        className="px-4 pt-8 bg-bg"
        onLayout={(e: LayoutChangeEvent) => {
          ingredientsY.current = e.nativeEvent.layout.y;
        }}
      >
        <Text className="text-label text-text-secondary mb-4">INGREDIENTS</Text>
        {recipe.ingredients.map((ing, i) => {
          const id = `${ing.name}-${i}`;
          const key = ing.name.trim().toLowerCase();
          // Phase 01-01 — only attach pantry-aware props when the parent
          // has actually injected pantryNames. Omitting them preserves the
          // pre-Phase-01 IngredientRow render shape exactly (no trailing
          // icon column).
          const inPantry = indicatorEnabled
            ? isIngredientInPantry(ing.name, pantryNames as readonly string[])
            : undefined;
          const wasAdded = indicatorEnabled
            ? (addedKeys?.has(key) ?? false)
            : undefined;
          const onAddToShoppingList =
            indicatorEnabled && onAddIngredient
              ? () => onAddIngredient(ing)
              : undefined;
          return (
            <IngredientRow
              key={id}
              id={id}
              name={ing.name}
              quantity={ing.quantity}
              unit={ing.unit}
              checked={!!checks[id]}
              onToggle={onToggle}
              inPantry={inPantry}
              wasAdded={wasAdded}
              onAddToShoppingList={onAddToShoppingList}
            />
          );
        })}
      </View>

      {/* STEPS section — each step wrapped in a y-capturing View for scroll.
          When onStepTap is provided, the card is pressable so the user can
          jump directly to any step without using the back/next controls. */}
      <View
        className="px-4 pt-6 bg-bg"
        onLayout={(e: LayoutChangeEvent) => {
          stepsBaseY.current = e.nativeEvent.layout.y;
        }}
      >
        <Text className="text-label text-text-secondary mb-4">STEPS</Text>
        {recipe.steps.map((step, i) => (
          <View
            key={i}
            className="mb-4"
            onLayout={(e: LayoutChangeEvent) => {
              // Absolute y within scroll content = section base + step relative.
              stepYs.current[i] = stepsBaseY.current + e.nativeEvent.layout.y;
            }}
          >
            {onStepTap ? (
              <Pressable
                onPress={() => onStepTap(i)}
                accessibilityLabel={`Go to step ${i + 1}`}
                accessibilityRole="button"
              >
                <StepCard
                  stepNumber={i + 1}
                  totalSteps={recipe.steps.length}
                  text={step}
                  isCurrent={i === currentStepIndex}
                />
              </Pressable>
            ) : (
              <StepCard
                stepNumber={i + 1}
                totalSteps={recipe.steps.length}
                text={step}
                isCurrent={i === currentStepIndex}
              />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Outer wrapper — kept as a forwardRef so cook.tsx's existing
 * `useRef<ScrollableRecipeHandle>` keeps working. The ref is passed
 * straight through to the inner render fn.
 *
 * The earlier Phase 01-01 missing-ingredient cart-add affordance was
 * intentionally removed from cooking mode: by the time the user is
 * actively cooking, ordering missing ingredients no longer helps, and
 * the trailing icon column added visual noise to the ingredient list
 * the user is reading from. The cart-add affordance still lives in the
 * recipe-detail PreviewSheet (Discover, Recipe Box, Plan) where the
 * user is choosing what to make.
 */
export const ScrollableRecipe = forwardRef<
  ScrollableRecipeHandle,
  ScrollableRecipeProps
>(function ScrollableRecipeWithStores(props, ref) {
  return scrollableRecipeRender(props, ref);
});

ScrollableRecipe.displayName = 'ScrollableRecipe';

export default ScrollableRecipe;
