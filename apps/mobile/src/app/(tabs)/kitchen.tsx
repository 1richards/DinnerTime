import React, { useEffect, useMemo, useState, useDeferredValue, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { useNetworkStore } from '../../stores/networkStore';
import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';

import { SomethingNewResults } from '../../components/suggestions/SomethingNewResults';
import { RecentQueryChips } from '../../components/suggestions/RecentQueryChips';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { InlineSearchPill } from '../../components/ui/SearchBar';
import { HeaderEllipsis } from '../../components/ui/HeaderEllipsis';
import { Button } from '../../components/ui/Button';
import { PreviewSheet } from '../recipes/discover';
import { LabelsEditor } from '../../components/recipes/LabelsEditor';
import { getRecipeImage } from '../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import {
  prefetchHydration,
  previewFrom,
} from '../../hooks/useHydratedRecipeContent';
import { useRecipeStepImages } from '../../hooks/useRecipeStepImages';
import {
  RecipeFilterSheet,
  EMPTY_FILTERS,
  countActiveFilters,
  matchesCuisineFilter,
  matchesFoodTypeFilter,
  matchesLabelsFilter,
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

  // /search?context=library writes to useRecipeStore.searchQuery on submit
  // and navigates back here. Reading the store value directly keeps the
  // filter reactive across navigation cycles. The Recipe Box header shows
  // a "Clear search" affordance when this is non-empty.
  const searchQuery = useRecipeStore((s) => s.searchQuery);
  const setSearchQuery = useRecipeStore((s) => s.setSearchQuery);
  const deferredQuery = useDeferredValue(searchQuery);
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // ---------- Phase 17 suggestions (Something New) state ----------
  const searchResults = useSuggestionsStore((s) => s.searchResults);
  const suggestionsLoading = useSuggestionsStore((s) => s.isLoading);
  const searchRecipes = useSuggestionsStore((s) => s.searchRecipes);
  const autoFetchActive = useSuggestionsStore((s) => s.autoFetch);
  const setAutoFetch = useSuggestionsStore((s) => s.setAutoFetch);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);

  const [previewRecipe, setPreviewRecipe] = useState<ParsedRecipe | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);
  const [cookingPreview, setCookingPreview] = useState(false);
  const [cookingLaterPreview, setCookingLaterPreview] = useState(false);
  // Ad-hoc favorite state for the Something New PreviewSheet — flips
  // when the user taps the heart in the hero, which save+favorites the
  // recipe in one round-trip. Reset whenever a new recipe is opened.
  const [previewFavorited, setPreviewFavorited] = useState(false);
  const toggleFavoriteRecipe = useRecipeStore((s) => s.toggleFavorite);
  // Recipe Box card tap → modal preview (replaces /recipes/[id] push).
  const [savedDetail, setSavedDetail] = useState<Recipe | null>(null);
  const [savedDetailCookingLater, setSavedDetailCookingLater] = useState(false);
  const [savedDetailRemoving, setSavedDetailRemoving] = useState(false);
  const deleteRecipe = useRecipeStore((s) => s.deleteRecipe);

  // Mirror the same Gemini hook the Something New card uses so the preview
  // sheet hits the shared session+AsyncStorage cache and displays the EXACT
  // image the listing card is showing. Without this, the sheet falls through
  // to getRecipeImage's keyword stock and shows a different photo for the
  // same recipe.
  const { url: previewGeneratedUri } = useGeneratedRecipeImage(
    previewRecipe?.title ?? null,
    {
      skip: !!previewRecipe?.image_url,
      description: previewRecipe?.description ?? null,
      ingredients: previewRecipe?.ingredients ?? null,
    },
  );

  // D6 self-heal: when the sheet opens for an un-hydrated preview (e.g. a stale
  // persisted snapshot whose background hydration wasn't re-kicked), start
  // hydrating so the ingredient/step loaders resolve while the sheet is up.
  // prefetchHydration is no-op-cached, so this is cheap if already in flight.
  useEffect(() => {
    if (!previewRecipe) return;
    const unhydrated =
      previewRecipe.ingredients.length === 0 ||
      previewRecipe.steps.length === 0;
    if (unhydrated) void prefetchHydration(previewFrom(previewRecipe));
  }, [previewRecipe]);

  const hasResults = searchResults.length > 0;
  // Bug fix (bookmark-modal-differs-per-user): the legacy SuggestionList
  // fallback opened SuggestionPreviewModal — a degraded modal whose ONLY
  // action is "Add to Plan" (no Save / Cook / steps, because DinnerSuggestion
  // carries no steps). That made the Something New segment render two
  // different surfaces per account: accounts with persisted Phase-17
  // searchResults got the rich PreviewSheet; accounts arriving via the
  // post-scan autoFetch flow got the impoverished SuggestionPreviewModal.
  //
  // The post-scan pantry-grounded intent is now satisfied by the SAME
  // Phase-17 path: when autoFetch fires we run a pantry-only search (see the
  // effect below), which lands the user on SomethingNewResults → PreviewSheet
  // just like every other surface. The legacy SuggestionList is no longer
  // reachable from this screen, so all accounts converge on one experience.
  const showPhase17Results = hasResults || suggestionsLoading;

  // Two separate collapsing-header instances — each segment owns its own
  // scrollY (Research Pitfall 5: don't share a single scroll value across
  // two lists).
  const suggestionsHeader = useCollapsingHeader();
  const libraryHeader = useCollapsingHeader();

  // ---------- library fetches ----------
  // Fetch on mount (or when coming back online). `recipes.length` was
  // previously a dep, which caused a second redundant fetch whenever
  // the list grew (length change → effect re-runs). Now we only refetch
  // when the network state toggles or fetchRecipes identity changes.
  // The offline guard is preserved: skip the network call when offline
  // AND the cache already has data.
  const hasRecipeCache = recipes.length > 0;
  useEffect(() => {
    if (!isOnline && hasRecipeCache) return;
    fetchRecipes({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRecipes, isOnline]);

  useEffect(() => {
    if (!filters.pantryOnly || pantryItems.length > 0) return;
    if (profileId) loadItems(profileId);
  }, [filters.pantryOnly, pantryItems.length, profileId, loadItems]);

  // Post-scan handoff (scan/review.tsx sets autoFetch=true then routes here).
  // Bug fix (bookmark-modal-differs-per-user): previously this signal routed
  // users into the legacy SuggestionList → SuggestionPreviewModal surface.
  // Now we satisfy the same "ideas from my pantry" intent through the Phase-17
  // search so the user lands on the rich SomethingNewResults/PreviewSheet
  // surface — identical to every other account. We clear the flag first so
  // the search only fires once per post-scan navigation.
  useEffect(() => {
    if (!autoFetchActive) return;
    setAutoFetch(false);
    void searchRecipes('', { pantryOnly: true });
  }, [autoFetchActive, setAutoFetch, searchRecipes]);

  // ---------- library filtering ----------
  const pantryNames = useMemo(
    () => new Set(pantryItems.map((p) => normalize(p.name))),
    [pantryItems],
  );

  // Distinct labels across the user's library — drives the filter
  // sheet's label chip picker.
  const availableLabels = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) {
      for (const l of r.labels ?? []) set.add(l);
    }
    return Array.from(set).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = normalize(deferredQuery);
    return recipes.filter((r) => {
      if (filters.favoritesOnly && !r.is_favorite) return false;
      if (!matchesCuisineFilter(r, filters.cuisine)) return false;
      if (!matchesFoodTypeFilter(r, filters.foodType)) return false;
      if (!matchesLabelsFilter(r, filters.labels)) return false;
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
          {searchQuery.trim() ? ` · "${searchQuery.trim()}"` : ''}
          {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}` : ''}
        </Text>
        <View style={styles.toolbarActions}>
          {searchQuery.trim() && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
              style={({ pressed }) => [
                styles.filterIconBtn,
                pressed && styles.toolbarBtnPressed,
              ]}
            >
              <SymbolIcon
                name="xmark.circle.fill"
                size="action"
                tintColor={colors.textSecondary}
              />
            </Pressable>
          )}
          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => setFilters(EMPTY_FILTERS)}
              hitSlop={8}
              accessibilityLabel="Clear filters"
              style={({ pressed }) => [
                styles.filterIconBtn,
                pressed && styles.toolbarBtnPressed,
              ]}
            >
              <SymbolIcon
                name="xmark"
                size={18}
                weight="semibold"
                tintColor={colors.textSecondary}
              />
            </Pressable>
          )}
          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
            accessibilityLabel="Filter recipes"
            style={({ pressed }) => [
              styles.filterIconBtn,
              activeFilterCount > 0 && styles.filterIconBtnActive,
              pressed && styles.toolbarBtnPressed,
            ]}
          >
            <SymbolIcon
              name="line.3.horizontal.decrease"
              size={26}
              weight="semibold"
              tintColor={activeFilterCount > 0 ? '#FFFFFF' : colors.brand}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Recipe Box card tap opens the saved recipe in the same image-forward
  // PreviewSheet that Something New uses, instead of pushing to the
  // separate /recipes/[id] page. Deep links into /recipes/[id] still
  // work — that route remains for editing and shareable URLs.
  const handleCardPress = (recipe: Recipe) => {
    setSavedDetail(recipe);
  };

  // Stable renderItem for the Recipe Box FlatList — hoisted out of the inline
  // closure so it isn't recreated each parent render. Pairs with React.memo
  // on RecipeCard (Plan 27-02 Task 2) so off-screen/unaffected cards skip
  // re-render. windowing props on the FlatList bound how many of these mount.
  const renderRecipeCard = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard
        recipe={item}
        onPress={handleCardPress}
        onCookNow={(r) => router.push(`/recipes/${r.id}/cook`)}
      />
    ),
    [handleCardPress],
  );

  // ---------- Phase 17 preview handlers ----------

  // D5 (CRITICAL): a Something New preview can be un-hydrated (empty
  // ingredients/steps) when the user taps a save/cook/favorite/plan action.
  // `POST /recipes` and `addToPlan` need full content — an un-hydrated save
  // 400s. Await the in-flight hydration (the store patches `previewRecipe` as
  // it lands; this also covers a stale persisted snapshot whose hydration
  // wasn't re-kicked) and return a content-complete recipe, or null + alert if
  // it can't resolve. A no-op pass-through when already hydrated.
  const ensurePreviewHydrated = async (): Promise<ParsedRecipe | null> => {
    if (!previewRecipe) return null;
    const isHydrated =
      previewRecipe.ingredients.length > 0 && previewRecipe.steps.length > 0;
    if (isHydrated) return previewRecipe;
    const content = await prefetchHydration(previewFrom(previewRecipe));
    if (!content || !content.ingredients?.length || !content.steps?.length) {
      Alert.alert(
        'Still preparing',
        'This recipe is still loading — try again in a moment.',
      );
      return null;
    }
    return {
      ...previewRecipe,
      ingredients: content.ingredients,
      steps: content.steps,
      calories_per_serving:
        content.calories_per_serving ?? previewRecipe.calories_per_serving,
      protein_grams_per_serving:
        content.protein_grams_per_serving ??
        previewRecipe.protein_grams_per_serving,
      servings: content.servings ?? previewRecipe.servings,
    };
  };

  const handlePreviewSave = async () => {
    if (!previewRecipe) return;
    setSavingPreview(true);
    try {
      // D5: gate on hydration before the save POST.
      const safe = await ensurePreviewHydrated();
      if (!safe) return;
      // Pitfall 9 preservation: stamp source_type: 'ai' on the saved recipe,
      // same as apps/mobile/src/app/recipes/discover.tsx handleSave().
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      await saveRecipe({ ...safe, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        // Bail without redirecting; the user stays on the Something New
        // preview and the standard error path takes over.
        return;
      }
      // Land the user on the saved recipe in the Recipe Box so the save
      // immediately shows up in the destination it was saved to. Switch
      // the segment, close the Something New preview, then open the
      // SavedRecipeDetail modal for the freshly-created row.
      const created =
        state.recipes.find((r) => !beforeIds.has(r.id)) ?? state.recipes[0];
      setPreviewRecipe(null);
      setSegment('library');
      if (created) setSavedDetail(created);
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
      // D5: gate on hydration before the save POST.
      const safe = await ensurePreviewHydrated();
      if (!safe) return;
      const beforeIds = new Set(
        useRecipeStore.getState().recipes.map((r) => r.id),
      );
      await saveRecipe({ ...safe, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) return;
      // WR-05: resolve by id-diff, then fall back to a TITLE match against the
      // recipe just saved — NOT array position. The diff is empty on the dedup
      // branch (POST /recipes returns the existing row, adds no new id), and
      // state.recipes[0] is index 0 of the library, which can be an UNRELATED
      // recipe -> Cook Now would launch the wrong recipe's cook screen.
      const created =
        state.recipes.find((r) => !beforeIds.has(r.id)) ??
        state.recipes.find(
          (r) => normalize(r.title) === normalize(previewRecipe.title),
        );
      const cookId = created?.id;
      setPreviewRecipe(null);
      if (cookId) router.push(`/recipes/${cookId}/cook`);
    } finally {
      setCookingPreview(false);
    }
  };

  // ---------- render ----------
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      {/* Compact nav bar removed — large "Kitchen" / "Hey, {name}!" title
          scrolls off naturally to maximize vertical real estate. */}

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
             1. Phase 17 results (or loading) → SomethingNewResults → PreviewSheet
             2. First-time hint otherwise. The post-scan autoFetch handoff now
                runs a Phase-17 pantry search (see effect above) so it resolves
                to case 1, never the legacy SuggestionList. All accounts get
                the same rich preview experience.
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
          {/* Recent-query chips removed from this surface — historic
              searches now surface inside the search dialog instead, so
              they're available when users are about to type a new query
              rather than cluttering the results view. */}
          {showPhase17Results ? (
            <SomethingNewResults
              onRequestPreview={(r) => {
                setPreviewRecipe(r);
                // Mirror SomethingNewResults' title-match check so the
                // preview heart reflects whether a saved+favorited copy
                // of this suggestion already exists. Without this, a
                // card showing the filled heart opens a preview with
                // an empty heart — confusing state mismatch.
                const norm = (s: string) => s.trim().toLowerCase();
                const alreadyFavorited = useRecipeStore
                  .getState()
                  .recipes.some(
                    (saved) =>
                      norm(saved.title) === norm(r.title) &&
                      saved.is_favorite === true,
                  );
                setPreviewFavorited(alreadyFavorited);
              }}
            />
          ) : (
            // First-time / empty state. The legacy SuggestionList fallback
            // was removed (bookmark-modal-differs-per-user) because it opened
            // the degraded SuggestionPreviewModal. Both showFirstTimeHint and
            // the former legacy-path case now resolve to the same on-ramp,
            // which kicks off a Phase-17 pantry search → rich PreviewSheet.
            <FirstTimeHint
              onStart={() => {
                void searchRecipes('', { pantryOnly: true });
              }}
            />
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
          renderItem={renderRecipeCard}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
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
        availableLabels={availableLabels}
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
              previewRecipe.image_url ?? previewGeneratedUri,
              previewRecipe.title,
            )}
            onClose={() => {
              setPreviewRecipe(null);
              setPreviewFavorited(false);
            }}
            onSave={handlePreviewSave}
            saving={savingPreview}
            // D6: show ingredient/step loaders while a light preview hydrates.
            // The store patches previewRecipe.ingredients/steps as content lands
            // (Plan 29-03), so these flip false the moment hydration resolves.
            stepsLoading={previewRecipe.steps.length === 0}
            ingredientsLoading={previewRecipe.ingredients.length === 0}
            onCookNow={handlePreviewCookNow}
            cooking={cookingPreview}
            onCookLater={async (iso) => {
              if (!previewRecipe) return;
              setCookingLaterPreview(true);
              try {
                // D5: addToPlan persists the recipe — gate on hydration so an
                // un-hydrated preview can't land empty content in the plan.
                const safe = await ensurePreviewHydrated();
                if (!safe) return;
                await useMealPlanStore.getState().addToPlan(iso, safe, null);
                setPreviewRecipe(null);
                setPreviewFavorited(false);
              } finally {
                setCookingLaterPreview(false);
              }
            }}
            cookingLater={cookingLaterPreview}
            adHocFavorited={previewFavorited}
            onAdHocFavorite={async () => {
              if (!previewRecipe) return;
              // D5: gate on hydration before the save POST.
              const safe = await ensurePreviewHydrated();
              if (!safe) return;
              const beforeIds = new Set(
                useRecipeStore.getState().recipes.map((r) => r.id),
              );
              const heroUri =
                previewRecipe.image_url ?? previewGeneratedUri ?? null;
              const saved = await useRecipeStore
                .getState()
                .saveRecipe({
                  ...safe,
                  image_url: heroUri,
                  source_type: 'ai',
                });
              const state = useRecipeStore.getState();
              if (state.error) {
                Alert.alert('Save failed', state.error);
                return;
              }
              const target =
                saved ??
                state.recipes.find((r) => !beforeIds.has(r.id)) ??
                state.recipes.find(
                  (r) =>
                    r.title.trim().toLowerCase() ===
                    previewRecipe.title.trim().toLowerCase(),
                );
              if (target && !target.is_favorite) {
                await toggleFavoriteRecipe(target.id);
              }
              setPreviewFavorited(true);
            }}
          />
        )}
      </Modal>

      {/* Recipe Box detail — saved recipes open as the same image-forward
          PreviewSheet that Something New uses, with Cook Now / Cook Later
          on a single row at the bottom. Save is hidden because it's
          already in the library; Remix opens the existing flow. */}
      <Modal
        visible={savedDetail !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSavedDetail(null)}
      >
        {savedDetail && (
          <SavedRecipeDetail
            recipe={savedDetail}
            cookingLater={savedDetailCookingLater}
            removing={savedDetailRemoving}
            onClose={() => setSavedDetail(null)}
            onRemove={async () => {
              // Confirm before destructive — easy to accidentally delete a
              // recipe with the Cook Now button right next to Remove.
              const confirmed = await new Promise<boolean>((resolve) => {
                Alert.alert(
                  'Remove from library?',
                  `"${savedDetail.title}" will be deleted from your Recipe Box.`,
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
                  ],
                );
              });
              if (!confirmed) return;
              setSavedDetailRemoving(true);
              try {
                await deleteRecipe(savedDetail.id);
                setSavedDetail(null);
              } finally {
                setSavedDetailRemoving(false);
              }
            }}
            onCookNow={async () => {
              const id = savedDetail.id;
              setSavedDetail(null);
              router.push(`/recipes/${id}/cook`);
            }}
            onCookLater={async (iso) => {
              setSavedDetailCookingLater(true);
              try {
                await useMealPlanStore.getState().addToPlan(
                  iso,
                  {
                    title: savedDetail.title,
                    description: savedDetail.description,
                    ingredients: savedDetail.ingredients,
                    steps: savedDetail.steps,
                    prep_time_minutes: savedDetail.prep_time_minutes,
                    cook_time_minutes: savedDetail.cook_time_minutes,
                    total_time_minutes: savedDetail.total_time_minutes,
                    servings: savedDetail.servings,
                    source_url: savedDetail.source_url,
                    source_type: savedDetail.source_type,
                    image_url: savedDetail.image_url,
                  },
                  savedDetail.id,
                );
                setSavedDetail(null);
              } finally {
                setSavedDetailCookingLater(false);
              }
            }}
          />
        )}
      </Modal>

      {/* FABs swap with segment — Something New no longer has a FAB (D-06) */}
      {segment === 'library' && <ImportFab />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// SavedRecipeDetail — wraps PreviewSheet for Recipe Box modal entry. Lives
// in this file so the Gemini hook + recipe→ParsedRecipe shape conversion
// can be colocated with the kitchen tab's preview state.
// ---------------------------------------------------------------------------

interface SavedRecipeDetailProps {
  recipe: Recipe;
  cookingLater: boolean;
  removing: boolean;
  onClose: () => void;
  onCookNow: () => Promise<void>;
  onCookLater: (iso: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function SavedRecipeDetail({
  recipe: snapshotRecipe,
  cookingLater,
  removing,
  onClose,
  onCookNow,
  onCookLater,
  onRemove,
}: SavedRecipeDetailProps) {
  // Source the LIVE recipe row from the store by id so any field that
  // mutates (labels, is_favorite, etc.) reflects in the modal without
  // needing a close + reopen. Falls back to the snapshot the user
  // tapped in if the store lookup somehow misses (deleted concurrently).
  const liveRecipe = useRecipeStore((s) =>
    s.recipes.find((r) => r.id === snapshotRecipe.id),
  );
  const recipe = liveRecipe ?? snapshotRecipe;

  const { url: generatedUri } = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
    description: recipe.description,
    ingredients: recipe.ingredients,
  });
  const heroUri = getRecipeImage(
    `recipe-box-${recipe.id}`,
    recipe.image_url ?? generatedUri,
    recipe.title,
  );
  // Preparation-step photos — generated lazily in the background the first
  // time a saved recipe is opened, persisted to the row, and shown as a
  // slider (hero + steps). Returns existing URLs instantly on later opens.
  const { urls: stepImageUrls, loading: stepImagesLoading } =
    useRecipeStepImages(recipe);
  // Parsed shape PreviewSheet expects. _saved=false because the saved-state
  // path collapses to a "Saved to library + Done" footer with no Cook
  // actions — the wrong UX for a Recipe Box detail. We hide Save instead.
  const parsed: ParsedRecipe & { _saved: boolean } = {
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    total_time_minutes: recipe.total_time_minutes,
    servings: recipe.servings,
    source_url: recipe.source_url,
    source_type: recipe.source_type,
    image_url: recipe.image_url,
    // Per-serving nutrition — pass through so PreviewSheet's hero meta +
    // badge cluster render. Missing here previously meant Recipe Box
    // detail showed no kcal/protein even when the recipe row had them.
    calories_per_serving: recipe.calories_per_serving ?? null,
    protein_grams_per_serving: recipe.protein_grams_per_serving ?? null,
    fat_grams_per_serving: recipe.fat_grams_per_serving ?? null,
    _saved: false,
  };
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const labelsContent = (
    <LabelsEditor
      labels={recipe.labels ?? []}
      onChange={async (next) => {
        await updateRecipe(recipe.id, { labels: next });
      }}
    />
  );

  return (
    <PreviewSheet
      recipe={parsed}
      heroUri={heroUri}
      onClose={onClose}
      onSave={async () => undefined}
      saving={false}
      hideSave
      onCookNow={onCookNow}
      cooking={false}
      onCookLater={onCookLater}
      cookingLater={cookingLater}
      onRemove={onRemove}
      removing={removing}
      bodyExtra={labelsContent}
      recipeId={recipe.id}
      isFavorite={recipe.is_favorite ?? false}
      stepImageUrls={stepImageUrls}
      stepImagesLoading={stepImagesLoading}
    />
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
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  toolbarBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  toolbarBtnPressed: {
    opacity: 0.6,
  },
  toolbarBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand,
    lineHeight: 18,
  },
  // Icon-only filter button — matches the 36pt circular affordance pattern
  // used in nav action rows elsewhere. No label text because the 3-lines
  // glyph is a well-known UI-design standard for "filter".
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
