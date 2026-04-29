/**
 * AddMealRow — single recipe entry in the AddMealSheet picker.
 *
 * Stylistically matches the plan-tab DayRow tile (white card, 64pt
 * thumbnail, 2-line title, time + per-meal health chip) so the
 * picker feels like a continuation of the plan list rather than a
 * separate UI vocabulary. Pulls thumbnail through the Gemini hook
 * with the same cache key as Recipe Box / DayRow so popular dishes
 * pop in instantly.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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
  // Same cache-key shape as Recipe Box / DayRow — when the user has
  // viewed this recipe elsewhere this session the thumbnail is an
  // instant hit instead of a fresh Gemini call.
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

  // Per-recipe health chip — same scorer the plan tile uses, so the
  // signal is consistent between the picker and the resulting tile.
  const healthChip = entryHealthChip({
    title: recipe.title,
    description: recipe.description ?? null,
    ingredients: normalizedIngredients,
  });

  return (
    <Pressable
      onPress={onPick}
      disabled={disabled || committing}
      style={({ pressed }) => [
        styles.row,
        pressed && !(disabled || committing) ? { opacity: 0.92 } : null,
        disabled ? { opacity: 0.4 } : null,
      ]}
      accessibilityLabel={`Add ${recipe.title} to plan`}
    >
      <View style={styles.thumbWrap}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={styles.thumb}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>

      <View style={styles.body}>
        {recipe.total_time_minutes != null && (
          <View style={styles.metaRow}>
            <SymbolIcon name="clock" size={11} tintColor={colors.textSecondary} />
            <Text style={styles.metaText}>{recipe.total_time_minutes}m</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>
        {healthChip && (
          <View style={styles.chipsRow}>
            <Chip
              kind="display"
              tone={healthChip.tone}
              label={healthChip.label}
              leadingIcon={healthChip.leadingIcon as SymbolViewProps['name'] | undefined}
            />
          </View>
        )}
      </View>

      {committing ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <SymbolIcon
          name="plus.circle.fill"
          size="action"
          tintColor={colors.brand}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#F1EAE0',
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1EAE0',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
});
