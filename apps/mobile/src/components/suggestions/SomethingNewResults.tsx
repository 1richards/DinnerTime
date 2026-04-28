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
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
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
        <Pressable
          onPress={() => {
            if (!lastQuery) return;
            void appendSearchResults(lastQuery, { pantryOnly });
          }}
          disabled={isAppending || !lastQuery}
          style={({ pressed }) => [
            styles.loadMoreBtn,
            pressed && !isAppending ? { opacity: 0.7 } : null,
            isAppending || !lastQuery ? { opacity: 0.5 } : null,
          ]}
          accessibilityLabel="Show me more ideas"
        >
          {isAppending ? (
            <>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.loadMoreText}>Finding more...</Text>
            </>
          ) : (
            <>
              <SymbolIcon
                name="plus.circle"
                size={18}
                tintColor={colors.brand}
                weight="semibold"
              />
              <Text style={styles.loadMoreText}>Show me more ideas</Text>
            </>
          )}
        </Pressable>
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
  const { url: generatedUri, status } = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
    description: recipe.description,
    ingredients: recipe.ingredients,
  });
  const heroUri = recipe.image_url ?? generatedUri ?? null;

  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const [saved, setSaved] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [working, setWorking] = useState<'save' | 'cook' | null>(null);

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
      // heroUri bakes in the resolved Gemini generatedUri (or a pre-existing
      // recipe.image_url); persisting it here keeps the library card's hero
      // visually identical to the Something New card the user just tapped.
      await saveRecipe({ ...recipe, image_url: heroUri, source_type: 'ai' });
      const err = useRecipeStore.getState().error;
      if (err) {
        Alert.alert('Save failed', err);
        return;
      }
      setSaved(true);
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
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      await saveRecipe({ ...recipe, image_url: heroUri, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        return;
      }
      setSaved(true);
      const created = state.recipes.find((r) => !beforeIds.has(r.id));
      const cookId = created?.id ?? state.recipes[0]?.id;
      if (cookId) router.push(`/recipes/${cookId}/cook`);
    } finally {
      setWorking(null);
    }
  };

  // Skeleton fallback — prevents keyword-stock flash while Gemini resolves.
  // Only engaged on Something New results where recipe.image_url is null
  // (saved recipes always have a valid image and skip the hook entirely).
  if (status === 'loading' && !recipe.image_url) {
    return (
      <>
        <Pressable onPress={() => onPress()} style={previewSkeletonStyles.card}>
          <View style={previewSkeletonStyles.hero} />
          <View style={previewSkeletonStyles.body}>
            <View style={previewSkeletonStyles.titleBar} />
            <View style={previewSkeletonStyles.subtitleBar} />
          </View>
        </Pressable>
        {/* Skip RemixSheet render while loading — user cannot remix a previewless card */}
      </>
    );
  }

  return (
    <>
      <RecipeCard
        recipe={synthetic}
        mode="grid"
        preview
        previewActions={{
          onSave: handleSave,
          onRemix: () => setRemixOpen(true),
          onCookNow: handleCookNow,
          saved,
          working,
        }}
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
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // Pressable in a flex-column ScrollView contentContainer doesn't
    // reliably honor alignItems:'stretch' on iOS — content-sized boxes
    // can collapse to the left. Force full width minus side padding via
    // alignSelf so the visible pill spans the screen and the hit area
    // matches what the user sees.
    alignSelf: 'stretch',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
});

// Preview-mode skeleton — rendered while the generated image is loading and
// the recipe has no pre-existing image_url. Matches RecipeCard grid dimensions
// (hero ~140, body padding, shadow) so the resolve is a content swap, not a
// layout reflow. Flat tone (#F1EAE0) — no shimmer, no animation — matches the
// existing variationHero tone used in RemixSheet.
const previewSkeletonStyles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  hero: {
    width: '100%',
    height: 140,
    backgroundColor: '#F1EAE0',
  },
  body: {
    padding: 12,
    gap: 8,
  },
  titleBar: {
    height: 14,
    width: '70%',
    borderRadius: 4,
    backgroundColor: '#F1EAE0',
  },
  subtitleBar: {
    height: 10,
    width: '50%',
    borderRadius: 4,
    backgroundColor: '#F1EAE0',
  },
});
