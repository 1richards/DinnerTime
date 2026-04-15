import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { FOOD_IMAGES } from '../../constants/foodImages';
import type { Recipe, ParsedIngredient } from '../../types/recipe';

type SourceFilter = 'all' | 'url' | 'photo' | 'manual' | 'ai';
type TimeFilter = 'any' | 'quick' | 'medium' | 'long';

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: 'Any source',
  url: 'From URL',
  photo: 'From photo',
  manual: 'Typed',
  ai: 'AI-discovered',
};

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  any: 'Any time',
  quick: 'Under 30 min',
  medium: '30–60 min',
  long: 'Over 60 min',
};

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

// Stable hero for the recipes banner
const RECIPES_HERO = FOOD_IMAGES.bakedGoods[0];
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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [pantryOnly, setPantryOnly] = useState(false);

  // Single fetch of the full library on mount/refresh. All filtering
  // happens client-side via useMemo below — no round-trips per toggle.
  useEffect(() => {
    if (!isOnline && recipes.length > 0) return;
    fetchRecipes({});
  }, [fetchRecipes, isOnline, recipes.length]);

  // Lazy pantry load when the pantry-only filter is first used.
  useEffect(() => {
    if (!pantryOnly || pantryItems.length > 0) return;
    // Pull profile_id from auth store indirectly via pantry loader.
    const auth = require('../../stores/authStore').useAuthStore.getState();
    if (auth?.profile?.id) loadPantry(auth.profile.id);
  }, [pantryOnly, pantryItems.length, loadPantry]);

  const pantryNames = useMemo(
    () => new Set(pantryItems.map((p) => normalize(p.name))),
    [pantryItems],
  );

  const filteredRecipes = useMemo(() => {
    const q = normalize(deferredQuery);
    return recipes.filter((r) => {
      if (showFavoritesOnly && !r.is_favorite) return false;
      if (sourceFilter !== 'all' && r.source_type !== sourceFilter) return false;
      if (!matchesTimeFilter(r, timeFilter)) return false;
      if (pantryOnly && !matchesPantryOnly(r, pantryNames)) return false;
      if (q) {
        const hay = normalize(r.title) + ' ' + normalize(r.description ?? '');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    recipes,
    showFavoritesOnly,
    sourceFilter,
    timeFilter,
    pantryOnly,
    pantryNames,
    deferredQuery,
  ]);

  const activeFilterCount =
    (showFavoritesOnly ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (timeFilter !== 'any' ? 1 : 0) +
    (pantryOnly ? 1 : 0);

  // Phase 10: skill progression
  useEffect(() => {
    if (!isOnline) return;
    void fetchSuggestions();
    void fetchCookStats();
  }, [isOnline, fetchSuggestions, fetchCookStats]);

  const handleCardPress = (recipe: Recipe) => {
    router.push(`/recipes/${recipe.id}`);
  };

  const header = (
    <View className="pt-2 pb-3">
      {/* Hero banner */}
      <HeroImage uri={RECIPES_HERO} height={140} style={{ marginBottom: 0 }}>
        <View>
          <Text style={styles.heroBannerTitle}>My Recipes</Text>
          <Text style={styles.heroBannerSub}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your library
          </Text>
        </View>
      </HeroImage>

      <SuggestedForYou suggestions={ambitionSuggestions} />
      <View className="px-4 pt-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        {/* Filter row 1: primary toggles + Discover link */}
        <View className="flex-row items-center gap-2 mt-3">
          <ChipToggle
            label="♥ Favorites"
            selected={showFavoritesOnly}
            onToggle={() => setShowFavoritesOnly((v) => !v)}
            colorScheme="red"
          />
          <ChipToggle
            label="From pantry"
            selected={pantryOnly}
            onToggle={() => setPantryOnly((v) => !v)}
            colorScheme="orange"
          />
          <Pressable
            onPress={() => router.push('/recipes/discover')}
            className="flex-row items-center px-4 py-2 rounded-full bg-amber-100 border border-amber-200"
          >
            <Ionicons name="sparkles" size={14} color="#B45309" />
            <Text className="text-sm font-medium text-amber-800 ml-1">
              Discover
            </Text>
          </Pressable>
        </View>

        {/* Filter row 2: scrollable source + time pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 2 }}
        >
          {(['all', 'url', 'photo', 'manual', 'ai'] as SourceFilter[]).map((f) => (
            <Pressable
              key={`src-${f}`}
              onPress={() => setSourceFilter(f)}
              className={`px-3 py-1.5 rounded-full border ${
                sourceFilter === f
                  ? 'bg-orange-500 border-orange-500'
                  : 'bg-white border-warmGray-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  sourceFilter === f ? 'text-white' : 'text-warmGray-600'
                }`}
              >
                {SOURCE_FILTER_LABELS[f]}
              </Text>
            </Pressable>
          ))}
          <View style={{ width: 6 }} />
          {(['any', 'quick', 'medium', 'long'] as TimeFilter[]).map((t) => (
            <Pressable
              key={`time-${t}`}
              onPress={() => setTimeFilter(t)}
              className={`px-3 py-1.5 rounded-full border ${
                timeFilter === t
                  ? 'bg-orange-500 border-orange-500'
                  : 'bg-white border-warmGray-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  timeFilter === t ? 'text-white' : 'text-warmGray-600'
                }`}
              >
                {TIME_FILTER_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeFilterCount > 0 && (
          <Pressable
            onPress={() => {
              setShowFavoritesOnly(false);
              setSourceFilter('all');
              setTimeFilter('any');
              setPantryOnly(false);
            }}
            className="mt-2 self-start"
          >
            <Text className="text-xs font-semibold text-orange-600">
              Clear filters ({activeFilterCount})
            </Text>
          </Pressable>
        )}
      </View>
    </View>
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
    !showFavoritesOnly
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
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={handleCardPress} />
        )}
        ListEmptyComponent={
          <View className="items-center mt-12 px-6">
            <Text className="text-base text-warmGray-500 text-center">
              {showFavoritesOnly
                ? 'No favorites yet. Tap the heart on a recipe to favorite it.'
                : 'No recipes match your search.'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchRecipes({})}
            tintColor="#F97316"
          />
        }
      />

      <ImportFab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
