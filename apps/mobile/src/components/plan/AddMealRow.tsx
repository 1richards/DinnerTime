/**
 * AddMealRow — single recipe entry in the AddMealSheet picker.
 *
 * NativeWind className-based layout so the horizontal row structure is
 * unambiguous (gap-based StyleSheet rendering was collapsing into a
 * vertical stack on this RN/expo-image combo). Card-shaped white tile
 * with thumb-left, body-center, plus-right.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Chip } from '../ui/Chip';
import { colors } from '../../design/tokens';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { entryHealthChip } from './dayRowHelpers';
import type { Recipe } from '../../types/recipe';
import type { SymbolViewProps } from 'expo-symbols';

interface AddMealRowProps {
  recipe: Recipe;
  committing: boolean;
  disabled: boolean;
  onPick: () => void;
}

export function AddMealRow({
  recipe,
  committing,
  disabled,
  onPick,
}: AddMealRowProps) {
  const normalizedIngredients = useMemo(
    () =>
      (recipe.ingredients ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        notes: i.notes ?? null,
      })),
    [recipe.ingredients],
  );
  const { url: generatedUri } = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
    description: recipe.description,
    ingredients: normalizedIngredients,
  });
  const thumbUri = recipe.image_url ?? generatedUri ?? null;

  const healthChip = entryHealthChip({
    title: recipe.title,
    description: recipe.description ?? null,
    ingredients: normalizedIngredients,
  });

  const inactive = disabled || committing;

  return (
    <Pressable
      onPress={onPick}
      disabled={inactive}
      className={`flex-row items-center bg-surface rounded-card border border-border-subtle px-3 py-3 mb-3 active:bg-surface-subtle ${
        disabled ? 'opacity-40' : ''
      }`}
      accessibilityLabel={`Add ${recipe.title} to plan`}
    >
      <View className="w-16 h-16 rounded-card overflow-hidden bg-surface-subtle mr-3">
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>

      <View className="flex-1 mr-3">
        {recipe.total_time_minutes != null && (
          <View className="flex-row items-center mb-1">
            <SymbolIcon name="clock" size={11} tintColor={colors.textSecondary} />
            <Text className="ml-1 text-caption text-text-secondary font-semibold">
              {recipe.total_time_minutes}m
            </Text>
          </View>
        )}
        <Text className="text-body font-bold text-text-primary" numberOfLines={2}>
          {recipe.title}
        </Text>
        {healthChip && (
          <View className="flex-row mt-1.5">
            <Chip
              kind="display"
              tone={healthChip.tone}
              label={healthChip.label}
              leadingIcon={healthChip.leadingIcon as SymbolViewProps['name'] | undefined}
            />
          </View>
        )}
      </View>

      <View className="w-11 h-11 items-center justify-center">
        {committing ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <SymbolIcon
            name="plus.circle.fill"
            size="action"
            tintColor={colors.brand}
          />
        )}
      </View>
    </Pressable>
  );
}
