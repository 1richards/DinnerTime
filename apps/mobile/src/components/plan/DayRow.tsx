/**
 * DayRow intentionally does NOT consume `ItemRow` from '../ui/ItemRow'.
 *
 * ItemRow's `leading` prop is a discriminated union of `checkbox | stepper | icon`
 * — a single affordance slot sized ~24-32pt. DayRow's layout calls for a `w-12`
 * (48pt) day-label column (e.g., "MON") as its leading slot, which is a text
 * typography element, not an affordance. Forcing it into ItemRow's `leading: icon`
 * kind would either lose the day-label semantics or require adding a fourth kind
 * that only DayRow uses — worse factoring than keeping DayRow as its own primitive
 * that happens to compose the shared Chip component for status display.
 *
 * If future screens need a day-label + meal layout, extract a new `LabeledRow`
 * primitive rather than overloading ItemRow.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Chip } from '../ui/Chip';
import { colors } from '../../design/tokens';
import { getRecipeImage } from '../../constants/foodImages';
import type { MealPlanEntry, MealPlanIngredient } from '../../types/mealPlan';
import { RemixSheet } from '../recipes/RemixSheet';
import { deriveStatusChips, type DayRowStatus } from './dayRowHelpers';
import type { SymbolViewProps } from 'expo-symbols';

interface DayRowProps {
  entry: MealPlanEntry | null;
  dayLabel: string;
  isSwapping: boolean;
  isCooking: boolean;
  onSwap: () => void;
  onCook: () => void;
  onPress: () => void;
}

export function DayRow({
  entry,
  dayLabel,
  isSwapping,
  isCooking,
  onSwap,
  onCook,
  onPress,
}: DayRowProps) {
  const [remixOpen, setRemixOpen] = useState(false);

  // Unplanned day — muted placeholder; still ~64pt tall so all 7 days fit
  // without scroll on iPhone 15/17 Pro per D-06 density decision.
  if (!entry) {
    return (
      <View className="flex-row items-center bg-surface px-4 py-2 border-b border-border-subtle min-h-[64px]">
        <View className="w-12 items-start">
          <Text className="text-label text-text-tertiary">{dayLabel}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-caption text-text-tertiary italic">
            No meal planned
          </Text>
        </View>
      </View>
    );
  }

  const isCooked = entry.status === 'cooked';
  const status: DayRowStatus =
    entry.status === 'cooked'
      ? 'cooked'
      : entry.status === 'skipped'
        ? 'skipped'
        : 'planned';

  // Phase 22-05 + 22-06: both flags are live and derived client-side in
  // plan.tsx — `is_stretch` via pickStretchDay() (stretch meal of the week)
  // and `pantry_ready` via computePantryReady(entry.ingredients, pantryItems)
  // (≥80% of non-staple ingredients already in the pantry). The
  // `deriveStatusChips` matrix layers up to three chips: status + stretch +
  // pantry-ready. All three use Phase 19 tokens (success / warning /
  // default) — no raw hex literals downstream.
  const chips = deriveStatusChips({
    status,
    isStretch: entry.is_stretch === true,
    pantryReady: entry.pantry_ready === true,
  });

  const thumbnailUri = entry.recipe_id
    ? getRecipeImage(entry.recipe_id, null, entry.title)
    : null;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center bg-surface px-4 py-2 border-b border-border-subtle min-h-[64px] ${
        isCooked ? 'opacity-60' : ''
      } active:bg-surface-subtle`}
    >
      <View className="w-12 items-start">
        <Text className="text-label text-text-tertiary">{dayLabel}</Text>
      </View>

      {thumbnailUri ? (
        <View className="w-12 h-12 rounded-button bg-surface-subtle overflow-hidden mr-3">
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        </View>
      ) : (
        <View className="w-12 h-12 rounded-button bg-surface-subtle mr-3" />
      )}

      <View className="flex-1 pr-2">
        <Text
          numberOfLines={1}
          className={`text-body text-text-primary font-semibold ${
            isCooked ? 'line-through' : ''
          }`}
        >
          {entry.title}
        </Text>
        <View className="flex-row items-center mt-1 flex-wrap">
          {entry.estimated_time_minutes != null && (
            <View className="flex-row items-center mr-2">
              <SymbolIcon name="clock" size={12} tintColor={colors.textSecondary} />
              <Text className="text-caption text-text-secondary ml-1">
                {entry.estimated_time_minutes}m
              </Text>
            </View>
          )}
          {chips.map((c) => (
            <View key={c.label} className="mr-1">
              <Chip
                kind="display"
                tone={c.tone}
                label={c.label}
                leadingIcon={c.leadingIcon as SymbolViewProps['name'] | undefined}
              />
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable
          testID={`remix-btn-${dayLabel}`}
          onPress={(e) => {
            e.stopPropagation();
            setRemixOpen(true);
          }}
          disabled={isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-subtle"
          accessibilityLabel="Remix"
        >
          <SymbolIcon
            name="sparkles"
            size={20}
            tintColor={isCooked ? colors.textTertiary : colors.warning}
          />
        </Pressable>
        <Pressable
          testID={`swap-btn-${dayLabel}`}
          onPress={onSwap}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-subtle"
          accessibilityLabel="Swap meal"
        >
          {isSwapping ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <SymbolIcon
              name="arrow.left.arrow.right"
              size={22}
              tintColor={isCooked ? colors.textTertiary : colors.textSecondary}
            />
          )}
        </Pressable>
        <Pressable
          testID={`cook-btn-${dayLabel}`}
          onPress={onCook}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-subtle"
          accessibilityLabel={isCooked ? 'Cooked' : 'Mark as cooked'}
        >
          {isCooking ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <SymbolIcon
              name={isCooked ? 'checkmark.circle.fill' : 'flame'}
              size={22}
              tintColor={isCooked ? colors.success : colors.brand}
            />
          )}
        </Pressable>
      </View>

      <RemixSheet
        visible={remixOpen}
        recipeTitle={entry.title}
        source={
          entry.recipe_id
            ? { kind: 'saved', recipeId: entry.recipe_id }
            : {
                kind: 'inline',
                context: {
                  title: entry.title,
                  description: entry.description ?? null,
                  ingredients: (entry.ingredients ?? []) as MealPlanIngredient[],
                  total_time_minutes: entry.estimated_time_minutes ?? null,
                },
              }
        }
        baseForSave={{
          title: entry.title,
          description: entry.description ?? null,
          ingredients: (entry.ingredients ?? []) as MealPlanIngredient[],
          total_time_minutes: entry.estimated_time_minutes ?? null,
        }}
        onClose={() => setRemixOpen(false)}
      />
    </Pressable>
  );
}
