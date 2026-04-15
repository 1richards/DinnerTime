import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionSkeleton } from './SuggestionSkeleton';
import { SuggestionPreviewModal } from './SuggestionPreviewModal';
import { Button } from '../ui/Button';
import { useSuggestionsStore } from '../../stores/suggestionsStore';
import { usePantryStore } from '../../stores/pantryStore';
import { FOOD_IMAGES } from '../../constants/foodImages';
import type { DinnerSuggestion } from '../../types/suggestions';

// Stable image for the pantry empty state
const PANTRY_EMPTY_IMAGE = FOOD_IMAGES.breakfast[0];
const READY_IMAGE = FOOD_IMAGES.hero[1]; // farmers market

interface SuggestionListProps {
  /**
   * Optional header rendered above the suggestions. When provided, the
   * header scrolls together with the list content — callers can pass the
   * Home hero here so it doesn't eat permanent viewport.
   */
  HeaderComponent?: React.ReactElement;
  /** Forward scroll events to the parent for collapsing-header animation. */
  onScroll?: ReturnType<typeof Animated.event>;
}

export function SuggestionList({ HeaderComponent, onScroll }: SuggestionListProps = {}) {
  const suggestions = useSuggestionsStore((s) => s.suggestions);
  const isLoading = useSuggestionsStore((s) => s.isLoading);
  const error = useSuggestionsStore((s) => s.error);
  const fetchSuggestions = useSuggestionsStore((s) => s.fetchSuggestions);
  const autoFetch = useSuggestionsStore((s) => s.autoFetch);
  const setAutoFetch = useSuggestionsStore((s) => s.setAutoFetch);
  const pantryItems = usePantryStore((s) => s.items);

  const [previewSuggestion, setPreviewSuggestion] = useState<DinnerSuggestion | null>(null);

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
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {HeaderComponent}
        <View className="px-4 pt-4">
          <Text className="text-base font-semibold text-warmGray-700 mb-3">
            Finding dinner ideas...
          </Text>
          <SuggestionSkeleton />
        </View>
      </ScrollView>
    );
  }

  // Error state
  if (error) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}>
        {HeaderComponent}
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="text-4xl mb-4">😕</Text>
          <Text className="text-lg font-bold text-warmGray-900 mb-2">
            Something went wrong
          </Text>
          <Text className="text-sm text-warmGray-500 text-center mb-4">
            {error}
          </Text>
          <Button title="Try Again" onPress={fetchSuggestions} />
        </View>
      </ScrollView>
    );
  }

  // Insufficient pantry — polished empty state with food photo
  if (!hasSufficientPantry) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {HeaderComponent}
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
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,10,5,0.42)' }]} />
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
      </ScrollView>
    );
  }

  // Ready to fetch — polished empty state
  if (suggestions.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {HeaderComponent}
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
      </ScrollView>
    );
  }

  // Data state
  const renderItem = ({ item }: { item: DinnerSuggestion }) => (
    <View className="px-4">
      <SuggestionCard suggestion={item} onPress={setPreviewSuggestion} />
    </View>
  );

  return (
    <>
      <Animated.FlatList
        data={suggestions}
        keyExtractor={(item, index) => `${item.title}-${index}`}
        renderItem={renderItem}
        contentContainerClassName="pb-8"
        scrollEventThrottle={16}
        onScroll={onScroll}
        ListHeaderComponent={
          <View>
            {HeaderComponent}
            <View className="px-4 pt-5 pb-1">
              <Text className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">
                Cook tonight
              </Text>
              <Text className="text-base font-semibold text-warmGray-700 mb-1">
                Using what's in your pantry
              </Text>
              <Text className="text-xs text-warmGray-500 mb-4">
                Grounded in what you actually have on hand right now.
              </Text>
            </View>
          </View>
        }
        ListFooterComponent={
          <View className="mt-2 mb-4 px-4">
            <Button
              title="Get New Ideas"
              variant="outline"
              onPress={fetchSuggestions}
            />
          </View>
        }
      />
      <SuggestionPreviewModal
        visible={previewSuggestion !== null}
        suggestion={previewSuggestion}
        onClose={() => setPreviewSuggestion(null)}
      />
    </>
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
