import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { DayRow } from '../../components/plan/DayRow';
import { EmptyPlanState } from '../../components/plan/EmptyPlanState';
import { SwapSheet } from '../../components/plan/SwapSheet';
import { CookConfirm } from '../../components/plan/CookConfirm';
import type { MealPlanEntry, MealPlanIngredient } from '../../types/mealPlan';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';
import { colors } from '../../design/tokens';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Current week's Monday (UTC) in YYYY-MM-DD form. */
function currentMondayIso(): string {
  const now = new Date();
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
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

  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
    useCollapsingHeader();

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

  const confirmSwap = useCallback(async () => {
    if (swapTarget == null) return;
    await swapDay(swapTarget);
    setSwapTarget(null);
  }, [swapTarget, swapDay]);

  const confirmCook = useCallback(async () => {
    if (cookTarget == null) return;
    const entry = entriesByDay.get(cookTarget);
    const delta = entry?.ingredients_needed ?? entry?.ingredients ?? [];
    await markCooked(cookTarget);
    const latestError = useMealPlanStore.getState().error;
    if (latestError && latestError !== 'already_cooked') {
      setCookTarget(null);
      return;
    }
    setCookDelta(delta);
  }, [cookTarget, entriesByDay, markCooked]);

  const closeCook = useCallback(() => {
    setCookTarget(null);
    setCookDelta(null);
  }, []);

  if (loading && !currentPlan) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color={colors.brand} />
        <Text className="text-sm text-warmGray-500 mt-3">Loading plan...</Text>
      </SafeAreaView>
    );
  }

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

  const listHeader = (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>This Week</Text>
        <Text style={styles.largeSubtitle}>{weekRange}</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}
      >
        <Text style={styles.compactTitle}>This Week</Text>
      </Animated.View>

      {/* Action row — regenerate icon */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={handleRegenerate}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Regenerate week"
        >
          <SymbolIcon name="arrow.clockwise" size={20} tintColor="#3E332A" />
        </Pressable>
      </View>

      {error && error !== 'already_cooked' && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200" style={{ marginTop: 52 }}>
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <Animated.FlatList
        data={days}
        keyExtractor={(item) => `day-${item.day}`}
        ListHeaderComponent={listHeader}
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
        contentContainerStyle={{ paddingBottom: 140 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
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

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
});
