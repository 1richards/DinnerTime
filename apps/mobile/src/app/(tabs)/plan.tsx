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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { useShoppingStore } from '../../stores/shoppingStore';
import { useRecipeStore } from '../../stores/recipeStore';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { PreviewSheet } from '../recipes/discover';
import { SavedRecipeDetail } from './kitchen';
import { getRecipeImage } from '../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import type { ParsedRecipe, Recipe } from '../../types/recipe';
import { authedFetch } from '../../lib/authedFetch';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { usePantryStore } from '../../stores/pantryStore';
import { pickStretchDay } from '../../plan/stretchPicker';
import { EmptyPlanState } from '../../components/plan/EmptyPlanState';
import { FocusBanner } from '../../components/plan/FocusBanner';
import { SwapSheet } from '../../components/plan/SwapSheet';
import { CookConfirm } from '../../components/plan/CookConfirm';
import { SwipeableDayRow } from '../../components/plan/SwipeableDayRow';
import { WeekHealthChip } from '../../components/plan/WeekHealthChip';
import { AddMealSheet } from '../../components/plan/AddMealSheet';
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
import { InlineSearchPill } from '../../components/ui/SearchBar';
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

/** "M/D" short date for a day-of-week index against a week_start ISO. */
function shortDateForDay(weekStartIso: string, dayIdx: number): string {
  const iso = addDaysIso(weekStartIso, dayIdx);
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return '';
  return `${m}/${d}`;
}

