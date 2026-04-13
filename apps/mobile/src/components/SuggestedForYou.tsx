import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { AmbitionSuggestion } from '../types/progression';

interface Props {
  suggestions: AmbitionSuggestion[];
}

/**
 * Horizontal scroll of ambition suggestions surfaced on the Recipes tab.
 * Renders nothing when the list is empty (no skeleton, no header) so the
 * tab degrades gracefully for new users with empty cook history.
 */
export function SuggestedForYou({ suggestions }: Props): React.ReactElement | null {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <View className="mb-4" testID="suggested-for-you">
      <Text className="px-4 text-lg font-semibold text-warmGray-900 mb-2">
        Suggested for you
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {suggestions.map((s) => (
          <Pressable
            key={s.recipe_id}
            onPress={() => router.push(`/recipes/${s.recipe_id}`)}
            className="w-56 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3"
          >
            <Text
              className="text-base font-semibold text-warmGray-900"
              numberOfLines={1}
            >
              {s.title}
            </Text>
            <Text
              className="text-sm text-warmGray-600 mt-1"
              numberOfLines={2}
            >
              {s.rationale}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default SuggestedForYou;
