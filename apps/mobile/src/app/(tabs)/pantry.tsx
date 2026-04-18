import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { usePantryStore } from '../../stores/pantryStore';
import { useAuthStore } from '../../stores/authStore';
import { usePantryItems } from '../../hooks/usePantryItems';
import { EmptyPantry } from '../../components/pantry/EmptyPantry';
import { PantryItemList } from '../../components/pantry/PantryItemList';
import { BulkImportSheet } from '../../components/pantry/BulkImportSheet';
import type { SourceLocation } from '../../types/pantry';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';
import { colors } from '../../design/tokens';

type LocationFilter = 'all' | SourceLocation;

const FILTER_TABS: { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'freezer', label: 'Freezer' },
];

export default function PantryScreen() {
  const { loadItems, isLoading, items } = usePantryStore();
  const profile = useAuthStore((s) => s.profile);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [importSheetOpen, setImportSheetOpen] = useState(false);

  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
    useCollapsingHeader();

  const enrichedItems = usePantryItems(
    locationFilter === 'all' ? undefined : { location: locationFilter }
  );

  useEffect(() => {
    if (profile?.id) {
      loadItems(profile.id);
    }
  }, [profile?.id, loadItems]);

  const handleRefresh = useCallback(() => {
    if (profile?.id) {
      loadItems(profile.id);
    }
  }, [profile?.id, loadItems]);

  const availableItems = enrichedItems.filter((item) => item.status === 'available');

  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        <EmptyPantry />
      </SafeAreaView>
    );
  }

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
        <Text style={styles.largeSubtitle}>{availableItems.length} items</Text>
      </View>
      {filterRow}
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}
      >
        <Text style={styles.compactTitle}>Pantry</Text>
      </Animated.View>

      <PantryItemList
        items={availableItems}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        ListHeaderComponent={listHeader}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 140 }}
      />

      <Pressable
        onPress={() => setImportSheetOpen(true)}
        style={styles.fab}
        accessibilityLabel="Scan items"
      >
        <SymbolIcon name="camera.fill" size={28} tintColor="#FFFFFF" />
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
