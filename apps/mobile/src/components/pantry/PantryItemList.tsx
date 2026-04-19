import React, { useMemo, useCallback } from 'react';
import { View, Text, SectionList, RefreshControl, Animated } from 'react-native';
import { PantryItemCard } from './PantryItemCard';
import { colors } from '../../design/tokens';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import type { PantrySection } from '../../hooks/usePantryItemsGrouped';

const CATEGORY_ORDER: string[] = [
  'produce', 'protein', 'dairy', 'grain', 'condiment',
  'beverage', 'frozen', 'snack', 'other',
];

interface PantryItemListProps {
  items: EnrichedPantryItem[];
  refreshing: boolean;
  onRefresh: () => void;
  ListHeaderComponent?: React.ReactElement;
  onScroll?: ReturnType<typeof Animated.event>;
  scrollEventThrottle?: number;
  contentContainerStyle?: object;
  /**
   * Phase 21-04 — pre-grouped sections. When provided, the list renders these
   * sections verbatim; `items` is ignored. When omitted, the legacy category-
   * grouping path runs (backward compat for any consumer that still hands in a
   * flat items array).
   */
  sections?: PantrySection[];
}

interface Section {
  title: string;
  count: number;
  data: EnrichedPantryItem[];
}

export function PantryItemList({
  items,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  onScroll,
  scrollEventThrottle,
  contentContainerStyle,
  sections: externalSections,
}: PantryItemListProps) {
  const sections: Section[] = useMemo(() => {
    // Phase 21-04: if the caller hands us pre-grouped sections, adapt them to
    // the SectionList shape (title + count + data). Skip the category bucket.
    if (externalSections) {
      return externalSections.map((s) => ({
        title: s.title,
        count: s.items.length,
        data: s.items,
      }));
    }

    const grouped = new Map<string, EnrichedPantryItem[]>();

    for (const item of items) {
      const existing = grouped.get(item.category) ?? [];
      existing.push(item);
      grouped.set(item.category, existing);
    }

    return CATEGORY_ORDER
      .filter((cat) => grouped.has(cat))
      .map((cat) => ({
        title: cat.charAt(0).toUpperCase() + cat.slice(1),
        count: grouped.get(cat)!.length,
        data: grouped.get(cat)!,
      }));
  }, [items, externalSections]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View className="flex-row items-center justify-between px-4 py-2 bg-warmWhite">
        <Text className="text-sm font-semibold text-warmGray-600 uppercase tracking-wide">
          {section.title}
        </Text>
        <Text className="text-xs text-warmGray-400">
          {section.count} {section.count === 1 ? 'item' : 'items'}
        </Text>
      </View>
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: EnrichedPantryItem }) => (
      <PantryItemCard item={item} />
    ),
    []
  );

  return (
    <Animated.SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
        />
      }
      contentContainerStyle={contentContainerStyle ?? { paddingBottom: 100 }}
      stickySectionHeadersEnabled
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
    />
  );
}
