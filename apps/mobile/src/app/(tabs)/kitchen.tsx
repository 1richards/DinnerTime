import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  View,
  Text,
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useNetworkStore } from '../../stores/networkStore';
import { useSuggestionsStore } from '../../stores/suggestionsStore';

import { SuggestionList } from '../../components/suggestions/SuggestionList';
import { HeroImage } from '../../components/ui/HeroImage';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { SearchBar } from '../../components/recipes/SearchBar';
import { SuggestedForYou } from '../../components/SuggestedForYou';
import {
  RecipeFilterSheet,
  EMPTY_FILTERS,
  countActiveFilters,
  type RecipeFilterState,
  type TimeFilter,
} from '../../components/recipes/RecipeFilterSheet';
import { FOOD_IMAGES } from '../../constants/foodImages';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
} from '../../components/ui/useCollapsingHeader';

import type { Recipe, ParsedIngredient } from '../../types/recipe';

// -----------------------------------------------------------------------------
// Segment type
// -----------------------------------------------------------------------------

type Segment = 'suggestions' | 'library';

// -----------------------------------------------------------------------------
// Stable hero image for the Suggestions segment (changes daily, not per render)
// -----------------------------------------------------------------------------

const HERO_URI = FOOD_IMAGES.hero[new Date().getDay() % FOOD_IMAGES.hero.length];

// -----------------------------------------------------------------------------
// Library filter helpers (copied verbatim from recipes.tsx)
// -----------------------------------------------------------------------------

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

const PANTRY_STAPLES = new Set([
  'salt',
  'pepper',
  'water',
  'oil',
  'olive oil',
  'vegetable oil',
  'butter',
  'sugar',
  'flour',
  'garlic powder',
  'onion powder',
]);

