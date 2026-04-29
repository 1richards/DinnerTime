/**
 * DayRow renders a single day in the meal plan as an image-forward tile
 * (Phase 22-09 redesign):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ ┌────┐  MON · 35m                        │
 *   │ │ 🖼 │  Zesty Salmon Tacos with         │
 *   │ │    │  Cilantro-Lemon Crema            │
 *   │ └────┘  ⚡ Pantry-ready                  │
 *   └──────────────────────────────────────────┘
 *
 * Why a tile and not a one-line row:
 *   - The previous one-line layout reserved ~120pt of horizontal space for
 *     three trailing icon buttons (remix / swap / cook) AND a 48pt day
 *     label AND a 48pt thumbnail. The remaining title column was ~120pt
 *     wide on a 390pt iPhone, which truncated almost every real recipe
 *     title to "Zesty Sal…" with `numberOfLines={1}`.
 *   - Swap/Cooked were already the SwipeableDayRow swipe actions
 *     (apps/mobile/src/components/plan/SwipeableDayRow.tsx), so the
 *     inline icons duplicated the swipe gesture. Removing them frees the
 *     full row width for content.
 *   - Remix moved out of the row — users reach it via tap → recipe
 *     detail → Remix in the action footer. One extra tap, much cleaner
 *     row scan.
 *
 * Day label remains the primary visual anchor (brand-tinted), title
 * gets two lines, chips scroll horizontally if they overflow.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Chip } from '../ui/Chip';
import { colors } from '../../design/tokens';
import { useRecipeStore } from '../../stores/recipeStore';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import type { MealPlanEntry } from '../../types/mealPlan';
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
  /** Long-press handler for drag-to-reorder. When set, the row long-press
      hands control to the parent DraggableFlatList's drag gesture. */
  onLongPress?: () => void;
  /** True while THIS row is the one being dragged — used to dim the rest
      of the list and visually anchor the drag. */
  isDragActive?: boolean;
}

export function DayRow({
  entry,
  dayLabel,
  // isSwapping/isCooking/onSwap/onCook intentionally unused at this
  // layer now — SwipeableDayRow owns those states. Kept in the props
  // contract so the parent's wiring (and the existing test fixtures)
  // doesn't need to change.
  isSwapping: _isSwapping,
  isCooking: _isCooking,
  onSwap: _onSwap,
  onCook: _onCook,
  onPress,
  onLongPress,
  isDragActive,
}: DayRowProps) {
  // Look up the persisted Recipe (if this entry is backed by one) so we
  // can show its real image_url. recipe-by-id selector is memoized in
  // the store. Falls through to Gemini when the saved recipe lacks an
  // image_url (common for AI recipes saved before generation finished).
  const savedRecipe = useRecipeStore((s) =>
    entry?.recipe_id ? s.recipes.find((r) => r.id === entry.recipe_id) : null,
  );

  // Normalize ingredients to the ParsedIngredient shape the cache key
  // expects so the plan tile shares the same cache entry as Recipe Box
  // / Something New for the same recipe.
  const normalizedIngredients = useMemo(() => {
    const src = savedRecipe?.ingredients ?? entry?.ingredients ?? null;
    if (!src || src.length === 0) return null;
    return src.map((i) => {
      if (typeof i === 'string') {
        return { name: i, quantity: null, unit: null, notes: null };
      }
      const obj = i as { name: string; quantity?: number | null; unit?: string | null; notes?: string | null };
      return {
        name: obj.name,
        quantity: obj.quantity ?? null,
        unit: obj.unit ?? null,
        notes: obj.notes ?? null,
      };
    });
  }, [savedRecipe, entry]);

  const { url: generatedUri } = useGeneratedRecipeImage(entry?.title ?? null, {
    skip: !!savedRecipe?.image_url || !entry,
    description: savedRecipe?.description ?? entry?.description ?? null,
    ingredients: normalizedIngredients,
  });

  // Unplanned day — same tile footprint so the column doesn't jank when
  // a day flips between planned/unplanned, but content is muted.
  if (!entry) {
    return (
      <View className="flex-row items-center bg-surface px-4 py-3 rounded-card border border-border-subtle min-h-[88px]">
        <View className="w-16 h-16 rounded-card bg-surface-subtle mr-3" />
        <View className="flex-1">
          <Text className="text-label text-text-tertiary mb-1">{dayLabel}</Text>
          <Text className="text-body text-text-tertiary italic">
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

  const chips = deriveStatusChips({
    status,
    isStretch: entry.is_stretch === true,
    pantryReady: entry.pantry_ready === true,
  });

  const thumbnailUri = savedRecipe?.image_url ?? generatedUri ?? null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      className={`flex-row items-start bg-surface px-4 py-3 rounded-card border border-border-subtle min-h-[96px] ${
        isCooked ? 'opacity-60' : ''
      } ${isDragActive ? 'shadow-lg' : ''} active:bg-surface-subtle`}
      style={isDragActive ? { transform: [{ scale: 1.02 }] } : undefined}
    >
      {/* Hero thumbnail — bumped 48pt → 64pt so the meal reads visually
          at glance distance, matching the RecipeCard list mode density. */}
      <View className="w-16 h-16 rounded-card bg-surface-subtle overflow-hidden mr-3">
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>

      <View className="flex-1">
        {/* Day label + estimated time as a compact header strip above the
            title. Day label is brand-tinted to anchor the row in the week. */}
        <View className="flex-row items-center mb-1">
          <Text
            className="text-label font-bold mr-2"
            style={{ color: colors.brand }}
          >
            {dayLabel.toUpperCase()}
          </Text>
          {entry.estimated_time_minutes != null && (
            <View className="flex-row items-center">
              <SymbolIcon name="clock" size={11} tintColor={colors.textSecondary} />
              <Text className="text-caption text-text-secondary ml-1">
                {entry.estimated_time_minutes}m
              </Text>
            </View>
          )}
        </View>

        {/* Title now gets two lines — full row width (no trailing button
            cluster competing for space) — so even long titles like
            "Zesty Salmon Tacos with Cilantro-Lemon Crema" land in full
            without ellipsis. */}
        <Text
          numberOfLines={2}
          className={`text-body text-text-primary font-semibold ${
            isCooked ? 'line-through' : ''
          }`}
        >
          {entry.title}
        </Text>

        {chips.length > 0 && (
          <View className="flex-row items-center mt-1.5 flex-wrap">
            {chips.map((c) => (
              <View key={c.label} className="mr-1 mt-1">
                <Chip
                  kind="display"
                  tone={c.tone}
                  label={c.label}
                  leadingIcon={c.leadingIcon as SymbolViewProps['name'] | undefined}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
