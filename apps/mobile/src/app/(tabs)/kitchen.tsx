import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import {
  View,
  Text,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { useNetworkStore } from '../../stores/networkStore';
import { useSuggestionsStore } from '../../stores/suggestionsStore';

import { SuggestionList } from '../../components/suggestions/SuggestionList';
import { SomethingNewResults } from '../../components/suggestions/SomethingNewResults';
import { RecentQueryChips } from '../../components/suggestions/RecentQueryChips';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { InlineSearchPill } from '../../components/ui/SearchBar';
import { HeaderEllipsis } from '../../components/ui/HeaderEllipsis';
import { Button } from '../../components/ui/Button';
import { PreviewSheet } from '../recipes/discover';
import { getRecipeImage } from '../../constants/foodImages';
import {
  RecipeFilterSheet,
  EMPTY_FILTERS,
  countActiveFilters,
  type RecipeFilterState,
  type TimeFilter,
} from '../../components/recipes/RecipeFilterSheet';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
} from '../../components/ui/useCollapsingHeader';
import { colors } from '../../design/tokens';

import type { Recipe, ParsedIngredient, ParsedRecipe } from '../../types/recipe';

// -----------------------------------------------------------------------------
// Segment type
// -----------------------------------------------------------------------------

type Segment = 'suggestions' | 'library';

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
      <SymbolIcon name="plus" size={32} tintColor="#FFFFFF" />
    </Pressable>
  );
}

// Phase 17 D-06: the sparkles RegenerateFab was removed. Regenerate +
// Clear History moved to a HeaderEllipsis overflow menu on the Something
// New segment (see SomethingNewEllipsis below).

// -----------------------------------------------------------------------------
// First-time hint (CONTEXT D-08) — shown when no searchResults AND no
// recentQueries. Gives users a concrete on-ramp rather than a blank canvas.
// -----------------------------------------------------------------------------