function matchesPantryOnly(r: Recipe, pantryNames: Set<string>): boolean {
  const ingredients = (r.ingredients ?? []) as ParsedIngredient[];
  if (ingredients.length === 0) return false;
  for (const ing of ingredients) {
    const name = normalize(ing.name ?? '');
    if (!name) continue;
    if (PANTRY_STAPLES.has(name)) continue;
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

// -----------------------------------------------------------------------------
// FABs
// -----------------------------------------------------------------------------

function ImportFab() {
  return (
    <Pressable
      onPress={() => router.push('/recipes/import')}
      style={styles.fab}
      accessibilityLabel="Import recipe"
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </Pressable>
  );
}

function RegenerateFab() {
  const onPress = () => {
    // NOTE: CONTEXT.md says `refreshSuggestions` — the store exports
    // `fetchSuggestions`. Use the real action.
    void useSuggestionsStore.getState().fetchSuggestions();
  };
  return (
    <Pressable
      onPress={onPress}
      style={styles.fab}
      accessibilityLabel="Regenerate suggestions"
    >
      <Ionicons name="sparkles" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Suggestions header (hero + greeting). Large title fades on scroll.
// -----------------------------------------------------------------------------

function SuggestionsHeader({
  displayName,
  largeTitleOpacity,
  largeTitleTranslate,
}: {
  displayName: string | null | undefined;
  largeTitleOpacity: Animated.AnimatedInterpolation<number>;
  largeTitleTranslate: Animated.AnimatedInterpolation<number>;
}) {
  const titleText = displayName ? `Hey, ${displayName}!` : 'Kitchen';
  const hero = (
    <HeroImage uri={HERO_URI} height={160}>
      <View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: -0.5,
          }}
          numberOfLines={1}
        >
          {titleText}
        </Text>
        <Text
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4 }}
        >
          What should we cook tonight?
        </Text>
      </View>
    </HeroImage>
  );

  return (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>{titleText}</Text>
        <Text style={styles.largeSubtitle}>What should we cook tonight?</Text>
      </View>
      {hero}
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function KitchenScreen() {
  // ---------- initial segment from route params ----------
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const initialSegment: Segment =
    params.segment === 'library' ? 'library' : 'suggestions';
  const [segment, setSegment] = useState<Segment>(initialSegment);

  // ---------- shared: auth, pantry bootstrap (Suggestions needs pantry) ----------
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const profileId = useAuthStore((s) => s.profile?.id);
  const pantryItems = usePantryStore((s) => s.items);
  const loadItems = usePantryStore((s) => s.loadItems);

  useEffect(() => {
    if (profileId && pantryItems.length === 0) {
      loadItems(profileId);
    }
  }, [profileId, pantryItems.length, loadItems]);

  // ---------- library state (all verbatim from recipes.tsx) ----------
  const { recipes, isLoading, fetchRecipes } = useRecipeStore();
  const ambitionSuggestions = useProgressionStore((s) => s.ambitionSuggestions);
  const fetchProgressionSuggestions = useProgressionStore((s) => s.fetchSuggestions);
  const fetchCookStats = useProgressionStore((s) => s.fetchCookStats);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Two separate collapsing-header instances — each segment owns its own
  // scrollY (Research Pitfall 5: don't share a single scroll value across
  // two lists).
  const suggestionsHeader = useCollapsingHeader();
  const libraryHeader = useCollapsingHeader();

  // Active header drives the compact top bar
  const activeCompactOpacity =
    segment === 'suggestions'
      ? suggestionsHeader.compactHeaderOpacity
      : libraryHeader.compactHeaderOpacity;

  // ---------- library fetches ----------
  useEffect(() => {
    if (!isOnline && recipes.length > 0) return;
    fetchRecipes({});
  }, [fetchRecipes, isOnline, recipes.length]);

  useEffect(() => {
    if (!filters.pantryOnly || pantryItems.length > 0) return;
    if (profileId) loadItems(profileId);
  }, [filters.pantryOnly, pantryItems.length, profileId, loadItems]);

  useEffect(() => {
    if (!isOnline) return;
    void fetchProgressionSuggestions();
    void fetchCookStats();
  }, [isOnline, fetchProgressionSuggestions, fetchCookStats]);

  // ---------- library filtering ----------
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

  // ---------- library list header (large title + SuggestedForYou + SearchBar) ----------
  const libraryListHeader = (
    <Animated.View
      style={{
        opacity: libraryHeader.largeTitleOpacity,
        transform: [{ translateY: libraryHeader.largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>Kitchen</Text>
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

  const handleCardPress = (recipe: Recipe) => {
    router.push(`/recipes/${recipe.id}`);
  };

  // ---------- render ----------
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar — fades in on scroll (active segment drives it) */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: activeCompactOpacity }]}
      >
        <Text style={styles.compactTitle}>Kitchen</Text>
      </Animated.View>

      {/* Action row (top-right): settings + library-only affordances */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />

        {segment === 'library' && (
          <>
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
          </>
        )}

        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={20} color="#3E332A" />
        </Pressable>
      </View>

      {/* Segmented control (custom Pressable pair — no native-module dep) */}
      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => setSegment('suggestions')}
          style={[
            styles.segment,
            segment === 'suggestions' && styles.segmentActive,
          ]}
          accessibilityLabel="Suggestions segment"
          accessibilityState={{ selected: segment === 'suggestions' }}
        >
          <Text
            style={[
              styles.segmentLabel,
              segment === 'suggestions' && styles.segmentLabelActive,
            ]}
          >
            Suggestions
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSegment('library')}
          style={[
            styles.segment,
            segment === 'library' && styles.segmentActive,
          ]}
          accessibilityLabel="Library segment"
          accessibilityState={{ selected: segment === 'library' }}
        >
          <Text
            style={[
              styles.segmentLabel,
              segment === 'library' && styles.segmentLabelActive,
            ]}
          >
            Library
          </Text>
        </Pressable>
      </View>

      {/* Both lists mounted in parallel; hide the inactive one with display:none
          so its scroll position, search, and filter state survive segment toggles. */}
      <View
        style={[
          { flex: 1 },
          segment !== 'suggestions' && { display: 'none' },
        ]}
        // Inactive lists don't need to be interactive
        pointerEvents={segment === 'suggestions' ? 'auto' : 'none'}
      >
        <SuggestionList
          HeaderComponent={
            <SuggestionsHeader
              displayName={displayName}
              largeTitleOpacity={suggestionsHeader.largeTitleOpacity}
              largeTitleTranslate={suggestionsHeader.largeTitleTranslate}
            />
          }
          onScroll={suggestionsHeader.onScroll}
        />
      </View>

      <View
        style={[
          { flex: 1 },
          segment !== 'library' && { display: 'none' },
        ]}
        pointerEvents={segment === 'library' ? 'auto' : 'none'}
      >
        <Animated.FlatList
          data={filteredRecipes}
          keyExtractor={(item: Recipe) => item.id}
          ListHeaderComponent={libraryListHeader}
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
          onScroll={libraryHeader.onScroll}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => fetchRecipes({})}
              tintColor="#F97316"
            />
          }
        />
      </View>

      {/* Modals */}
      <RecipeFilterSheet
        visible={filterSheetOpen}
        initial={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setFilters}
      />

      {/* FABs swap with segment */}
      {segment === 'library' && <ImportFab />}
      {segment === 'suggestions' && <RegenerateFab />}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles — pull in collapsingHeaderStyles and add segment + fab styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3EDE3', // warmGray-100
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#F97316',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5C4A38', // warmGray-700
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
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
});
