import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { MealPlanEntry, MealPlanIngredient } from '../../types/mealPlan';
import { RemixSheet } from '../recipes/RemixSheet';

interface DayRowProps {
  entry: MealPlanEntry | null;
  dayLabel: string;
  isSwapping: boolean;
  isCooking: boolean;
  onSwap: () => void;
  onCook: () => void;
  onPress: () => void;
}

const difficultyColor: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  hard: 'bg-red-100 text-red-800',
};

export function DayRow({
  entry,
  dayLabel,
  isSwapping,
  isCooking,
  onSwap,
  onCook,
  onPress,
}: DayRowProps) {
  const isCooked = entry?.status === 'cooked';
  const [remixOpen, setRemixOpen] = useState(false);

  if (!entry) {
    return (
      <View className="flex-row items-center px-4 py-3 border-b border-warmGray-100">
        <View className="w-12">
          <Text className="text-xs font-bold text-warmGray-700 uppercase">
            {dayLabel}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm text-warmGray-400 italic">
            No meal planned
          </Text>
        </View>
      </View>
    );
  }

  const diffClass = entry.difficulty
    ? difficultyColor[entry.difficulty] ?? 'bg-warmGray-100 text-warmGray-700'
    : '';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3 border-b border-warmGray-100 ${
        isCooked ? 'opacity-60' : ''
      } active:bg-warmGray-50`}
    >
      <View className="w-12">
        <Text className="text-xs font-bold text-warmGray-700 uppercase">
          {dayLabel}
        </Text>
      </View>

      <View className="flex-1 pr-2">
        <Text
          numberOfLines={1}
          className={`text-base font-semibold text-warmGray-900 ${
            isCooked ? 'line-through' : ''
          }`}
        >
          {entry.title}
        </Text>
        <View className="flex-row items-center mt-1 flex-wrap">
          {entry.estimated_time_minutes != null && (
            <View className="flex-row items-center mr-2">
              <SymbolIcon name="clock" size={12} tintColor="#6B7280" />
              <Text className="text-xs text-warmGray-500 ml-1">
                {entry.estimated_time_minutes}m
              </Text>
            </View>
          )}
          {entry.difficulty && (
            <View className={`px-2 py-0.5 rounded-full mr-2 ${diffClass}`}>
              <Text className={`text-xs font-medium ${diffClass}`}>
                {entry.difficulty}
              </Text>
            </View>
          )}
          {entry.kid_friendly && (
            <View className="bg-warmGray-100 rounded-full px-2 py-0.5 mr-2">
              <Text className="text-[10px] font-semibold text-warmGray-600">Kid-friendly</Text>
            </View>
          )}
          {isCooked && entry.cooked_at && (
            <View className="flex-row items-center ml-1">
              <SymbolIcon name="checkmark" size={10} weight="bold" tintColor="#047857" />
              <Text className="text-xs text-green-700 ml-1">cooked</Text>
            </View>
          )}
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
          className="w-10 h-10 items-center justify-center rounded-full active:bg-warmGray-100"
          accessibilityLabel="Remix"
        >
          <SymbolIcon
            name="sparkles"
            size={20}
            tintColor={isCooked ? '#D1D5DB' : '#B45309'}
          />
        </Pressable>
        <Pressable
          testID={`swap-btn-${dayLabel}`}
          onPress={onSwap}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-warmGray-100"
          accessibilityLabel="Swap meal"
        >
          {isSwapping ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <SymbolIcon
              name="arrow.left.arrow.right"
              size={22}
              tintColor={isCooked ? '#D1D5DB' : '#6B7280'}
            />
          )}
        </Pressable>
        <Pressable
          testID={`cook-btn-${dayLabel}`}
          onPress={onCook}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-warmGray-100"
          accessibilityLabel={isCooked ? 'Cooked' : 'Mark as cooked'}
        >
          {isCooking ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <SymbolIcon
              name={isCooked ? 'checkmark.circle.fill' : 'flame'}
              size={22}
              tintColor={isCooked ? '#16A34A' : '#F97316'}
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
