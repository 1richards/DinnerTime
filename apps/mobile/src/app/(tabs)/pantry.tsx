import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePantryStore } from '../../stores/pantryStore';
import { useAuthStore } from '../../stores/authStore';
import { usePantryItems } from '../../hooks/usePantryItems';
import { EmptyPantry } from '../../components/pantry/EmptyPantry';
import { PantryItemList } from '../../components/pantry/PantryItemList';
import { ScanButton } from '../../components/pantry/ScanButton';
import type { SourceLocation } from '../../types/pantry';

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

  // Only show available items (optimistic updates may temporarily include used/depleted)
  const availableItems = enrichedItems.filter((item) => item.status === 'available');

  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        <EmptyPantry />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-2xl font-bold text-warmGray-900">My Kitchen</Text>
      </View>

      {/* Location filter tabs */}
      <View className="flex-row px-4 mb-2 gap-2">
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => setLocationFilter(tab.value)}
            className={`px-4 py-2 rounded-full ${
              locationFilter === tab.value
                ? 'bg-orange-500'
                : 'bg-warmGray-100'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                locationFilter === tab.value
                  ? 'text-white'
                  : 'text-warmGray-600'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Item list */}
      <PantryItemList
        items={availableItems}
        refreshing={isLoading}
        onRefresh={handleRefresh}
      />

      {/* Floating scan button */}
      <ScanButton />
    </SafeAreaView>
  );
}
