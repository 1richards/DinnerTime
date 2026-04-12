import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '../../types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: (recipe: Recipe) => void;
}

const SOURCE_LABELS: Record<Recipe['source_type'], string> = {
  url: 'URL',
  photo: 'Photo',
  manual: 'Manual',
  ai: 'AI',
};

const SOURCE_COLORS: Record<Recipe['source_type'], string> = {
  url: 'bg-blue-100 text-blue-700',
  photo: 'bg-purple-100 text-purple-700',
  manual: 'bg-green-100 text-green-700',
  ai: 'bg-amber-100 text-amber-700',
};

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const badgeStyle = SOURCE_COLORS[recipe.source_type];

  return (
    <Pressable
      onPress={() => onPress?.(recipe)}
      className="bg-white rounded-xl p-4 mb-3 mx-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="absolute top-3 right-3 z-10">
        <Ionicons
          name={recipe.is_favorite ? 'heart' : 'heart-outline'}
          size={20}
          color={recipe.is_favorite ? '#EF4444' : '#9CA3AF'}
        />
      </View>

      <View className="flex-row items-start justify-between mb-2 pr-7">
        <Text
          className="text-base font-semibold text-warmGray-900 flex-1 mr-2"
          numberOfLines={2}
        >
          {recipe.title}
        </Text>
        <View className={`px-2 py-1 rounded-full ${badgeStyle.split(' ')[0]}`}>
          <Text className={`text-xs font-medium ${badgeStyle.split(' ')[1]}`}>
            {SOURCE_LABELS[recipe.source_type]}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4 mt-1">
        {totalTime > 0 && (
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text className="text-xs text-warmGray-500 ml-1">
              {totalTime} min
            </Text>
          </View>
        )}
        {recipe.servings != null && (
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={14} color="#6B7280" />
            <Text className="text-xs text-warmGray-500 ml-1">
              {recipe.servings} servings
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
