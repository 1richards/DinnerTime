import React from 'react';
import { Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { useRecipeStore } from '../../stores/recipeStore';

interface FavoriteButtonProps {
  recipeId: string;
  isFavorite: boolean;
  size?: number;
}

// Orange #F97316 preserved per Phase 15 mandate — the favorite heart is
// the most visible orange touchpoint in the app. Inactive state is white
// so the button reads against dark hero backgrounds; consumers placing
// this in a light surface can override via wrapping.
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
      accessibilityLabel={isFavorite ? 'Unfavorite recipe' : 'Favorite recipe'}
    >
      <SymbolIcon
        name={isFavorite ? 'heart.fill' : 'heart'}
        size={size}
        tintColor={isFavorite ? '#F97316' : '#FFFFFF'}
      />
    </Pressable>
  );
}
