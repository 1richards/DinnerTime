import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRecipeStore } from '../../stores/recipeStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useNetworkStore } from '../../stores/networkStore';
import { usePantryStore } from '../../stores/pantryStore';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { SearchBar } from '../../components/recipes/SearchBar';
import { ChipToggle } from '../../components/ui/ChipToggle';
import { Button } from '../../components/ui/Button';
import { HeroImage } from '../../components/ui/HeroImage';
import { SuggestedForYou } from '../../components/SuggestedForYou';
import {
  RecipeFilterSheet,
  EMPTY_FILTERS,
  countActiveFilters,
  type RecipeFilterState,
  type SourceFilter,
  type TimeFilter,
} from '../../components/recipes/RecipeFilterSheet';
import type { Recipe, ParsedIngredient } from '../../types/recipe';

function recipeTime(r: Recipe): number {
  return (
    r.total_time_minutes ??
    (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0)
  );
}

function matchesTimeFilter(r: Recipe, t: TimeFilter): boolean {
  if (t === 'any') return true;
  const mins = recipeTime(r);
  if (mins === 0) return false;
  if (t === 'quick') return mins < 30;
  if (t === 'medium') return mins >= 30 && mins <= 60;
  return mins > 60;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * "Using items on hand" — a recipe passes if every ingredient that's
 * NOT a pantry-staple (salt, pepper, oil, water) appears in the pantry.
 * Lightweight substring match on normalized_name.
 */
const PANTRY_STAPLES = new Set([
  'salt', 'pepper', 'water', 'oil', 'olive oil', 'vegetable oil', 'butter',
  'sugar', 'flour', 'garlic powder', 'onion powder',
]);

function matchesPantryOnly(r: Recipe, pantryNames: Set<string>): boolean {
  const ingredients = (r.ingredients ?? []) as ParsedIngredient[];
  if (ingredients.length === 0) return false;
  for (const ing of ingredients) {
    const name = normalize(ing.name ?? '');
    if (!name) continue;
    if (PANTRY_STAPLES.has(name)) continue;
    // pass if ANY pantry item's name contains (or is contained in) this ingredient
    let matched = false;
    for (const p of pantryNames) {
      if (p.includes(name) || name.includes(p)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

import { FOOD_IMAGES } from '../../constants/foodImages';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
  COLLAPSED_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';

const EMPTY_STATE_IMG = FOOD_IMAGES.pasta[0];

function ImportFab() {
  return (
    <Pressable
      onPress={() => router.push('/recipes/import')}
      style={styles.fab}
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </Pressable>
  );
}

export default function RecipesScreen() {
  const { recipes, isLoading, fetchRecipes, error } = useRecipeStore();
  const ambitionSuggestions = useProgressionStore((s) => s.ambitionSuggestions);
  const fetchSuggestions = useProgressionStore((s) => s.fetchSuggestions);
  const fetchCookStats = useProgressionStore((s) => s.fetchCookStats);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const pantryItems = usePantryStore((s) => s.items);
  const loadPantry = usePantryStore((s) => s.loadItems);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Animated scroll position for the collapsing header.
  const { scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } = useCollapsingHeader();

  // Single fetch of the full library on mount/refresh. All filtering
  // happens client-side via useMemo below — no round-trips per toggle.
  useEffect(() => {
    if (!isOnline && recipes.length > 0) return;
    fetchRecipes({});
  }, [fetchRecipes, isOnline, recipes.length]);

  // Lazy pantry load when the pantry-only filter is first used.
  useEffect(() => {
    if (!filters.pantryOnly || pantryItems.length > 0) return;
    const auth = require('../../stores/authStore').useAuthStore.getState();
    if (auth?.profile?.id) loadPantry(auth.profile.id);
  }, [filters.pantryOnly, pantryItems.length, loadPantry]);

  const pantryNames = useMemo(
    () => new Set(pantryItems.map((p) => normalize(p.name))),
    [pantryItems],
  );

  const filteredRecipes = useMemo(() => {
    const q = normalize(deferredQuery);
    return recipes.filter((r) => {
      if (filters.favoritesOnly && !r.is_favorite) return false;
      if (filters.source !== 'all' && r.source_type !== filters.source) return false;
      if (!matchesTimeFilter(r, filters.time)) return false;
      if (filters.pantryOnly && !matchesPantryOnly(r, pantryNames)) return false;
      if (q) {
        const hay = normalize(r.title) + ' ' + normalize(r.description ?? '');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recipes, filters, pantryNames, deferredQuery]);

  const activeFilterCount = countActiveFilters(filters);

  // Phase 10: skill progression
  useEffect(() => {
    if (!isOnline) return;
    void fetchSuggestions();
    void fetchCookStats();
  }, [isOnline, fetchSuggestions, fetchCookStats]);

  const handleCardPress = (recipe: Recipe) => {
    router.push(`/recipes/${recipe.id}`);
  };

  // Large-title hero content that scrolls away. No hero image, no fixed
  // 140px banner — that was eating real estate without informing. Just a
  // title, subtitle, and the skill-progression row.
  const listHeader = (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>Recipes</Text>
        <Text style={styles.largeSubtitle}>
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your library
        </Text>
      </View>
      <SuggestedForYou suggestions={ambitionSuggestions} />
      {searchOpen && (
        <View style={styles.searchRow}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </View>
      )}
    </Animated.View>
  );

  if (isLoading && recipes.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">
          Loading recipes...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    !isLoading &&
    recipes.length === 0 &&
    !deferredQuery &&
    activeFilterCount === 0
  ) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        {/* Hero banner at top */}
        <HeroImage uri={EMPTY_STATE_IMG} height={200}>
          <Text style={styles.heroBannerTitle}>My Recipes</Text>
          <Text style={styles.heroBannerSub}>Start building your collection</Text>
        </HeroImage>

        <View style={styles.emptyStateBody}>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySubtitle}>
            Import your first recipe from a URL, photo, or paste some text.
          </Text>
          <Button
            title="Import Your First Recipe"
            onPress={() => router.push('/recipes/import')}
          />
          {error && (
            <Text className="text-sm text-red-600 mt-4">{error}</Text>
          )}
        </View>
        <ImportFab />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Floating compact nav bar — fades in on scroll */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}
      >
        <Text style={styles.compactTitle}>Recipes</Text>
      </Animated.View>

      {/* Always-on action row (search, filters, discover) — sits on top of
          both the large title and the compact title so it stays tappable. */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setSearchOpen((v) => !v)}
          style={[styles.actionBtn, searchOpen && styles.actionBtnActive]}
          hitSlop={8}
          accessibilityLabel="Toggle search"
        >
          <Ionicons
            name={searchOpen ? 'close' : 'search'}
            size={20}
            color={searchOpen ? '#FFFFFF' : '#3E332A'}
          />
        </Pressable>
        <Pressable
          onPress={() => setFilterSheetOpen(true)}
          style={[
            styles.actionBtn,
            activeFilterCount > 0 && styles.actionBtnActive,
          ]}
          hitSlop={8}
          accessibilityLabel="Open filters"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? '#FFFFFF' : '#3E332A'}
          />
          {activeFilterCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push('/recipes/discover')}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Discover recipes"
        >
          <Ionicons name="sparkles" size={20} color="#B45309" />
        </Pressable>
      </View>

      <Animated.FlatList
        data={filteredRecipes}
        keyExtractor={(item: Recipe) => item.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }: { item: Recipe }) => (
          <RecipeCard recipe={item} onPress={handleCardPress} />
        )}
        ListEmptyComponent={
          <View className="items-center mt-12 px-6">
            <Text className="text-base text-warmGray-500 text-center">
              {activeFilterCount > 0
                ? 'No recipes match your filters.'
                : deferredQuery
                  ? 'No recipes match your search.'
                  : 'No recipes yet.'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 140 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchRecipes({})}
            tintColor="#F97316"
          />
        }
      />

      <RecipeFilterSheet
        visible={filterSheetOpen}
        initial={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setFilters}
      />

      <ImportFab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  heroBannerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroBannerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  emptyStateBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#7A6651',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});
