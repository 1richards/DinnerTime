import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionSkeleton } from './SuggestionSkeleton';
import { Button } from '../ui/Button';
import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { usePantryStore } from '../../stores/pantryStore';
import { FOOD_IMAGES } from '../../constants/foodImages';
import type { DinnerSuggestion } from '../../types/suggestions';

// Stable image for the pantry empty state
const PANTRY_EMPTY_IMAGE = FOOD_IMAGES.breakfast[0];
const READY_IMAGE = FOOD_IMAGES.hero[1]; // farmers market

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

  // Insufficient pantry — polished empty state with food photo
  if (!hasSufficientPantry) {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.photoCard}>
          <Image
            source={{ uri: PANTRY_EMPTY_IMAGE }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={400}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            cachePolicy="memory-disk"
          />
          {/* Dark overlay */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,10,5,0.42)' }]} />
          {/* Photo label */}
          <View style={styles.photoCardContent}>
            <Text style={styles.photoCardTag}>PANTRY EMPTY</Text>
            <Text style={styles.photoCardTitle}>Scan your fridge first</Text>
            <Text style={styles.photoCardSubtitle}>
              Add at least 3 items so we can suggest great dinners for you.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          <Button
            title="Go to Pantry"
            onPress={() => router.navigate('/(tabs)/pantry')}
          />
        </View>
      </View>
    );
  }

  // Ready to fetch — polished empty state
  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.photoCard}>
          <Image
            source={{ uri: READY_IMAGE }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={400}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            cachePolicy="memory-disk"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,10,5,0.42)' }]} />
          <View style={styles.photoCardContent}>
            <Text style={styles.photoCardTag}>AI-POWERED</Text>
            <Text style={styles.photoCardTitle}>Ready for dinner ideas?</Text>
            <Text style={styles.photoCardSubtitle}>
              Based on your pantry, we'll suggest meals your family will love.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          <Button title="Get Dinner Ideas" onPress={fetchSuggestions} />
        </View>
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

const styles = StyleSheet.create({
  emptyStateContainer: {
    flex: 1,
    paddingTop: 24,
  },
  photoCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    height: 240,
    overflow: 'hidden',
    backgroundColor: '#2A221A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  photoCardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  photoCardTag: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  photoCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  photoCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 19,
  },
});
