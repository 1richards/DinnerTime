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
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import type { Recipe } from '../../types/recipe';
import { IngredientRow } from './IngredientRow';
import { StepCard } from './StepCard';
import { useCurrentStepScroll } from '../../cooking/useCurrentStepScroll';

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
}

/**
 * Internal render function — exported for tests (see module doc). Real
 * consumers should use `ScrollableRecipe` (the forwardRef wrapper below).
 */
export function scrollableRecipeRender(
  {
    recipe,
    currentStepIndex,
    ingredientChecks,
    onToggleIngredient,
    onStepTap,
  }: ScrollableRecipeProps,
  ref: React.Ref<ScrollableRecipeHandle>,
): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const stepYs = useRef<number[]>([]);
  const ingredientsY = useRef<number | null>(null);

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
  useCurrentStepScroll({ scrollRef, stepYs, currentStepIndex });

  const checks = ingredientChecks ?? {};
  const onToggle = onToggleIngredient ?? (() => undefined);

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
          return (
            <IngredientRow
              key={id}
              id={id}
              name={ing.name}
              quantity={ing.quantity}
              unit={ing.unit}
              checked={!!checks[id]}
              onToggle={onToggle}
            />
          );
        })}
      </View>

      {/* STEPS section — each step wrapped in a y-capturing View for scroll.
          When onStepTap is provided, the card is pressable so the user can
          jump directly to any step without using the back/next controls. */}
      <View className="px-4 pt-6 bg-bg">
        <Text className="text-label text-text-secondary mb-4">STEPS</Text>
        {recipe.steps.map((step, i) => (
          <View
            key={i}
            className="mb-4"
            onLayout={(e: LayoutChangeEvent) => {
              stepYs.current[i] = e.nativeEvent.layout.y;
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
 * forwardRef-wrapped production export. Consumed by cook.tsx (16-06):
 *   const recipeRef = useRef<ScrollableRecipeHandle>(null);
 *   <ScrollableRecipe ref={recipeRef} recipe={...} currentStepIndex={...} />
 *   recipeRef.current?.scrollToIngredients();
 */
export const ScrollableRecipe = forwardRef<
  ScrollableRecipeHandle,
  ScrollableRecipeProps
>(scrollableRecipeRender);

ScrollableRecipe.displayName = 'ScrollableRecipe';

export default ScrollableRecipe;
