import React from 'react';
import { Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { useRecipeStore } from '../../stores/recipeStore';
import { colors } from '../../design/tokens';

interface FavoriteButtonProps {
  recipeId: string;
  isFavorite: boolean;
  size?: number;
}

// Phase 19 update: heart uses colors.brand (terracotta #C65D3A) in place of
// the prior pure-orange default. Inactive state stays white so the button
// reads over dark hero imagery; consumers placing this on a light surface
// can wrap with their own tintColor override if needed later.
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
        tintColor={isFavorite ? colors.brand : '#FFFFFF'}
      />
    </Pressable>
  );
}
