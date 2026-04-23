import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  Pressable,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { useShoppingStore } from '../../stores/shoppingStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { usePantryStore } from '../../stores/pantryStore';
import { pickStretchDay } from '../../plan/stretchPicker';
import { EmptyPlanState } from '../../components/plan/EmptyPlanState';
import { FocusBanner } from '../../components/plan/FocusBanner';
import { SwapSheet } from '../../components/plan/SwapSheet';
import { CookConfirm } from '../../components/plan/CookConfirm';
import { SwipeableDayRow } from '../../components/plan/SwipeableDayRow';
import { computePantryReady } from '../../components/plan/pantryReady';
import { WeekActionSheet } from '../../components/plan/WeekActionSheet';
import { MonthGrid } from '../../components/plan/MonthGrid';
import { MonthPatterns } from '../../components/plan/MonthPatterns';
import { DatePickerSheet } from '../../components/plan/DatePickerSheet';
import {
  HandoffSheet,
  type HandoffState,
} from '../../components/shopping/HandoffSheet';
import { openInstacartCart } from '../../shopping/openInstacartCart';
import { classifyHandoffError } from '../../shopping/classifyHandoffError';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';
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

/** Add N days (may be negative) to a YYYY-MM-DD ISO string in UTC. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
  // Phase 22-06: Day the user is about to skip via swipe. Triggers an
  // Alert.prompt for a free-form reason. Null when no skip confirmation is
  // in flight.
  const [skipTarget, setSkipTarget] = useState<number | null>(null);
  const [handoffState, setHandoffState] = useState<HandoffState>({ kind: 'idle' });
  const [handoffSessionId, setHandoffSessionId] = useState<string>('');
  // Phase 22-02: Week-level action sheet (regenerate / shift ±1 / duplicate
  // last / shopping). Opens on ellipsis tap in the header action row.
  const [weekSheetVisible, setWeekSheetVisible] = useState(false);
  // Phase 22-03: Week | Month segmented control. Both views remain mounted
  // (display:none pattern per Phase 12 Kitchen tab) so the Week list's
  // scroll position + DayRow state survives toggling to Month and back.
  const [scale, setScale] = useState<'week' | 'month'>('week');
  // Phase 22-03: DatePickerSheet instance for Month-view empty-cell pin.
  const [monthPinIso, setMonthPinIso] = useState<string | null>(null);
  // Phase 22-03: Subscribe to month state reactively so re-renders fire when
  // fetchRange finishes (reading getState() in useEffect would be stale).
  const monthPlans = useMealPlanStore((s) => s.monthPlans);
  const monthLoading = useMealPlanStore((s) => s.monthLoading);

  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
    useCollapsingHeader();

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  // Phase 22-05: fetch cookStats on mount so we can derive median cook
  // complexity for stretch-day selection. Safe no-op when not authenticated
  // / offline (progressionStore guards itself).
  const cookStats = useProgressionStore((s) => s.cookStats);
  const fetchCookStats = useProgressionStore((s) => s.fetchCookStats);
  useEffect(() => {
    void fetchCookStats();
  }, [fetchCookStats]);

  const handleGenerate = useCallback(() => {
    generate(currentMondayIso());
  }, [generate]);

  const entriesByDay = useMemo(() => {
    const map = new Map<number, MealPlanEntry>();
    if (currentPlan) {
      for (const entry of currentPlan.entries) {
        map.set(entry.day_of_week, entry);
      }
    }
    return map;
  }, [currentPlan]);

  // Phase 22-05: stretch-day derivation. Pure client-side — avoids the
  // "swap loses stretch" bug (22-RESEARCH Pitfall 5) by re-evaluating on
  // every entries change. Median is a coarse proxy from lifetime cook
  // count: <5 = tier-1 median 3 (easy-ish), <20 = tier-2 median 6 (mid),
  // else tier-3 median 9 (hard). Tuned so pickStretchDay's `floor =
  // median + 2` gate selects weekend recipes for novices and harder
  // medium/hard picks for confident cooks.
  const medianComplexity = useMemo(() => {
    if (cookStats.length === 0) return 3;
    const totalCooks = cookStats.reduce((sum, r) => sum + r.cook_count, 0);
    return totalCooks < 5 ? 3 : totalCooks < 20 ? 6 : 9;
  }, [cookStats]);

  const stretchDay = useMemo(() => {
    if (!currentPlan) return null;
    return pickStretchDay(currentPlan.entries, medianComplexity);
  }, [currentPlan, medianComplexity]);

  // Phase 22-06: pantry items are consumed per render to compute the
  // `pantry_ready` flag on each entry. Subscribed via selector so changes
  // to the pantry (scan confirm, mark-used, etc.) automatically refresh
  // the Plan tab's chip state without a manual reload.
  const pantryItems = usePantryStore((s) => s.items);

  const days = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const raw = entriesByDay.get(d) ?? null;
        const entry = raw
          ? {
              ...raw,
              is_stretch: d === stretchDay,
              pantry_ready: computePantryReady(
                raw.ingredients ?? [],
                pantryItems,
              ),
            }
          : null;
        return { day: d, entry };
      }),
    [entriesByDay, stretchDay, pantryItems]
  );

  // Phase 22-05: telemetry. plan.stretch_displayed fires once per
  // (plan.id, stretchDay) tuple — re-firing when the stretch target
  // changes (e.g. after a swap moves complexity around, or after the
  // user cooks a stretch and the helper picks a different day).
  useEffect(() => {
    if (stretchDay == null || !currentPlan) return;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `str-${Date.now()}`;
    logPlanEvent({
      name: 'plan.stretch_displayed',
      session_id: sessionId,
      meal_plan_id: currentPlan.id,
      payload: sanitizePayload({
        meal_plan_id: currentPlan.id,
        week_start: currentPlan.week_start,
      }),
    });
  }, [stretchDay, currentPlan?.id, currentPlan?.week_start, currentPlan]);

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

  // Phase 22-06: Skip flow. SwipeableDayRow fires onSkip(day) → we stash
  // the target day and open an iOS Alert.prompt for the free-form reason
  // (empty string allowed → stored as null). On submit, call the store's
  // optimistic skipDay. The Alert is opened via a useEffect so the sheet
  // dismiss animation doesn't clobber the prompt presentation.
  useEffect(() => {
    if (skipTarget == null) return;
    Alert.prompt(
      'Skip this day?',
      'Optional reason (e.g., travel, ate out).',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setSkipTarget(null),
        },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: (text?: string) => {
            const trimmed = (text ?? '').trim();
            const reason = trimmed.length > 0 ? trimmed : null;
            void useMealPlanStore.getState().skipDay(skipTarget, reason);
            setSkipTarget(null);
          },
        },
      ],
      'plain-text',
    );
  }, [skipTarget]);

  // Plan → Shopping handoff (22-01 / PLAN-X-03). Mirrors shopping.tsx's
  // handleOrder (canonical copy, unchanged there). Aggregates this week's
  // ingredients via generateList(currentPlan.id), then createOrder to obtain
  // a draft-cart URL, then hands off to HandoffSheet's success state.
  const handleShoppingHandoff = useCallback(async () => {
    if (!currentPlan?.id) {
      Alert.alert(
        'Generate a plan first',
        'Head over to Plan and generate this week before building a shopping list.',
      );
      return;
    }

    // Feature-flag parity with shopping.tsx (SHOP-DC-05). When the Settings
    // toggle reads 'legacy', fall back to the Phase 8 inline WebBrowser path.
    const mode = useSettingsStore.getState().shoppingHandoffMode;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `pl-${Date.now()}`;
    setHandoffSessionId(sessionId);

    if (mode === 'legacy') {
      try {
        setHandoffState({ kind: 'sending' });
        await useShoppingStore.getState().generateList(currentPlan.id);
        const { url } = await useShoppingStore.getState().createOrder();
        await WebBrowser.openBrowserAsync(url);
      } catch {
        // shoppingStore.error already captured
      } finally {
        setHandoffState({ kind: 'idle' });
      }
      return;
    }

    setHandoffState({ kind: 'sending' });
    try {
      await useShoppingStore.getState().generateList(currentPlan.id);
      const items = useShoppingStore.getState().items;
      const unchecked = items.filter((i) => !i.checked);
      const { url, order_id } = await useShoppingStore.getState().createOrder();

      setHandoffState({
        kind: 'success',
        url,
        itemCount: unchecked.length,
        appInstalled: false,
      });
      logPlanEvent({
        name: 'plan.shopping_handoff_opened',
        session_id: sessionId,
        meal_plan_id: currentPlan.id,
        payload: sanitizePayload({
          meal_plan_id: currentPlan.id,
          week_start: currentPlan.week_start,
        }),
      });
      // Fire-and-forget orders refresh so the shopping tab reflects the cart.
      void useShoppingStore.getState().fetchOrders();
      // Use order_id locally (kept for symmetry with shopping.tsx telemetry
      // payload — plan-channel whitelist does not include order_id so it
      // never leaves the client, but we reference it to avoid unused warnings).
      void order_id;
    } catch (err) {
      const variant = classifyHandoffError(err);
      setHandoffState({ kind: 'error', variant });
      logPlanEvent({
        name: 'plan.shopping_handoff_opened',
        session_id: sessionId,
        meal_plan_id: currentPlan.id,
        payload: sanitizePayload({
          error_code: variant,
          variant,
          meal_plan_id: currentPlan.id,
          week_start: currentPlan.week_start,
        }),
      });
    }
  }, [currentPlan]);

  const handleOpenCart = useCallback(async () => {
    if (handoffState.kind !== 'success') return;
    await openInstacartCart(handoffState.url, { sessionId: handoffSessionId });
    setHandoffState({ kind: 'idle' });
  }, [handoffState, handoffSessionId]);

  const handleHandoffRetry = useCallback(() => {
    // Match shopping.tsx: reset to idle so the user explicitly re-taps the
    // Shopping-list button to retry (avoids double-Instacart-POST bugs).
    setHandoffState({ kind: 'idle' });
  }, []);

  const handleHandoffDismiss = useCallback(() => {
    setHandoffState({ kind: 'idle' });
  }, []);

  // Phase 22-02: week-action handlers. Each action emits a sanitized
  // telemetry event with `meal_plan_id` + `week_start` so analysts can
  // join against the plan_events table. `variant` disambiguates shift
  // direction.
  const handleOpenWeekSheet = useCallback(() => {
    setWeekSheetVisible(true);
  }, []);

  const handleWeekSheetDismiss = useCallback(() => {
    setWeekSheetVisible(false);
  }, []);

  const handleShiftForward = useCallback(() => {
    if (!currentPlan) return;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `wk-${Date.now()}`;
    logPlanEvent({
      name: 'plan.week_shifted',
      session_id: sessionId,
      meal_plan_id: currentPlan.id,
      payload: sanitizePayload({
        variant: 'forward',
        meal_plan_id: currentPlan.id,
        week_start: currentPlan.week_start,
      }),
    });
    void useMealPlanStore.getState().shiftWeek(7);
  }, [currentPlan]);

  const handleShiftBackward = useCallback(() => {
    if (!currentPlan) return;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `wk-${Date.now()}`;
    logPlanEvent({
      name: 'plan.week_shifted',
      session_id: sessionId,
      meal_plan_id: currentPlan.id,
      payload: sanitizePayload({
        variant: 'backward',
        meal_plan_id: currentPlan.id,
        week_start: currentPlan.week_start,
      }),
    });
    void useMealPlanStore.getState().shiftWeek(-7);
  }, [currentPlan]);

  const handleDuplicateLastWeek = useCallback(() => {
    if (!currentPlan) return;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `wk-${Date.now()}`;
    logPlanEvent({
      name: 'plan.week_duplicated',
      session_id: sessionId,
      meal_plan_id: currentPlan.id,
      payload: sanitizePayload({
        meal_plan_id: currentPlan.id,
        week_start: currentPlan.week_start,
      }),
    });
    void useMealPlanStore.getState().duplicateLastWeek();
  }, [currentPlan]);

  // Phase 22-03: When the user toggles Month view, fetch a 5-week window
  // covering the current week forward. The server enforces |to-from| ≤ 70d
  // (22-00 migration 00025); we request exactly 28d here (4 weeks past the
  // current start) which combined with the anchor week yields 5 weeks.
  useEffect(() => {
    if (scale !== 'month') return;
    if (!currentPlan) return;
    const from = currentPlan.week_start;
    const to = addDaysIso(from, 28);
    // fetchRange dedupes via monthLoading, so repeated toggle firings are safe.
    void useMealPlanStore.getState().fetchRange(from, to);
    // Telemetry — plan.month_opened with the anchor week for analytics.
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `mo-${Date.now()}`;
    logPlanEvent({
      name: 'plan.month_opened',
      session_id: sessionId,
      meal_plan_id: currentPlan.id,
      payload: sanitizePayload({
        meal_plan_id: currentPlan.id,
        week_start: currentPlan.week_start,
      }),
    });
  }, [scale, currentPlan]);

  // Phase 22-03: Handler for Month empty-cell pin. Opens DatePickerSheet
  // pre-filled with the cell date. Parent owns the sheet's visibility; the
  // sheet's onConfirm POSTs /entries/assign with recipe_id:null (ad-hoc).
  const handleMonthPinCell = useCallback((iso: string) => {
    setMonthPinIso(iso);
  }, []);

  const handleMonthPinConfirm = useCallback(
    async (iso: string) => {
      setMonthPinIso(null);
      if (!currentPlan) return;
      // Empty pin: create a "needs planning" entry marker. The user will
      // typically navigate from here to /plan/[date] (22-04) to fill it in.
      // For v1 we POST a stub entry so the cell status flips to planned.
      try {
        const token = (await import('../../lib/supabase')).supabase.auth;
        const { data } = await token.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        const baseUrl =
          process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
        await fetch(`${baseUrl}/api/v1/meal-plans/entries/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            date: iso,
            title: 'Needs planning',
            description: null,
            ingredients: [],
            estimated_time_minutes: null,
            difficulty: null,
            kid_friendly: false,
            why_suggested: null,
            recipe_id: null,
          }),
        });
        // Refresh month window so the cell flips to planned.
        const from = currentPlan.week_start;
        const to = addDaysIso(from, 28);
        await useMealPlanStore.getState().fetchRange(from, to);
      } catch {
        // Silent fail — sheet already dismissed, user can retry.
      }
    },
    [currentPlan]
  );

  // Phase 22-03: Long-press on a Month cell → ActionSheetIOS with 2 mark-
  // skipped reasons. POSTs /entries/assign with status:'skipped'.
  const handleMonthMarkSkipped = useCallback(
    async (iso: string, reason: 'travel' | 'dinner party') => {
      if (!currentPlan) return;
      try {
        const token = (await import('../../lib/supabase')).supabase.auth;
        const { data } = await token.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        const baseUrl =
          process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
        await fetch(`${baseUrl}/api/v1/meal-plans/entries/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            date: iso,
            title: '—',
            description: null,
            ingredients: [],
            estimated_time_minutes: null,
            difficulty: null,
            kid_friendly: false,
            why_suggested: null,
            recipe_id: null,
            status: 'skipped',
            skip_reason: reason,
          }),
        });
        const from = currentPlan.week_start;
        const to = addDaysIso(from, 28);
        await useMealPlanStore.getState().fetchRange(from, to);
      } catch {
        // Silent fail — user can long-press again.
      }
    },
    [currentPlan]
  );

  // Phase 22-02: Regenerate via sheet re-uses the existing Alert confirm to
  // guard against accidental destructive taps, then fires telemetry + the
  // underlying generate() call. Wrapped so we can fire telemetry
  // symmetrically with the other week actions.
  const handleRegenerateFromSheet = useCallback(() => {
    if (!currentPlan) return;
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `wk-${Date.now()}`;
    Alert.alert(
      'Regenerate week?',
      'This will replace your current plan with a new 7-day plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => {
            logPlanEvent({
              name: 'plan.week_regenerated',
              session_id: sessionId,
              meal_plan_id: currentPlan.id,
              payload: sanitizePayload({
                meal_plan_id: currentPlan.id,
                week_start: currentPlan.week_start,
              }),
            });
            generate(currentPlan.week_start);
          },
        },
      ]
    );
  }, [currentPlan, generate]);

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

  // Phase 22-05: Settings → Plan → "Weekly Skill Focus banner" toggle.
  // Default true. Read reactively so flipping the toggle in Settings
  // immediately hides/shows the banner without a tab re-mount.
  const planFocusBannerEnabled = useSettingsStore(
    (s) => s.planFocusBannerEnabled
  );

  const scaleSegmentedControl = (
    <View style={styles.segmentWrap}>
      <Pressable
        onPress={() => setScale('week')}
        style={[styles.segment, scale === 'week' && styles.segmentActive]}
        accessibilityLabel="Week view"
        accessibilityState={{ selected: scale === 'week' }}
      >
        <Text
          style={[
            styles.segmentLabel,
            scale === 'week' && styles.segmentLabelActive,
          ]}
        >
          Week
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setScale('month')}
        style={[styles.segment, scale === 'month' && styles.segmentActive]}
        accessibilityLabel="Month view"
        accessibilityState={{ selected: scale === 'month' }}
      >
        <Text
          style={[
            styles.segmentLabel,
            scale === 'month' && styles.segmentLabelActive,
          ]}
        >
          Month
        </Text>
      </Pressable>
    </View>
  );

  const listHeader = (
    <View>
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
        {planFocusBannerEnabled && <FocusBanner />}
      </Animated.View>
      {scaleSegmentedControl}
    </View>
  );

  const monthHeader = (
    <View>
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
      {scaleSegmentedControl}
    </View>
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

      {/*
        Action row — Phase 22-02: single ellipsis opens WeekActionSheet
        (regenerate / shift ±1 / duplicate / shopping list). The dedicated
        "Shopping list for week" icon from 22-01 is preserved so users have
        both entry points and existing Maestro flow 32 keeps its selector.
      */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={handleShoppingHandoff}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Shopping list for week"
        >
          <SymbolIcon name="cart" size={20} tintColor="#3E332A" />
        </Pressable>
        <Pressable
          onPress={handleOpenWeekSheet}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Week actions"
        >
          <SymbolIcon name="ellipsis" size={20} tintColor="#3E332A" />
        </Pressable>
      </View>

      {error && error !== 'already_cooked' && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200" style={{ marginTop: 52 }}>
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      {/* Phase 22-03: Week | Month segmented control now lives inside each
          list's header (scaleSegmentedControl above), below the large "This
          Week" title — matches the Kitchen tab's segment-under-header rhythm. */}

      {/* Week view — stays mounted when scale='month' via display:none so
          the DayRow's scroll, swap sheet, cook confirm state all survive
          toggle-back. */}
      <View
        style={[{ flex: 1 }, scale !== 'week' && { display: 'none' }]}
        pointerEvents={scale === 'week' ? 'auto' : 'none'}
      >
        <Animated.FlatList
          data={days}
          keyExtractor={(item) => `day-${item.day}`}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <SwipeableDayRow
              entry={item.entry}
              dayLabel={DAY_LABELS[item.day]!}
              isSwapping={swappingDay === item.day}
              isCooking={cookingDay === item.day}
              onSwap={() => setSwapTarget(item.day)}
              onCook={() => setCookTarget(item.day)}
              onSkip={() => setSkipTarget(item.day)}
              onPress={() => {
                if (!item.entry) return;
                // Plan → Recipe Detail (22-01 / PLAN-X-01). When the entry
                // has a saved recipe, push onto the native stack so back
                // gesture restores the Plan tab's scroll position
                // (expo-router native-stack preserves this for free — see
                // 22-CONTEXT D-28).
                if (item.entry.recipe_id) {
                  router.push(`/recipes/${item.entry.recipe_id}`);
                  return;
                }
                // Ad-hoc entry (AI-generated, no saved recipe) — keep the
                // existing Alert preview as the detail surface.
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
      </View>

      {/* Month view — parallel mount. Contains MonthGrid + MonthPatterns
          stacked in a ScrollView. Loading skeleton via MonthGrid's `loading`
          prop. Empty map → all-empty cells + MonthPatterns empty states. */}
      <View
        style={[{ flex: 1 }, scale !== 'month' && { display: 'none' }]}
        pointerEvents={scale === 'month' ? 'auto' : 'none'}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          {monthHeader}
          <MonthGrid
            fromWeekStart={currentPlan.week_start}
            entriesByIso={monthPlans}
            loading={monthLoading && monthPlans.size === 0}
            onPinCell={handleMonthPinCell}
            onMarkSkipped={handleMonthMarkSkipped}
          />
          <MonthPatterns entries={Array.from(monthPlans.values())} />
        </ScrollView>
      </View>

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

      <HandoffSheet
        state={handoffState}
        onOpenCart={handleOpenCart}
        onRetry={handleHandoffRetry}
        onDismiss={handleHandoffDismiss}
      />

      <WeekActionSheet
        visible={weekSheetVisible}
        onDismiss={handleWeekSheetDismiss}
        onRegenerate={handleRegenerateFromSheet}
        onShiftForward={handleShiftForward}
        onShiftBackward={handleShiftBackward}
        onDuplicateLastWeek={handleDuplicateLastWeek}
        onShoppingList={handleShoppingHandoff}
      />

      {/* Phase 22-03: Month empty-cell pin sheet. Parent owns visibility —
          sheet stays mounted, re-renders when monthPinIso flips. */}
      <DatePickerSheet
        visible={monthPinIso !== null}
        initialDate={
          monthPinIso ? new Date(`${monthPinIso}T00:00:00Z`) : undefined
        }
        title="Pin to day"
        confirmLabel="Pin"
        onConfirm={handleMonthPinConfirm}
        onDismiss={() => setMonthPinIso(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
  // Phase 22-03: Week | Month segmented control (mirrors kitchen.tsx).
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.brand,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
});
