import React, { useEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionSkeleton } from './SuggestionSkeleton';
import { Button } from '../ui/Button';
import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { usePantryStore } from '../../stores/pantryStore';
import type { DinnerSuggestion } from '../../types/suggestions';

export function SuggestionList() {
  const suggestions = useSuggestionsStore((s) => s.suggestions);
  const isLoading = useSuggestionsStore((s) => s.isLoading);
  const error = useSuggestionsStore((s) => s.error);
  const fetchSuggestions = useSuggestionsStore((s) => s.fetchSuggestions);
  const autoFetch = useSuggestionsStore((s) => s.autoFetch);
  const setAutoFetch = useSuggestionsStore((s) => s.setAutoFetch);
  const pantryItems = usePantryStore((s) => s.items);

  const hasSufficientPantry = pantryItems.length >= 3;

  // Auto-fetch when navigated from scan review
  useEffect(() => {
    if (autoFetch && hasSufficientPantry && !isLoading) {
      setAutoFetch(false);
      fetchSuggestions();
    }
  }, [autoFetch, hasSufficientPantry, isLoading, setAutoFetch, fetchSuggestions]);

  // Loading state
  if (isLoading) {
    return (
      <View className="px-4 pt-4">
        <Text className="text-base font-semibold text-warmGray-700 mb-3">
          Finding dinner ideas...
        </Text>
        <SuggestionSkeleton />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">😕</Text>
        <Text className="text-lg font-bold text-warmGray-900 mb-2">
          Something went wrong
        </Text>
        <Text className="text-sm text-warmGray-500 text-center mb-4">
          {error}
        </Text>
        <Button title="Try Again" onPress={fetchSuggestions} />
      </View>
    );
  }

  // Insufficient pantry state
  if (!hasSufficientPantry) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">📸</Text>
        <Text className="text-lg font-bold text-warmGray-900 mb-2">
          Scan your fridge first
        </Text>
        <Text className="text-sm text-warmGray-500 text-center mb-4">
          Add at least 3 items to your pantry so we can suggest great dinners for you.
        </Text>
        <Button
          title="Go to Pantry"
          onPress={() => router.navigate('/(tabs)/pantry')}
        />
      </View>
    );
  }

  // Empty state (no suggestions fetched yet)
  if (suggestions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🍽️</Text>
        <Text className="text-lg font-bold text-warmGray-900 mb-2">
          Ready for dinner ideas?
        </Text>
        <Text className="text-sm text-warmGray-500 text-center mb-4">
          Based on what's in your pantry, we'll suggest delicious dinners your family will love.
        </Text>
        <Button title="Get Dinner Ideas" onPress={fetchSuggestions} />
      </View>
    );
  }

  // Data state
  const renderItem = ({ item }: { item: DinnerSuggestion }) => (
    <SuggestionCard suggestion={item} />
  );

  return (
    <FlatList
      data={suggestions}
      keyExtractor={(item, index) => `${item.title}-${index}`}
      renderItem={renderItem}
      contentContainerClassName="px-4 pt-4 pb-8"
      ListHeaderComponent={
        <Text className="text-base font-semibold text-warmGray-700 mb-3">
          Tonight's suggestions
        </Text>
      }
      ListFooterComponent={
        <View className="mt-2 mb-4">
          <Button
            title="Get New Ideas"
            variant="outline"
            onPress={fetchSuggestions}
          />
        </View>
      }
    />
  );
}
