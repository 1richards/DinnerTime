import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { InlineSearchPill } from '../../components/ui/SearchBar';
import { usePantryStore } from '../../stores/pantryStore';
import { useAuthStore } from '../../stores/authStore';
import { usePantryItems } from '../../hooks/usePantryItems';
import {
  usePantryItemsGrouped,
  type GroupingMode,
} from '../../hooks/usePantryItemsGrouped';
import { EmptyPantry } from '../../components/pantry/EmptyPantry';
import { PantryItemList } from '../../components/pantry/PantryItemList';
import { BulkImportSheet } from '../../components/pantry/BulkImportSheet';
import type { SourceLocation } from '../../types/pantry';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
} from '../../components/ui/useCollapsingHeader';
import { colors } from '../../design/tokens';

/**
 * Phase 21-04 — Pantry-tab presentation layer.
 *
 * Changes over Phase 19 pantry.tsx:
 *   1. GroupingMode segmented control (Location / Category / Staples / Recent)
 *      — rendered as single-row equal-width pressables (RESEARCH Pitfall 7:
 *      avoids chip wrap on narrow iPhones). State persisted via pantryStore.
 *   2. StickySearchPill (Phase 19-03 primitive) wired with context='pantry'
 *      → navigates to /search?context=pantry modal on tap.
 *   3. Filter chip row gains 'Staples' alongside All/Fridge/Pantry/Freezer.
 *      When Staples is selected, only items whose canonical_ingredient_id is
 *      in the user's staples Set render.
 *   4. loadStaples() fires on mount so the Set is populated for filtering +
 *      scan-accept threshold resolution.
 *   5. Items are rendered through usePantryItemsGrouped, producing sections
 *      per the active grouping mode; PantryItemList accepts the sections prop.
 */

type LocationFilter = 'all' | SourceLocation | 'staples';

const FILTER_TABS: { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'staples', label: 'Staples' },
];

// Simplified to just Category + Recent. Location + Staples were removed
// from the primary organization axis per user feedback — they lived too
// close to the FILTER_TABS above (which already expose location chips) and
// the resulting 4-tab row read as redundant. The underlying GroupingMode
// type still supports 'location' / 'staples' because usePantryItemsGrouped
// branches on it; we just don't surface those modes here anymore.
const GROUPING_TABS: { value: GroupingMode; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'recently-added', label: 'Recent' },
];

export default function PantryScreen() {
  const {
    loadItems,
    isLoading,
    items,
    staples,
    loadStaples,
    groupingMode,
    setGroupingMode,
  } = usePantryStore();
  const profile = useAuthStore((s) => s.profile);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [importSheetOpen, setImportSheetOpen] = useState(false);

  const {
    onScroll,
    largeTitleOpacity,
    largeTitleTranslate,
  } = useCollapsingHeader();

  // Enriched items (confidence decay + isUncertain derivation). Location
  // filter happens at the enrichment layer for 'fridge' | 'pantry' | 'freezer';
  // the Staples filter is applied in a secondary memo below because staples
  // are keyed by canonical_ingredient_id (not source_location).
  const enrichedItems = usePantryItems(
    locationFilter === 'all' || locationFilter === 'staples'
      ? undefined
      : { location: locationFilter },
  );

  useEffect(() => {
    if (profile?.id) {
      loadItems(profile.id);
    }
  }, [profile?.id, loadItems]);

  // Migrate any persisted groupingMode that's no longer surfaced as a tab
  // (location, staples) to the nearest supported option. Without this, the
  // visible tab row would show no active selection for users who persisted
  // one of the removed modes.
  useEffect(() => {
    if (groupingMode === 'location' || groupingMode === 'staples') {
      setGroupingMode('category');
    }
  }, [groupingMode, setGroupingMode]);

  // Fire once on tab mount — staples Set drives both the filter chip and the
  // scan-accept threshold. loadStaples is idempotent: failures leave the Set
  // empty, which degrades gracefully (items just never get the 0.3 reprieve).
  useEffect(() => {
    void loadStaples().catch(() => {
      /* best-effort; network failure shouldn't break pantry */
    });
  }, [loadStaples]);

  const handleRefresh = useCallback(() => {
    if (profile?.id) {
      loadItems(profile.id);
    }
  }, [profile?.id, loadItems]);

  // Available + Staples-chip filter. Keep this derivation lightweight — the
  // heavier grouping step below is the performance-sensitive memo.
  const filteredAvailable = useMemo(() => {
    const available = enrichedItems.filter((item) => item.status === 'available');
    if (locationFilter !== 'staples') return available;
    return available.filter(
      (item) =>
        item.canonical_ingredient_id && staples.has(item.canonical_ingredient_id),
    );
  }, [enrichedItems, locationFilter, staples]);

  const sections = usePantryItemsGrouped(filteredAvailable, groupingMode, staples);

  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        <EmptyPantry />
      </SafeAreaView>
    );
  }

  const groupingRow = (
    <View className="flex-row mx-4 mb-2 rounded-lg overflow-hidden border border-warmGray-200">
      {GROUPING_TABS.map((tab) => {
        const active = groupingMode === tab.value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => setGroupingMode(tab.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Group by ${tab.label}`}
            className={`flex-1 items-center py-2 ${
              active ? 'bg-brand' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-caption ${
                active ? 'text-white font-semibold' : 'text-text-primary'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const filterRow = (
    <View className="flex-row px-4 mb-2 gap-2">
      {FILTER_TABS.map((tab) => (
        <Pressable
          key={tab.value}
          onPress={() => setLocationFilter(tab.value)}
          className={`px-4 py-2 rounded-full ${
            locationFilter === tab.value ? 'bg-brand' : 'bg-warmGray-100'
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              locationFilter === tab.value ? 'text-white' : 'text-warmGray-600'
            }`}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const listHeader = (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>Pantry</Text>
        <Text style={styles.largeSubtitle}>{filteredAvailable.length} items</Text>
      </View>
      <InlineSearchPill placeholder="Search pantry" context="pantry" />
      {groupingRow}
      {filterRow}
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar removed — large "Pantry" title scrolls off naturally
          so the list consumes full vertical real estate. Search moved inline
          into listHeader below the large title. */}

      <PantryItemList
        items={filteredAvailable}
        sections={sections}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        ListHeaderComponent={listHeader}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 140 }}
      />

      <Pressable
        onPress={() => setImportSheetOpen(true)}
        style={styles.fab}
        accessibilityLabel="Add items to pantry"
      >
        <SymbolIcon name="plus" size={30} weight="bold" tintColor="#FFFFFF" />
      </Pressable>

      <BulkImportSheet
        visible={importSheetOpen}
        onClose={() => setImportSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
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
});