function FirstTimeHint({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.firstTimeWrap}>
      <Text style={styles.firstTimeTitle}>Discover new dinner ideas</Text>
      <Text style={styles.firstTimeBody}>
        Tap the search bar above to explore, or start from your pantry.
      </Text>
      <View style={{ marginTop: 16 }}>
        <Button
          title="Get dinner ideas from my pantry"
          onPress={onStart}
          variant="outline"
        />
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Something New ellipsis overflow (CONTEXT D-06) — Regenerate + Clear History.
// Reads the store via useSuggestionsStore.getState() so the actions array
// can be inline-defined without re-rendering on every store change.
// -----------------------------------------------------------------------------

function SomethingNewEllipsis() {
  return (
    <HeaderEllipsis
      tintColor={colors.textPrimary}
      accessibilityLabel="More options"
      actions={[
        {
          label: 'Regenerate from pantry',
          onPress: () => {
            void useSuggestionsStore
              .getState()
              .searchRecipes('', { pantryOnly: true });
          },
        },
        {
          label: 'Clear search history',
          destructive: true,
          onPress: () => {
            useSuggestionsStore.getState().clearHistory();
          },
        },
      ]}
    />
  );
}

// -----------------------------------------------------------------------------
// Segmented control — rendered inside each list's ListHeaderComponent so it
// sits below the page header and scrolls with the content.
// -----------------------------------------------------------------------------

function SegmentedControl({
  segment,
  setSegment,
}: {
  segment: Segment;
  setSegment: (s: Segment) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      <Pressable
        onPress={() => setSegment('suggestions')}
        style={[
          styles.segment,
          segment === 'suggestions' && styles.segmentActive,
        ]}
        accessibilityLabel="Something New segment"
        accessibilityState={{ selected: segment === 'suggestions' }}
      >
        <Text
          style={[
            styles.segmentLabel,
            segment === 'suggestions' && styles.segmentLabelActive,
          ]}
        >{'Something New'}</Text>
      </Pressable>
      <Pressable
        onPress={() => setSegment('library')}
        style={[
          styles.segment,
          segment === 'library' && styles.segmentActive,
        ]}
        accessibilityLabel="Recipe Box segment"
        accessibilityState={{ selected: segment === 'library' }}
      >
        <Text
          style={[
            styles.segmentLabel,
            segment === 'library' && styles.segmentLabelActive,
          ]}
        >
          Recipe Box
        </Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Suggestions (Something New) header (hero + greeting + segmented control).
// Large title fades on scroll; segmented control scrolls with content.
// -----------------------------------------------------------------------------

function SuggestionsHeader({
  displayName,
  largeTitleOpacity,
  largeTitleTranslate,
  segment,
  setSegment,
}: {
  displayName: string | null | undefined;
  largeTitleOpacity: Animated.AnimatedInterpolation<number>;
  largeTitleTranslate: Animated.AnimatedInterpolation<number>;
  segment: Segment;
  setSegment: (s: Segment) => void;
}) {
  const titleText = displayName ? `Hey, ${displayName}!` : 'Kitchen';

  return (
    <View>
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
      </Animated.View>
      <InlineSearchPill placeholder="Search dinner ideas…" context="something-new" />
      <SegmentedControl segment={segment} setSegment={setSegment} />
    </View>
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
  const isOnline = useNetworkStore((s) => s.isOnline);

  // searchQuery retained as dead state for now — StickySearchPill taps out
  // to /search modal. Phase 17 will wire modal input back to this filter.
  const [searchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // ---------- Phase 17 suggestions (Something New) state ----------
  const searchResults = useSuggestionsStore((s) => s.searchResults);
  const recentQueries = useSuggestionsStore((s) => s.recentQueries);
  const pantryOnly = useSuggestionsStore((s) => s.pantryOnly);
  const suggestionsLoading = useSuggestionsStore((s) => s.isLoading);
  const searchRecipes = useSuggestionsStore((s) => s.searchRecipes);
  const autoFetchActive = useSuggestionsStore((s) => s.autoFetch);
  const legacySuggestions = useSuggestionsStore((s) => s.suggestions);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);

  const [previewRecipe, setPreviewRecipe] = useState<ParsedRecipe | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);
  const [cookingPreview, setCookingPreview] = useState(false);

  const hasResults = searchResults.length > 0;
  const hasHistory = recentQueries.length > 0;
  // D-10 preservation: SuggestionList (autoFetch + post-scan pantry-grounded
  // path) remains reachable as a fallback for first-time users who arrived via
  // the post-scan flow or already have legacy suggestions in memory.
  const hasLegacySuggestionsPath =
    autoFetchActive || legacySuggestions.length > 0;
  const showPhase17Results = hasResults || suggestionsLoading;
  const showFirstTimeHint =
    !showPhase17Results &&
    !hasHistory &&
    !suggestionsLoading &&
    !hasLegacySuggestionsPath;

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

  // ---------- library list header (large title + segmented control) ----------
  // Phase 19 Plan 05 deviation: inline SearchBar REMOVED — replaced by the
  // StickySearchPill mounted as an absolute-positioned sibling below. Tapping
  // the pill routes to /search?context=library (Phase 17 will wire results
  // back to this Library list). Local searchQuery state is preserved for now;
  // the in-header action row's search-toggle affordance is also removed.
  const libraryListHeader = (
    <View>
      <Animated.View
        style={{
          opacity: libraryHeader.largeTitleOpacity,
          transform: [{ translateY: libraryHeader.largeTitleTranslate }],
        }}
      >
        <View style={styles.largeHeader}>
          <Text style={styles.largeTitle}>Kitchen</Text>
          <Text style={styles.largeSubtitle}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your recipe box
          </Text>
        </View>
      </Animated.View>
      <InlineSearchPill placeholder="Search recipes" context="library" />
      <SegmentedControl segment={segment} setSegment={setSegment} />
      {/* Library filter toolbar — mirrors the Refresh/Clear row on Something
          New. Visible by default so users discover filtering without having
          to find the tiny floating icon. Active-filter count appears inline. */}
      <View style={styles.libraryToolbar}>
        <Text style={styles.resultsCount}>
          {filteredRecipes.length}{' '}
          {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
          {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}` : ''}
        </Text>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
            accessibilityLabel="Narrow your recipes"
            style={({ pressed }) => [
              styles.toolbarBtn,
              activeFilterCount > 0 && styles.toolbarBtnActive,
              pressed && styles.toolbarBtnPressed,
            ]}
          >
            <SymbolIcon
              name="line.3.horizontal.decrease.circle"
              size={16}
              tintColor={activeFilterCount > 0 ? '#FFFFFF' : colors.brand}
            />
            <Text
              style={[
                styles.toolbarBtnText,
                activeFilterCount > 0 && { color: '#FFFFFF' },
              ]}
            >
              Narrow results
            </Text>
          </Pressable>
          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => setFilters(EMPTY_FILTERS)}
              hitSlop={8}
              accessibilityLabel="Clear filters"
              style={({ pressed }) => [
                styles.toolbarBtn,
                pressed && styles.toolbarBtnPressed,
              ]}
            >
              <SymbolIcon
                name="xmark.circle"
                size={16}
                tintColor={colors.textSecondary}
              />
              <Text style={[styles.toolbarBtnText, { color: colors.textSecondary }]}>
                Clear
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const handleCardPress = (recipe: Recipe) => {
    router.push(`/recipes/${recipe.id}`);
  };

  // ---------- Phase 17 preview handlers ----------
  const handlePreviewSave = async () => {
    if (!previewRecipe) return;
    setSavingPreview(true);
    try {
      // Pitfall 9 preservation: stamp source_type: 'ai' on the saved recipe,
      // same as apps/mobile/src/app/recipes/discover.tsx handleSave().
      await saveRecipe({ ...previewRecipe, source_type: 'ai' });
      setPreviewRecipe(null);
    } finally {
      setSavingPreview(false);
    }
  };

  // Cook Now from the Something New preview: save the recipe, then navigate
  // into the cooking flow against the newly created recipe id.
  const handlePreviewCookNow = async () => {
    if (!previewRecipe) return;
    setCookingPreview(true);
    try {
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      await saveRecipe({ ...previewRecipe, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) return;
      const created = state.recipes.find((r) => !beforeIds.has(r.id));
      const cookId = created?.id ?? state.recipes[0]?.id;
      setPreviewRecipe(null);
      if (cookId) router.push(`/recipes/${cookId}/cook`);
    } finally {
      setCookingPreview(false);
    }
  };

  // ---------- render ----------
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      {/* Compact nav bar — fades in on scroll (active segment drives it) */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: activeCompactOpacity }]}
      >
        <Text style={styles.compactTitle}>Kitchen</Text>
      </Animated.View>

      {/* Top action row removed — Something New's ellipsis was redundant with
          the on-page Refresh/Clear toolbar, and Recipe Box's Discover sparkle
          was redundant with the Something New segment. Filter moved inline
          into the library list header below (libraryFilterToolbar). Clearing
          the row lets the large title float all the way to the top. */}

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
        {/* Phase 17 Something New surface. Render-tree priority:
             1. Phase 17 results (or loading) → SomethingNewResults
             2. Recent-query chips + first-time hint when user has no results
                yet but no active legacy path
             3. SuggestionList fallback — D-10 preserves the autoFetch /
                post-scan pantry-grounded flow unchanged.
         */}
        <Animated.ScrollView
          onScroll={suggestionsHeader.onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          <SuggestionsHeader
            displayName={displayName}
            largeTitleOpacity={suggestionsHeader.largeTitleOpacity}
            largeTitleTranslate={suggestionsHeader.largeTitleTranslate}
            segment={segment}
            setSegment={setSegment}
          />
          {hasHistory && (
            <RecentQueryChips
              queries={recentQueries}
              onSelect={(q) => {
                void searchRecipes(q, { pantryOnly });
              }}
            />
          )}
          {showPhase17Results ? (
            <SomethingNewResults
              onRequestPreview={(r) => setPreviewRecipe(r)}
            />
          ) : showFirstTimeHint ? (
            <FirstTimeHint
              onStart={() => {
                void searchRecipes('', { pantryOnly: true });
              }}
            />
          ) : (
            // D-10 fallback: legacy pantry-grounded SuggestionList. Covers
            // post-scan autoFetch + users with existing legacy suggestions.
            <SuggestionList />
          )}
        </Animated.ScrollView>
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
              <Text className="text-body text-text-secondary text-center">
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
              tintColor={colors.brand}
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

      {/* Phase 17 preview (P17-05) — tapped card shows PreviewSheet with
          Save to Library + Remix actions. Mounted at screen root so it sits
          above both segments. */}
      <Modal
        visible={previewRecipe !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewRecipe(null)}
      >
        {previewRecipe && (
          <PreviewSheet
            recipe={{ ...previewRecipe, _saved: false }}
            heroUri={getRecipeImage(
              `something-new-${previewRecipe.title}`,
              previewRecipe.image_url,
              previewRecipe.title,
            )}
            onClose={() => setPreviewRecipe(null)}
            onSave={handlePreviewSave}
            saving={savingPreview}
            onCookNow={handlePreviewCookNow}
            cooking={cookingPreview}
          />
        )}
      </Modal>

      {/* FABs swap with segment — Something New no longer has a FAB (D-06) */}
      {segment === 'library' && <ImportFab />}
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
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.brand,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
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
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  firstTimeWrap: {
    padding: 24,
    alignItems: 'center',
  },
  firstTimeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  firstTimeBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Library-side visible toolbar — mirrors SomethingNewResults' Refresh/Clear
  // styling so the two segments feel consistent. Active filter state fills
  // the button with the brand color for obvious on/off state.
  libraryToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 20,
    gap: 8,
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
    gap: 8,
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
  toolbarBtnActive: {
    backgroundColor: colors.brand,
  },
  toolbarBtnPressed: {
    opacity: 0.6,
  },
  toolbarBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand,
  },
});
