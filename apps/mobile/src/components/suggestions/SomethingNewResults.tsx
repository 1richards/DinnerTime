/**
 * SomethingNewResults — render grid for Phase 17 searchResults.
 *
 * Reads from useSuggestionsStore:
 *   - searchResults (ParsedRecipe[])
 *   - isLoading (skeleton state)
 *   - error (ErrorState)
 *   - searchRecipes (retry from error / empty state if appropriate)
 *   - lastQuery + pantryOnly (for retry args)
 *
 * Tap on a card lifts the recipe up via `onRequestPreview` so the parent
 * (kitchen.tsx) can mount the shared PreviewSheet — keeping this component
 * presentation-only.
 *
 * Each result is rendered via the shared `RecipeCard` component in `preview`
 * mode so the Something New grid is visually identical to the Recipe Box.
 * A synthetic `Recipe` is assembled per row (ParsedRecipe has no id /
 * is_favorite); preview mode suppresses the favorite + remix action cluster.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { SuggestionSkeleton } from './SuggestionSkeleton';
import { RecipeCard } from '../recipes/RecipeCard';
import { RemixSheet } from '../recipes/RemixSheet';

import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { usePantryStore } from '../../stores/pantryStore';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import {
  prefetchHydration,
  previewFrom,
} from '../../hooks/useHydratedRecipeContent';
import { isIngredientInPantry } from '../recipes/ingredientHelpers';
import { colors } from '../../design/tokens';
import type { ParsedRecipe, Recipe } from '../../types/recipe';

interface SomethingNewResultsProps {
  onRequestPreview: (recipe: ParsedRecipe) => void;
}

export function SomethingNewResults({ onRequestPreview }: SomethingNewResultsProps) {
  const searchResults = useSuggestionsStore((s) => s.searchResults);
  const isLoading = useSuggestionsStore((s) => s.isLoading);
  const error = useSuggestionsStore((s) => s.error);
  const searchRecipes = useSuggestionsStore((s) => s.searchRecipes);
  const clearHistory = useSuggestionsStore((s) => s.clearHistory);
  const lastQuery = useSuggestionsStore((s) => s.lastQuery);
  const pantryOnly = useSuggestionsStore((s) => s.pantryOnly);
  const appendSearchResults = useSuggestionsStore(
    (s) => s.appendSearchResults,
  );
  const isAppending = useSuggestionsStore((s) => s.isAppending);

  const refresh = () => {
    // Regenerate with the same query args that produced the current list.
    void searchRecipes(lastQuery ?? '', { pantryOnly });
  };

  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <LoadingMessage query={lastQuery} pantryOnly={pantryOnly} />
        <SuggestionSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load ideas"
        message={error}
        retry={{
          label: 'Try again',
          onPress: () => {
            void searchRecipes(lastQuery ?? '', { pantryOnly });
          },
        }}
        variant="full"
      />
    );
  }

  if (searchResults.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Try searching for something new</Text>
        <Text style={styles.emptyBody}>
          Tap the search bar above and describe what you're craving — e.g.
          "quick weeknight pastas" or "cozy vegetarian soups".
        </Text>
        {lastQuery && (
          <View style={{ marginTop: 16 }}>
            <Button
              title="Retry last search"
              variant="outline"
              onPress={() => {
                void searchRecipes(lastQuery, { pantryOnly });
              }}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={colors.brand}
        />
      }
    >
      {/* Results toolbar — visible refresh + clear controls */}
      <View style={styles.resultsToolbar}>
        <Text style={styles.resultsCount}>
          {searchResults.length} {searchResults.length === 1 ? 'idea' : 'ideas'}
          {pantryOnly ? ' from your pantry' : lastQuery ? ` for “${lastQuery}”` : ''}
        </Text>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={refresh}
            hitSlop={8}
            accessibilityLabel="Regenerate ideas"
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <SymbolIcon
              name="arrow.clockwise"
              size={20}
              weight="semibold"
              tintColor={colors.brand}
            />
          </Pressable>
          <Pressable
            onPress={() => clearHistory()}
            hitSlop={8}
            accessibilityLabel="Clear ideas"
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <SymbolIcon
              name="xmark"
              size={20}
              weight="semibold"
              tintColor={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {searchResults.map((recipe, idx) => (
        <PreviewRecipeCard
          key={`${recipe.title}-${idx}`}
          recipe={recipe}
          idx={idx}
          onPress={() => onRequestPreview(recipe)}
        />
      ))}

      {searchResults.length > 0 && (
        <View style={styles.loadMoreWrap}>
          <Button
            title={isAppending ? 'Finding more…' : 'Show me more ideas'}
            loading={isAppending}
            disabled={isAppending}
            onPress={() => {
              // Fall back to pantry-only when we have no query context.
              const trimmed = (lastQuery ?? '').trim();
              const effectivePantryOnly = pantryOnly || trimmed.length === 0;
              void appendSearchResults(lastQuery ?? '', {
                pantryOnly: effectivePantryOnly,
              });
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

// ---------- Loading message — echoes the user's query while searching ----------
// Search latency is several seconds; showing the in-flight query back to the
// user makes the wait feel purposeful rather than broken. Message shape:
//   - pantryOnly only:           "…finding great meals from your pantry"
//   - query only:                "…finding chicken tikka masala recipes your family will love"
//   - pantryOnly + query:        "…finding chicken tikka masala recipes from your pantry"
//   - nothing:                   "…finding dinner ideas"

function buildLoadingMessage(
  query: string | null | undefined,
  pantryOnly: boolean,
): string {
  const q = query?.trim();
  if (q && pantryOnly) return `…finding ${q} recipes from your pantry`;
  if (q) return `…finding ${q} recipes your family will love`;
  if (pantryOnly) return '…finding great meals from your pantry';
  return '…finding dinner ideas';
}

function LoadingMessage({
  query,
  pantryOnly,
}: {
  query: string | null | undefined;
  pantryOnly: boolean;
}) {
  return (
    <Text style={styles.loadingMessage}>
      {buildLoadingMessage(query, pantryOnly)}
    </Text>
  );
}

// ---------- Preview card — wraps shared RecipeCard in preview mode ----------
// Each Something New result is a ParsedRecipe without an id or is_favorite
// flag. We synthesize a Recipe shape (stable preview-${idx} id for the image
// cache key) and render it through RecipeCard in `preview` mode, which hides
// the favorite + remix overlays. The hook-per-card shape is required because
// useGeneratedRecipeImage is a hook; this keeps one fetch per unique title.

function PreviewRecipeCard({
  recipe,
  idx,
  onPress,
}: {
  recipe: ParsedRecipe;
  idx: number;
  onPress: () => void;
}) {
  const { url: generatedUri } = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
    description: recipe.description,
    ingredients: recipe.ingredients,
  });
  const heroUri = recipe.image_url ?? generatedUri ?? null;

  // Compute "X items from pantry" client-side. Search-results recipes don't
  // carry pantry-match metadata from the server — match each ingredient
  // against the user's current pantry list using the shared isIngredientInPantry
  // helper (handles staples and substring matching).
  // Subscribe to the items array reference directly — mapping inside the
  // selector would return a fresh array on every call and trip Zustand's
  // useSyncExternalStore identity check, causing an infinite render loop.
  const pantryItems = usePantryStore((s) => s.items);
  const pantryNames = pantryItems.map((i) => i.name);
  // NOTE (D5): reads 0 until the preview hydrates — `recipe.ingredients` is
  // empty for a fresh light preview and the store patches it in as hydration
  // lands (Plan 29-03), so this badge self-corrects. reduce() over [] is 0.
  const pantryMatchCount = recipe.ingredients.reduce(
    (n, ing) => (isIngredientInPantry(ing.name, pantryNames) ? n + 1 : n),
    0,
  );

  // D5 (CRITICAL): a fresh light preview has EMPTY ingredients/steps until
  // background hydration lands. `POST /recipes` HARD-400s without both. The
  // store patches ingredients+steps onto `recipe` as hydration resolves, so
  // non-empty arrays are the authoritative "safe to save" signal.
  const hydrated =
    recipe.ingredients.length > 0 && recipe.steps.length > 0;

  /**
   * D5 gate shared by every save/cook/favorite path. Returns a recipe object
   * guaranteed to carry non-empty ingredients+steps (so the POST can't 400),
   * or null if hydration is still in flight and didn't resolve (caller bails
   * with a "Still preparing" alert). When already hydrated this is a no-op
   * pass-through.
   */
  const ensureHydrated = async (): Promise<ParsedRecipe | null> => {
    if (hydrated) return recipe;
    // Await the in-flight (or kick a fresh) hydration for THIS preview.
    const content = await prefetchHydration(previewFrom(recipe));
    if (
      !content ||
      !content.ingredients?.length ||
      !content.steps?.length
    ) {
      Alert.alert(
        'Still preparing',
        'This recipe is still loading — try again in a moment.',
      );
      return null;
    }
    return {
      ...recipe,
      ingredients: content.ingredients,
      steps: content.steps,
      calories_per_serving:
        content.calories_per_serving ?? recipe.calories_per_serving,
      protein_grams_per_serving:
        content.protein_grams_per_serving ??
        recipe.protein_grams_per_serving,
      servings: content.servings ?? recipe.servings,
    };
  };

  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);
  const [remixOpen, setRemixOpen] = useState(false);
  const [working, setWorking] = useState<'save' | 'cook' | 'favorite' | null>(null);

  // Derive `saved` from the live recipe library so the bookmark icon
  // flips to its filled / checked state regardless of WHICH save path
  // the user took (this card's overlay button OR the modal PreviewSheet
  // opened via card tap). A title match is sufficient — Something New
  // results have distinct AI-generated titles, and a normalized
  // case-insensitive compare absorbs whitespace drift.
  const normalize = (s: string) => s.trim().toLowerCase();
  const saved = useRecipeStore((s) =>
    s.recipes.some((r) => normalize(r.title) === normalize(recipe.title)),
  );

  const synthetic: Recipe = {
    ...recipe,
    id: `preview-${idx}-${recipe.title}`,
    profile_id: '',
    image_url: heroUri,
    is_favorite: false,
    created_at: '',
    updated_at: '',
  };

  const handleSave = async () => {
    setWorking('save');
    try {
      // D5: never POST an un-hydrated recipe (empty ingredients/steps → 400).
      const safe = await ensureHydrated();
      if (!safe) return;
      // heroUri bakes in the resolved Gemini generatedUri (or a pre-existing
      // recipe.image_url); persisting it here keeps the library card's hero
      // visually identical to the Something New card the user just tapped.
      await saveRecipe({ ...safe, image_url: heroUri, source_type: 'ai' });
      const err = useRecipeStore.getState().error;
      if (err) {
        Alert.alert('Save failed', err);
        return;
      }
      // `saved` flips to true via the recipeStore subscription above.
    } finally {
      setWorking(null);
    }
  };

  // Save + favorite in a single tap. Mirrors handleCookNow's
  // create-recipe-and-look-it-up pattern, then toggles favorite on the
  // newly created row. Heart flips to filled via recipeStore reactivity.
  const favoritedThisRecipe = useRecipeStore((s) =>
    s.recipes.some(
      (r) =>
        normalize(r.title) === normalize(recipe.title) &&
        r.is_favorite === true,
    ),
  );

  const handleSaveAndFavorite = async () => {
    setWorking('favorite');
    try {
      // D5: gate on hydration before the save POST.
      const safe = await ensureHydrated();
      if (!safe) return;
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      const saved = await saveRecipe({
        ...safe,
        image_url: heroUri,
        source_type: 'ai',
      });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        return;
      }
      // saveRecipe returns the saved row directly (added in quick-12). If
      // for any reason it returns null, look up by diff against beforeIds
      // to handle the dedup-existing-row branch where saveRecipe already
      // updated state but returned null.
      const target =
        saved ??
        state.recipes.find((r) => !beforeIds.has(r.id)) ??
        state.recipes.find((r) => normalize(r.title) === normalize(recipe.title));
      if (target && !target.is_favorite) {
        await toggleFavorite(target.id);
      }
    } finally {
      setWorking(null);
    }
  };

  // Cook Now: save first, then jump to the cooking screen against the newly
  // created recipe id. Bypasses the normal preview-modal flow so the user
  // lands in cook mode in one tap.
  const handleCookNow = async () => {
    setWorking('cook');
    try {
      // D5: gate on hydration before the save POST.
      const safe = await ensureHydrated();
      if (!safe) return;
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      await saveRecipe({ ...safe, image_url: heroUri, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        return;
      }
      // WR-05: resolve the just-saved recipe by id-diff, then fall back to a
      // TITLE match — NOT array position. The diff is empty on the dedup
      // branch (POST /recipes returns the existing row with duplicate:true and
      // adds no new id), and state.recipes[0] is whatever sits at index 0 of
      // the library (most-recently-sorted), which can be an UNRELATED recipe.
      // Mirrors handleSaveAndFavorite's correct title-match fallback.
      const created =
        state.recipes.find((r) => !beforeIds.has(r.id)) ??
        state.recipes.find(
          (r) => normalize(r.title) === normalize(recipe.title),
        );
      const cookId = created?.id;
      if (cookId) router.push(`/recipes/${cookId}/cook`);
    } finally {
      setWorking(null);
    }
  };

  // NOTE: we intentionally do NOT block the card on Gemini image generation.
  // RecipeCard renders an instant keyword-matched fallback (getRecipeImage)
  // and runs its own generation hook, swapping in the AI photo when it lands.
  // The earlier skeleton-until-resolved gate left every Something New card
  // blank for the full ~30s image-gen latency, which read as "slow / broken".
  // A brief fallback-then-AI swap is far better UX than a 30s skeleton.

  return (
    <>
      <RecipeCard
        recipe={synthetic}
        mode="grid"
        preview
        previewActions={{
          onSave: handleSave,
          onSaveAndFavorite: handleSaveAndFavorite,
          onRemix: () => setRemixOpen(true),
          onCookNow: handleCookNow,
          saved,
          favorited: favoritedThisRecipe,
          working,
          hydrating: !hydrated,
        }}
        pantryMatchCount={pantryMatchCount}
        hideServings
        onPress={() => onPress()}
      />
      <RemixSheet
        visible={remixOpen}
        recipeTitle={recipe.title}
        source={{
          kind: 'inline',
          context: {
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
            total_time_minutes: recipe.total_time_minutes,
          },
        }}
        baseForSave={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          total_time_minutes: recipe.total_time_minutes,
        }}
        onClose={() => setRemixOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingMessage: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  grid: {
    // No horizontal padding — RecipeCard applies its own mx-4 margin so the
    // grid cards render at the exact same width as the Recipe Box FlatList
    // (which also doesn't add container padding). The toolbar compensates
    // via marginHorizontal below.
    paddingTop: 12,
    paddingBottom: 140,
  },
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  resultsCount: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
    marginRight: 8,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Icon-only Refresh/Clear buttons — mirror the Recipe Box filter button
  // pattern so the two toolbars visually match.
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.6,
  },
  loadMoreWrap: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  loadMoreBtn: {
    // Wrapped in loadMoreWrap (paddingHorizontal:20) so the brand-filled
    // pill spans the screen with consistent gutters. Previous outline-pill
    // version relied on alignSelf:'stretch' inside ScrollView which
    // didn't honor width on iOS — leaving the button collapsed to the
    // left edge with no visible affordance.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.brand,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  loadMoreText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

// Preview-mode skeleton — rendered while the generated image is loading and
// the recipe has no pre-existing image_url. Matches RecipeCard grid dimensions
// (hero ~140, body padding, shadow) so the resolve is a content swap, not a
// layout reflow. Flat tone (#F1EAE0) — no shimmer, no animation — matches the
// existing variationHero tone used in RemixSheet.
// (previewSkeletonStyles removed — cards no longer show a blocking skeleton
// while the AI image generates; RecipeCard renders an instant fallback.)
