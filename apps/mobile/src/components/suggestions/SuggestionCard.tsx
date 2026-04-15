import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { DinnerSuggestion } from '../../types/suggestions';

const difficultyConfig: Record<
  DinnerSuggestion['difficulty'],
  { emoji: string; label: string; color: string }
> = {
  easy: { emoji: '🟢', label: 'Easy', color: 'bg-green-100 text-green-800' },
  medium: { emoji: '🟡', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  hard: { emoji: '🔴', label: 'Hard', color: 'bg-red-100 text-red-800' },
};

interface SuggestionCardProps {
  suggestion: DinnerSuggestion;
  onPress?: (s: DinnerSuggestion) => void;
}

export function SuggestionCard({ suggestion, onPress }: SuggestionCardProps) {
  const difficulty = difficultyConfig[suggestion.difficulty];

  return (
    <Pressable
      onPress={() => onPress?.(suggestion)}
      className="bg-white rounded-xl p-4 shadow-sm mb-3 active:opacity-90"
    >
      {/* Header row: title, cuisine, difficulty */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-bold text-warmGray-900 flex-1 mr-2" numberOfLines={1}>
          {suggestion.title}
        </Text>
        <View className={`rounded-full px-2 py-1 ${difficulty.color}`}>
          <Text className="text-xs font-medium">
            {difficulty.emoji} {difficulty.label}
          </Text>
        </View>
      </View>

      {/* Cuisine tag */}
      <View className="flex-row items-center mb-2">
        <View className="bg-warmGray-100 rounded-full px-2 py-1">
          <Text className="text-xs text-warmGray-600">{suggestion.cuisine_type}</Text>
        </View>
      </View>

      {/* Description */}
      <Text className="text-sm text-warmGray-600 mb-3" numberOfLines={2}>
        {suggestion.description}
      </Text>

      {/* Time and kid-friendly badges row */}
      <View className="flex-row items-center mb-3">
        <Text className="text-sm text-warmGray-500 mr-3">
          🕐 {suggestion.estimated_time_minutes} min
        </Text>
        {suggestion.kid_friendly && (
          <View className="bg-yellow-100 rounded-full px-2 py-1">
            <Text className="text-xs font-medium text-yellow-800">👶 Kid-Friendly</Text>
          </View>
        )}
      </View>

      {/* Ingredients from pantry */}
      {suggestion.ingredients_used.length > 0 && (
        <View className="mb-2">
          <Text className="text-xs font-medium text-warmGray-500 mb-1">Using from pantry:</Text>
          <View className="flex-row flex-wrap gap-1">
            {suggestion.ingredients_used.map((ingredient) => (
              <View key={ingredient} className="bg-green-100 rounded-full px-2 py-1">
                <Text className="text-xs text-green-800">{ingredient}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Ingredients needed */}
      {suggestion.ingredients_needed.length > 0 && (
        <View className="mb-2">
          <Text className="text-xs font-medium text-warmGray-500 mb-1">May need:</Text>
          <View className="flex-row flex-wrap gap-1">
            {suggestion.ingredients_needed.map((ingredient) => (
              <View key={ingredient} className="bg-orange-100 rounded-full px-2 py-1">
                <Text className="text-xs text-orange-800">{ingredient}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Why suggested footer */}
      <Text className="text-xs text-warmGray-400 italic mt-1">
        {suggestion.why_suggested}
      </Text>
      <View className="flex-row items-center mt-3">
        <Text className="text-xs font-bold text-orange-600">
          Tap to preview and plan →
        </Text>
      </View>
    </Pressable>
  );
}
