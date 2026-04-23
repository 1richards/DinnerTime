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
 * Card styling mirrors `apps/mobile/src/app/recipes/discover.tsx` so the
 * Something New grid visually matches the Discover surface.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';

import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { SuggestionSkeleton } from './SuggestionSkeleton';

import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { getRecipeImage } from '../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { colors } from '../../design/tokens';
import type { ParsedRecipe } from '../../types/recipe';

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

  const refresh = () => {
    // Regenerate with the same query args that produced the current list.
    void searchRecipes(lastQuery ?? '', { pantryOnly });
  };

  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
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
            style={({ pressed }) => [styles.toolbarBtn, pressed && styles.toolbarBtnPressed]}
          >
            <SymbolIcon name="arrow.clockwise" size={16} tintColor={colors.brand} />
            <Text style={styles.toolbarBtnText}>Refresh</Text>
          </Pressable>
          <Pressable
            onPress={() => clearHistory()}
            hitSlop={8}
            accessibilityLabel="Clear ideas"
            style={({ pressed }) => [styles.toolbarBtn, pressed && styles.toolbarBtnPressed]}
          >
            <SymbolIcon name="xmark.circle" size={16} tintColor={colors.textSecondary} />
            <Text style={[styles.toolbarBtnText, { color: colors.textSecondary }]}>
              Clear
            </Text>
          </Pressable>
        </View>
      </View>

      {searchResults.map((recipe, idx) => (
        <ResultCard
          key={`${recipe.title}-${idx}`}
          recipe={recipe}
          idx={idx}
          onPress={() => onRequestPreview(recipe)}
        />
      ))}
    </ScrollView>
  );
}

// ---------- Internal card (mirrors discover.tsx card styling) ----------

function ResultCard({
  recipe,
  idx,
  onPress,
}: {
  recipe: ParsedRecipe;
  idx: number;
  onPress: () => void;
}) {
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const fallbackUri = getRecipeImage(
    `something-new-${recipe.title}-${idx}`,
    recipe.image_url,
    recipe.title,
  );
  // Skip generation if we already have an image_url (imported recipes).
  const generatedUri = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
  });
  const heroUri = generatedUri ?? fallbackUri;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Image
        source={{ uri: heroUri }}
        style={styles.cardImage}
        contentFit="cover"
        transition={300}
        placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
        cachePolicy="memory-disk"
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {recipe.description}
          </Text>
        )}
        <View style={styles.cardMetaRow}>
          {totalTime > 0 && (
            <View style={styles.cardMetaItem}>
              <SymbolIcon name="clock" size={14} tintColor="#6B7280" />
              <Text style={styles.cardMetaText}>{totalTime} min</Text>
            </View>
          )}
          {recipe.servings != null && (
            <View style={styles.cardMetaItem}>
              <SymbolIcon name="person.2" size={14} tintColor="#6B7280" />
              <Text style={styles.cardMetaText}>{recipe.servings} servings</Text>
            </View>
          )}
          <View style={styles.cardMetaItem}>
            <SymbolIcon name="chevron.forward" size={16} tintColor={colors.brand} />
            <Text style={styles.cardCtaText}>View recipe</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 140,
  },
  resultsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
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
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  toolbarBtnPressed: {
    opacity: 0.6,
  },
  toolbarBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#2A221A',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#7A6651',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#7A6651',
  },
  cardCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
});
