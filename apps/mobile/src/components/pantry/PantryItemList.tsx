import React, { useMemo, useCallback } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { PantryItemCard } from './PantryItemCard';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';

const CATEGORY_ORDER: string[] = [
  'produce', 'protein', 'dairy', 'grain', 'condiment',
  'beverage', 'frozen', 'snack', 'other',
];

interface PantryItemListProps {
  items: EnrichedPantryItem[];
  refreshing: boolean;
  onRefresh: () => void;
}

interface Section {
  title: string;
  count: number;
  data: EnrichedPantryItem[];
}

export function PantryItemList({ items, refreshing, onRefresh }: PantryItemListProps) {
  const sections: Section[] = useMemo(() => {
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
  }, [items]);

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
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#F97316"
        />
      }
      contentContainerStyle={{ paddingBottom: 100 }}
      stickySectionHeadersEnabled
    />
  );
}
