import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '../../stores/recipeStore';

interface FavoriteButtonProps {
  recipeId: string;
  isFavorite: boolean;
  size?: number;
}

export function FavoriteButton({
  recipeId,
  isFavorite,
  size = 28,
}: FavoriteButtonProps) {
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);

  return (
    <Pressable
      onPress={() => toggleFavorite(recipeId)}
      hitSlop={8}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={size}
        color={isFavorite ? '#EF4444' : '#6B7280'}
      />
    </Pressable>
  );
}
