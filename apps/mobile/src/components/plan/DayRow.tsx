import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealPlanEntry } from '../../types/mealPlan';

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
              <Ionicons name="time-outline" size={12} color="#6B7280" />
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
            <Text className="text-xs mr-2">👶</Text>
          )}
          {isCooked && entry.cooked_at && (
            <Text className="text-xs text-green-700 ml-1">✓ cooked</Text>
          )}
        </View>
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable
          testID={`swap-btn-${dayLabel}`}
          onPress={onSwap}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-warmGray-100"
        >
          {isSwapping ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <Ionicons
              name="swap-horizontal"
              size={22}
              color={isCooked ? '#D1D5DB' : '#6B7280'}
            />
          )}
        </Pressable>
        <Pressable
          testID={`cook-btn-${dayLabel}`}
          onPress={onCook}
          disabled={isSwapping || isCooking || isCooked}
          hitSlop={8}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-warmGray-100"
        >
          {isCooking ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <Ionicons
              name={isCooked ? 'checkmark-circle' : 'flame-outline'}
              size={22}
              color={isCooked ? '#16A34A' : '#F97316'}
            />
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}