/** "MON · APR 27" style label for an ISO date. */
function formatIsoForDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = DAY_LABELS[(date.getUTCDay() + 6) % 7];
  const month = MONTH_SHORT[date.getUTCMonth()];
  return `${day} · ${month} ${date.getUTCDate()}`;
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
    swapDay: _swapDay,
    applySwap,
    reorderDays,
    markCooked,
  } = useMealPlanStore();

  const [swapTarget, setSwapTarget] = useState<number | null>(null);
  // Ad-hoc plan entry the user tapped — opens a shared PreviewSheet so
  // entries that aren't backed by a saved Recipe still get a real
  // image-forward detail surface instead of a plain Alert.
  const [previewEntry, setPreviewEntry] = useState<MealPlanEntry | null>(null);
  const [previewSaving, setPreviewSaving] = useState(false);
  const [previewCooking, setPreviewCooking] = useState(false);
  const [previewCookingLater, setPreviewCookingLater] = useState(false);
  const [previewClearing, setPreviewClearing] = useState(false);
  // Cached server-expanded recipe per plan entry id, so opening the
  // preview shows real steps instead of "No steps listed." while the
  // expansion runs once and is reused across Save / Cook Now / re-opens.
  const [expandedByEntry, setExpandedByEntry] = useState<
    Record<string, ParsedRecipe>
  >({});
  const [expandingEntry, setExpandingEntry] = useState<string | null>(null);
  // Saved-recipe detail when the user taps a plan row whose entry is
  // backed by a Recipe from the library. Opens the same image-forward
  // PreviewSheet (via SavedRecipeDetail) used by Recipe Box, instead of
  // the slide-in /recipes/[id] route.
  const [savedDetail, setSavedDetail] = useState<Recipe | null>(null);
  const [savedDetailCookingLater, setSavedDetailCookingLater] = useState(false);
  const [savedDetailRemoving, setSavedDetailRemoving] = useState(false);
  const cachedRecipes = useRecipeStore((s) => s.recipes);
  const deleteRecipe = useRecipeStore((s) => s.deleteRecipe);
  // Empty-day "+ Add a meal" or month-cell tap → opens AddMealSheet
  // pre-targeted to that ISO date. Single state covers both surfaces.
  const [addMealIso, setAddMealIso] = useState<string | null>(null);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
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

  const { onScroll, largeTitleOpacity, largeTitleTranslate } =
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
        // Cleared days (status='skipped') render as empty placeholders
        // so the user can drop in a different recipe. Without this they
        // hung around as ghost rows displaying the old meal title.
        if (entry.status === 'skipped') continue;
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
  //
  // BUGFIX (2026-04-29): filter to status='available' before feeding the
  // matcher. `markItemUsed` flips `status` to 'used' but leaves the row
  // in the store (deliberately — the pantry tab itself filters by status
  // for display), and `markItemDepleted` removes the row. Without this
  // filter the chip stayed green for meals whose key ingredient had
  // been marked used.
  const pantryItems = usePantryStore((s) => s.items);
  const availablePantryItems = useMemo(
    () => pantryItems.filter((p) => p.status === 'available'),
    [pantryItems],
  );

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
                availablePantryItems,
              ),
            }
          : null;
        return { day: d, entry };
      }),
    [entriesByDay, stretchDay, availablePantryItems]
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

  // Expand a lightweight plan entry into a full ParsedRecipe with steps
  // by hitting POST /recipes/expand-from-plan-entry. The plan generator
  // intentionally returns step-less sketches (title + ingredients hint
  // only); without this call, Save / Cook Now would persist a recipe
  // with `steps: []` and the cook screen would have nothing to read.
  // On expansion failure we fall back to the in-memory previewRecipe so
  // the user still gets *something* saved rather than a hard error.
  const expandPlanEntry = useCallback(
    async (entry: MealPlanEntry, fallback: ParsedRecipe): Promise<ParsedRecipe> => {
      try {
        const response = await authedFetch('/api/v1/recipes/expand-from-plan-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: entry.title,
            description: entry.description,
            ingredients: (entry.ingredients ?? []).map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
            })),
            ingredients_needed: (entry.ingredients_needed ?? []).map((i) => ({
              name: i.name,
            })),
            estimated_time_minutes: entry.estimated_time_minutes,
            kid_friendly: entry.kid_friendly,
            why_suggested: entry.why_suggested,
            focus_theme: currentPlan?.focus_theme ?? null,
          }),
        });
        if (!response.ok) return fallback;
        const body = await response.json();
        const expanded = body?.data as ParsedRecipe | undefined;
        if (!expanded || !Array.isArray(expanded.steps) || expanded.steps.length === 0) {
          return fallback;
        }
        // Preserve fields the plan entry was already correct about so the
        // expanded recipe stays connected to the original suggestion.
        return {
          ...expanded,
          source_type: 'ai',
          // Hold onto the plan-entry image hint when expand returned no
          // image (Gemini hero generation runs separately during save).
          image_url: expanded.image_url ?? fallback.image_url,
        };
      } catch {
        return fallback;
      }
    },
    [currentPlan?.focus_theme],
  );

  // Convert a MealPlanEntry into the ParsedRecipe shape PreviewSheet
  // expects. Plan entries don't carry steps / source metadata so we
  // start with a sketch and then merge in the server-expanded recipe
  // (with real steps + quantities) once that round-trip resolves. The
  // expansion is fired eagerly on modal open via the effect below so
  // users see actual steps rather than "No steps listed."
  const previewSketch: ParsedRecipe | null = useMemo(() => {
    if (!previewEntry) return null;
    return {
      title: previewEntry.title,
      description: previewEntry.description ?? null,
      ingredients: (previewEntry.ingredients ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        notes: null,
      })),
      steps: [],
      prep_time_minutes: null,
      cook_time_minutes: null,
      total_time_minutes: previewEntry.estimated_time_minutes ?? null,
      servings: null,
      source_url: null,
      source_type: 'ai',
      image_url: null,
    };
  }, [previewEntry]);

  const previewRecipe: ParsedRecipe | null = useMemo(() => {
    if (!previewEntry || !previewSketch) return null;
    const cached = expandedByEntry[previewEntry.id];
    return cached ?? previewSketch;
  }, [previewEntry, previewSketch, expandedByEntry]);

  // Eagerly expand the plan entry into a full recipe (with steps) the
  // moment the preview opens. Caches per entry id so re-opens, Save,
  // and Cook Now all reuse the same fetched recipe instead of firing
  // another Claude call.
  useEffect(() => {
    if (!previewEntry || !previewSketch) return;
    if (expandedByEntry[previewEntry.id]) return;
    if (expandingEntry === previewEntry.id) return;
    let cancelled = false;
    setExpandingEntry(previewEntry.id);
    (async () => {
      const expanded = await expandPlanEntry(previewEntry, previewSketch);
      if (cancelled) return;
      // Only cache when expansion actually produced steps — otherwise
      // we'd lock the preview into the empty-step fallback and a
      // subsequent retry would never run.
      if (expanded.steps.length > 0) {
        setExpandedByEntry((prev) => ({
          ...prev,
          [previewEntry.id]: expanded,
        }));
      }
      setExpandingEntry((cur) => (cur === previewEntry.id ? null : cur));
    })();
    return () => {
      cancelled = true;
    };
  }, [previewEntry, previewSketch, expandedByEntry, expandingEntry, expandPlanEntry]);

  // Swap commit: SwapSheet hands us the user's chosen ParsedRecipe;
  // applySwap upserts it onto the targeted day via /entries/assign and
  // refetches the plan.
  const handleSwapSelect = useCallback(
    async (recipe: import('../../types/recipe').ParsedRecipe) => {
      if (swapTarget == null) return;
      await applySwap(swapTarget, recipe);
    },
    [swapTarget, applySwap],
  );

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

  // Clear flow — formerly "skip" with a free-form reason prompt. The
  // user just wants the row gone; we fire skipDay (which marks the
  // entry skipped server-side) without asking why, and filter
  // skipped entries from the rendered week so the day appears empty.
  useEffect(() => {
    if (skipTarget == null) return;
    void useMealPlanStore.getState().skipDay(skipTarget, null);
    setSkipTarget(null);
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

  // Month-cell tap → open the same AddMealSheet recipe picker the
  // week view's empty-day tap uses. Single picker for both surfaces
  // keeps the add-to-plan flow consistent.
  const handleMonthPinCell = useCallback((iso: string) => {
    setAddMealIso(iso);
  }, []);

  const handleMonthPinConfirm = useCallback(
    async (iso: string) => {
      setMonthPinIso(null);
      if (!currentPlan) return;
      // Empty pin: create a "needs planning" entry marker. The user will
      // typically tap the cell again to open the PreviewSheet modal and
      // edit it. For v1 we POST a stub entry so the cell status flips
      // to planned.
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

  // Phase 22-05: Settings → Plan → "Weekly Skill Focus banner" toggle.
  // Default true. Read reactively so flipping the toggle in Settings
  // immediately hides/shows the banner without a tab re-mount. MUST run
  // before the early returns below — placing it after the conditionals
  // caused "rendered more hooks than during the previous render" when
  // currentPlan transitions null → populated.
  const planFocusBannerEnabled = useSettingsStore(
    (s) => s.planFocusBannerEnabled
  );

  // At-a-glance health vibe for the current week — slots into the same
  // row as the shopping cart + ellipsis so users see the vibe without
  // tapping into details. MUST live above the early returns below for
  // the same Rules-of-Hooks reason as planFocusBannerEnabled — when
  // currentPlan transitions null → populated, the early-return path
  // doesn't call this hook, so placing it in the post-return body is
  // a "rendered more hooks than during the previous render" crash.
  const weekHealthEntries = useMemo(
    () => (currentPlan?.entries ?? []).map((e) => ({
      title: e.title,
      description: e.description,
      ingredients: e.ingredients,
    })),
    [currentPlan?.entries],
  );

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

  const planActionsRow = (
    <View style={styles.planActionsRow}>
      <View style={styles.planActionsLeft}>
        <WeekHealthChip entries={weekHealthEntries} />
      </View>
      <Pressable
        onPress={handleShoppingHandoff}
        accessibilityLabel="Shopping list for week"
        hitSlop={8}
        style={({ pressed }) => [
          styles.planActionIconBtn,
          pressed && styles.planActionBtnPressed,
        ]}
      >
        <SymbolIcon name="cart" size="action" weight="semibold" tintColor={colors.brand} />
      </Pressable>
      <Pressable
        onPress={handleOpenWeekSheet}
        accessibilityLabel="Week actions"
        hitSlop={8}
        style={({ pressed }) => [
          styles.planActionIconBtn,
          pressed && styles.planActionBtnPressed,
        ]}
      >
        <SymbolIcon name="ellipsis" size="action" weight="semibold" tintColor={colors.brand} />
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
      </Animated.View>
      <InlineSearchPill placeholder="Search recipes to add" context="library" />
      {scaleSegmentedControl}
      {planFocusBannerEnabled && <FocusBanner />}
      {planActionsRow}
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
      <InlineSearchPill placeholder="Search recipes to add" context="library" />
      {scaleSegmentedControl}
      {planActionsRow}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {/* Compact nav bar removed — large "This Week" title scrolls off
          naturally so the list consumes full vertical real estate. */}

      {/* Action row moved inline into each list header below the Week/Month
          segmented control (see planActionsRow in scaleSegmentedControl's
          vicinity). Top-floating action cluster removed for header/content
          rhythm parity with Kitchen. */}

      {error && error !== 'already_cooked' && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200" style={{ marginTop: 8 }}>
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      {/* Regenerate-in-flight overlay — covers the whole plan surface
          when the user kicks off /meal-plans/generate (Set focus →
          Regenerate, week shift, etc.) so they aren't staring at the
          stale week with no signal anything is happening. The first-
          generate path renders a separate full-screen spinner above
          (loading && !currentPlan); this branch is the regenerate
          case where currentPlan still resolves to the OLD plan. */}
      {loading && currentPlan && (
        <View pointerEvents="auto" style={styles.regeneratingOverlay}>
          <View style={styles.regeneratingCard}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.regeneratingTitle}>
              Rebuilding your week…
            </Text>
            <Text style={styles.regeneratingSub}>
              {currentPlan.focus_theme
                ? `Leaning into “${currentPlan.focus_theme}”. Takes ~10–20 seconds.`
                : 'Takes about 10–20 seconds.'}
            </Text>
          </View>
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
        <DraggableFlatList
          data={days}
          keyExtractor={(item) => `day-${item.day}`}
          ListHeaderComponent={listHeader}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          activationDistance={8}
          onDragEnd={({ data }) => {
            // Walk the new order and persist any entry whose
            // day_of_week needs to change. Empty slots are skipped —
            // they have no entry to assign.
            const changes: Record<string, number> = {};
            data.forEach((row, idx) => {
              if (row.entry && row.entry.day_of_week !== idx) {
                changes[row.entry.id] = idx;
              }
            });
            if (Object.keys(changes).length === 0) return;
            void reorderDays(changes);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<typeof days[number]>) => (
            <SwipeableDayRow
              entry={item.entry}
              dayLabel={DAY_LABELS[item.day]!}
              dateLabel={shortDateForDay(currentPlan.week_start, item.day)}
              isSwapping={swappingDay === item.day}
              isCooking={cookingDay === item.day}
              onSwap={() => setSwapTarget(item.day)}
              onCook={() => setCookTarget(item.day)}
              onSkip={() => setSkipTarget(item.day)}
              onPress={() => {
                if (!item.entry) {
                  // Empty day → open recipe picker scoped to this date.
                  if (currentPlan) {
                    setAddMealIso(addDaysIso(currentPlan.week_start, item.day));
                  }
                  return;
                }
                if (item.entry.recipe_id) {
                  // Open the same image-forward PreviewSheet modal used by
                  // Recipe Box. Falls back to the entry-snapshot preview if
                  // the saved recipe isn't in the local cache (rare — the
                  // store is persisted and prefetched).
                  const cached = cachedRecipes.find(
                    (r) => r.id === item.entry!.recipe_id,
                  );
                  if (cached) {
                    setSavedDetail(cached);
                    return;
                  }
                }
                setPreviewEntry(item.entry);
              }}
              onLongPress={item.entry ? drag : undefined}
              isDragActive={isActive}
            />
          )}
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
            onEntryPress={(entry) => {
              if (entry.recipe_id) {
                const cached = cachedRecipes.find(
                  (r) => r.id === entry.recipe_id,
                );
                if (cached) {
                  setSavedDetail(cached);
                  return;
                }
              }
              setPreviewEntry(entry);
            }}
            onPinCell={handleMonthPinCell}
            onMarkSkipped={handleMonthMarkSkipped}
          />
          <MonthPatterns entries={Array.from(monthPlans.values())} />
        </ScrollView>
      </View>

      <SwapSheet
        visible={swapTarget != null}
        currentEntry={swapTarget != null ? entriesByDay.get(swapTarget) ?? null : null}
        day={swapTarget}
        onSelect={handleSwapSelect}
        onClose={() => setSwapTarget(null)}
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

      <AddMealSheet
        visible={addMealIso !== null}
        isoDate={addMealIso}
        dayLabel={addMealIso ? formatIsoForDayLabel(addMealIso) : null}
        onSelect={async (recipe) => {
          if (!addMealIso) return;
          // addToPlan upserts on (week, date) — handles both same-week
          // (week-view tap) and other-week (month-view tap) cases.
          await useMealPlanStore.getState().addToPlan(
            addMealIso,
            {
              title: recipe.title,
              description: recipe.description,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
              prep_time_minutes: recipe.prep_time_minutes,
              cook_time_minutes: recipe.cook_time_minutes,
              total_time_minutes: recipe.total_time_minutes,
              servings: recipe.servings,
              source_url: recipe.source_url,
              source_type: recipe.source_type,
              image_url: recipe.image_url,
            },
            recipe.id,
          );
        }}
        onClose={() => setAddMealIso(null)}
      />

      {/* Ad-hoc plan entry preview — Modal + PreviewSheet so unsaved
          AI plan entries get the same image-forward detail surface as
          Something New / Recipe Box previews. Save persists, Cook Now
          saves and jumps into the cooking flow. */}
      <Modal
        visible={previewEntry !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewEntry(null)}
      >
        {previewEntry && previewRecipe && (
          <PlanEntryPreview
            entry={previewEntry}
            recipe={previewRecipe}
            saving={previewSaving}
            cooking={previewCooking}
            cookingLater={previewCookingLater}
            clearing={previewClearing}
            stepsLoading={
              expandingEntry === previewEntry.id &&
              !expandedByEntry[previewEntry.id]
            }
            onClear={async () => {
              if (!previewEntry) return;
              setPreviewClearing(true);
              try {
                await useMealPlanStore.getState().skipDay(
                  previewEntry.day_of_week,
                  null,
                );
                setPreviewEntry(null);
              } finally {
                setPreviewClearing(false);
              }
            }}
            onClose={() => setPreviewEntry(null)}
            onSave={async () => {
              setPreviewSaving(true);
              try {
                // Use the eagerly-expanded recipe if the preview's
                // open-time fetch already populated it. Otherwise fall
                // back to running the expansion now (covers the rare
                // race where the user taps Save before the eager
                // fetch returns).
                const cached = expandedByEntry[previewEntry.id];
                const expanded =
                  cached ?? (await expandPlanEntry(previewEntry, previewRecipe));
                await saveRecipe({ ...expanded, source_type: 'ai' });
                setPreviewEntry(null);
              } finally {
                setPreviewSaving(false);
              }
            }}
            onCookNow={async () => {
              setPreviewCooking(true);
              try {
                const cached = expandedByEntry[previewEntry.id];
                const expanded =
                  cached ?? (await expandPlanEntry(previewEntry, previewRecipe));
                const beforeIds = new Set(
                  useRecipeStore.getState().recipes.map((r) => r.id),
                );
                await saveRecipe({ ...expanded, source_type: 'ai' });
                const state = useRecipeStore.getState();
                if (state.error) return;
                const created = state.recipes.find((r) => !beforeIds.has(r.id));
                const cookId = created?.id ?? state.recipes[0]?.id;
                setPreviewEntry(null);
                if (cookId) router.push(`/recipes/${cookId}/cook`);
              } finally {
                setPreviewCooking(false);
              }
            }}
            onCookLater={async (iso) => {
              setPreviewCookingLater(true);
              try {
                await useMealPlanStore.getState().addToPlan(
                  iso,
                  previewRecipe,
                  null,
                );
                setPreviewEntry(null);
              } finally {
                setPreviewCookingLater(false);
              }
            }}
          />
        )}
      </Modal>

      <WeekActionSheet
        visible={weekSheetVisible}
        onDismiss={handleWeekSheetDismiss}
        onRegenerate={handleRegenerateFromSheet}
        onShiftForward={handleShiftForward}
        onShiftBackward={handleShiftBackward}
        onDuplicateLastWeek={handleDuplicateLastWeek}
        onShoppingList={handleShoppingHandoff}
      />

      {/* Saved-recipe detail — opens the same image-forward PreviewSheet
          (via SavedRecipeDetail) used by Recipe Box when the user taps a
          plan row backed by a Recipe in their library. Replaces the
          previous slide-in /recipes/[id] navigation. */}
      <Modal
        visible={savedDetail !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSavedDetail(null)}
      >
        {savedDetail && (
          <SavedRecipeDetail
            recipe={savedDetail}
            cookingLater={savedDetailCookingLater}
            removing={savedDetailRemoving}
            onClose={() => setSavedDetail(null)}
            onRemove={async () => {
              const confirmed = await new Promise<boolean>((resolve) => {
                Alert.alert(
                  'Remove from library?',
                  `"${savedDetail.title}" will be deleted from your Recipe Box.`,
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
                  ],
                );
              });
              if (!confirmed) return;
              setSavedDetailRemoving(true);
              try {
                await deleteRecipe(savedDetail.id);
                setSavedDetail(null);
              } finally {
                setSavedDetailRemoving(false);
              }
            }}
            onCookNow={async () => {
              const id = savedDetail.id;
              setSavedDetail(null);
              router.push(`/recipes/${id}/cook`);
            }}
            onCookLater={async (iso) => {
              setSavedDetailCookingLater(true);
              try {
                await useMealPlanStore.getState().addToPlan(
                  iso,
                  {
                    title: savedDetail.title,
                    description: savedDetail.description,
                    ingredients: savedDetail.ingredients,
                    steps: savedDetail.steps,
                    prep_time_minutes: savedDetail.prep_time_minutes,
                    cook_time_minutes: savedDetail.cook_time_minutes,
                    total_time_minutes: savedDetail.total_time_minutes,
                    servings: savedDetail.servings,
                    source_url: savedDetail.source_url,
                    source_type: savedDetail.source_type,
                    image_url: savedDetail.image_url,
                  },
                  savedDetail.id,
                );
                setSavedDetail(null);
              } finally {
                setSavedDetailCookingLater(false);
              }
            }}
          />
        )}
      </Modal>

    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// PlanEntryPreview — wraps the shared PreviewSheet with the Gemini image
// hook so ad-hoc plan entries get the same generated photo the plan tile
// shows. Extracted because the hook can't be called inside the parent's
// onPress / Modal-children render path.
// ----------------------------------------------------------------------------

interface PlanEntryPreviewProps {
  entry: MealPlanEntry;
  recipe: ParsedRecipe;
  saving: boolean;
  cooking: boolean;
  cookingLater: boolean;
  clearing: boolean;
  /** True while the eager AI expansion is in flight; lets PreviewSheet
      show "Generating steps…" instead of "No steps listed." */
  stepsLoading: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onCookNow: () => Promise<void>;
  onCookLater: (iso: string) => Promise<void>;
  onClear: () => Promise<void>;
}

function PlanEntryPreview({
  entry,
  recipe,
  saving,
  cooking,
  cookingLater,
  clearing,
  stepsLoading,
  onClose,
  onSave,
  onCookNow,
  onCookLater,
  onClear,
}: PlanEntryPreviewProps) {
  const { url: generatedUri } = useGeneratedRecipeImage(entry.title, {
    description: entry.description ?? null,
    ingredients: recipe.ingredients,
  });
  const heroUri = getRecipeImage(
    `plan-${entry.id}-${entry.title}`,
    generatedUri,
    entry.title,
  );
  return (
    <PreviewSheet
      recipe={{ ...recipe, _saved: false }}
      heroUri={heroUri}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      onCookNow={onCookNow}
      cooking={cooking}
      onCookLater={onCookLater}
      cookingLater={cookingLater}
      onRemove={onClear}
      removing={clearing}
      removeLabel="Clear"
      hideRemix
      stepsLoading={stepsLoading}
    />
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
  regeneratingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 251, 245, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  regeneratingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
    maxWidth: 320,
    gap: 12,
  },
  regeneratingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.2,
    marginTop: 4,
    textAlign: 'center',
  },
  regeneratingSub: {
    fontSize: 13,
    color: '#7A6651',
    textAlign: 'center',
    lineHeight: 18,
  },
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
  // Inline Plan actions — icon-only shopping list + week actions. Right-
  // aligned below the FocusBanner to match Kitchen's toolbar rhythm.
  planActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  planActionsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planActionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planActionBtnPressed: {
    opacity: 0.6,
  },
});
