import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { DayRow } from '../../components/plan/DayRow';
import { EmptyPlanState } from '../../components/plan/EmptyPlanState';
import { SwapSheet } from '../../components/plan/SwapSheet';
import { CookConfirm } from '../../components/plan/CookConfirm';
import type { MealPlanEntry, MealPlanIngredient } from '../../types/mealPlan';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Current week's Monday (UTC) in YYYY-MM-DD form. */
function currentMondayIso(): string {
  const now = new Date();
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // getUTCDay: 0=Sun..6=Sat. Shift so Mon=0.
  const dow = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

function formatRangeFromWeekStart(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (date: Date) =>
    `${DAY_LABELS[(date.getUTCDay() + 6) % 7]} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function PlanScreen() {
  const {
    currentPlan,
    loading,
    error,
    swappingDay,
    cookingDay,
    fetchCurrent,
    generate,
    swapDay,
    markCooked,
  } = useMealPlanStore();

  const [swapTarget, setSwapTarget] = useState<number | null>(null);
  const [cookTarget, setCookTarget] = useState<number | null>(null);
  const [cookDelta, setCookDelta] = useState<MealPlanIngredient[] | null>(null);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const handleGenerate = useCallback(() => {
    generate(currentMondayIso());
  }, [generate]);

  const handleRegenerate = useCallback(() => {
    Alert.alert(
      'Regenerate week?',
      'This will replace your current plan with a new 7-day plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => generate(currentPlan?.week_start ?? currentMondayIso()),
        },
      ]
    );
  }, [generate, currentPlan]);

  const entriesByDay = useMemo(() => {
    const map = new Map<number, MealPlanEntry>();
    if (currentPlan) {
      for (const entry of currentPlan.entries) {
        map.set(entry.day_of_week, entry);
      }
    }
    return map;
  }, [currentPlan]);

  const days = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day: d, entry: entriesByDay.get(d) ?? null })),
    [entriesByDay]
  );

  // Swap confirm
  const confirmSwap = useCallback(async () => {
    if (swapTarget == null) return;
    await swapDay(swapTarget);
    setSwapTarget(null);
  }, [swapTarget, swapDay]);

  // Cook confirm
  const confirmCook = useCallback(async () => {
    if (cookTarget == null) return;
    const entry = entriesByDay.get(cookTarget);
    // Snapshot ingredients for delta display (server doesn't return deltas separately)
    const delta = entry?.ingredients_needed ?? entry?.ingredients ?? [];
    await markCooked(cookTarget);
    // Check store state post-call
    const latestError = useMealPlanStore.getState().error;
    if (latestError && latestError !== 'already_cooked') {
      // error already surfaced via banner
      setCookTarget(null);
      return;
    }
    setCookDelta(delta);
  }, [cookTarget, entriesByDay, markCooked]);

  const closeCook = useCallback(() => {
    setCookTarget(null);
    setCookDelta(null);
  }, []);

  // Loading skeleton on first fetch
  if (loading && !currentPlan) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">Loading plan...</Text>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!currentPlan) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        {error && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}
        <EmptyPlanState onGenerate={handleGenerate} loading={loading} />
      </SafeAreaView>
    );
  }

  const weekRange = formatRangeFromWeekStart(currentPlan.week_start);

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-bold text-warmGray-900">
              This Week
            </Text>
            <Text className="text-sm text-warmGray-500 mt-0.5">
              {weekRange}
            </Text>
          </View>
          <Pressable
            onPress={handleRegenerate}
            hitSlop={8}
            className="flex-row items-center px-3 py-2 rounded-full bg-orange-50 border border-orange-200 active:bg-orange-100"
          >
            <Ionicons name="refresh" size={14} color="#B45309" />
            <Text className="text-xs font-semibold text-amber-800 ml-1">
              Regenerate
            </Text>
          </Pressable>
        </View>
      </View>

      {error && error !== 'already_cooked' && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <FlatList
        data={days}
        keyExtractor={(item) => `day-${item.day}`}
        renderItem={({ item }) => (
          <DayRow
            entry={item.entry}
            dayLabel={DAY_LABELS[item.day]!}
            isSwapping={swappingDay === item.day}
            isCooking={cookingDay === item.day}
            onSwap={() => setSwapTarget(item.day)}
            onCook={() => setCookTarget(item.day)}
            onPress={() => {
              if (!item.entry) return;
              Alert.alert(
                item.entry.title,
                [
                  item.entry.description,
                  item.entry.why_suggested
                    ? `\nWhy: ${item.entry.why_suggested}`
                    : null,
                  item.entry.ingredients.length
                    ? `\nIngredients:\n${item.entry.ingredients.map((i) => `• ${i.name}`).join('\n')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('\n') || 'No details available'
              );
            }}
          />
        )}
      />

      <SwapSheet
        visible={swapTarget != null}
        currentEntry={swapTarget != null ? entriesByDay.get(swapTarget) ?? null : null}
        loading={swappingDay != null}
        onConfirm={confirmSwap}
        onCancel={() => setSwapTarget(null)}
      />

      <CookConfirm
        visible={cookTarget != null}
        entry={cookTarget != null ? entriesByDay.get(cookTarget) ?? null : null}
        loading={cookingDay != null}
        pantryDelta={cookDelta}
        onConfirm={confirmCook}
        onCancel={closeCook}
      />
    </SafeAreaView>
  );
}
