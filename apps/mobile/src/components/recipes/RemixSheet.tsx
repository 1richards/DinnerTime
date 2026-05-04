import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { PickerSheet } from '../ui/PickerSheet';
import { OptionCard } from '../ui/OptionCard';
import {
  useProgressionStore,
  type RemixMode,
  type RemixVariation,
  type VariationContext,
} from '../../stores/progressionStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { supabase } from '../../lib/supabase';
import { PreviewSheet, type DiscoveredRecipe } from '../../app/recipes/discover';
import { getRecipeImage } from '../../constants/foodImages';
import {
  prefetchGeneratedRecipeImage,
  useGeneratedRecipeImage,
} from '../../hooks/useGeneratedRecipeImage';
import type { ParsedRecipe } from '../../types/recipe';
import { colors } from '../../design/tokens';

/**
 * RemixSheet accepts one of two sources:
 * - `{ kind: 'saved', recipeId }`: looks up the recipe via GET variations
 * - `{ kind: 'inline', context }`: uses POST variations for unsaved data
 *
 * Each variation card offers three commits:
 *   1. Expand — fetch the full ParsedRecipe from POST /recipes/remix and
 *      open it in a PreviewSheet for review.
 *   2. Save as new recipe — persist the full ParsedRecipe as a new library
 *      entry (source_type: 'ai').
 *   3. Modify existing recipe — only when source.kind === 'saved'; replaces
 *      the source recipe's contents with the variation via updateRecipe.
 */
export type RemixSource =
  | { kind: 'saved'; recipeId: string }
  | { kind: 'inline'; context: VariationContext };

/** Loose ingredient shape — accepts both typed ParsedIngredient and
    server-side variants without forcing callers into a strict type. */
interface BaseIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}

interface RemixSheetProps {
  visible: boolean;
  recipeTitle: string;
  /** The base recipe context used for both variation generation and save. */
  source: RemixSource;
  /** Optional base ingredients/steps for save-as-recipe expansion. */
  baseForSave?: {
    title: string;
    description?: string | null;
    ingredients?: Array<string | BaseIngredient>;
    steps?: string[];
    total_time_minutes?: number | null;
  };
  /** Plan-flow override. When provided, the variation cards' Save bookmark
      becomes an "Apply to this day" calendar action instead. Tap → expand
      variation to a full ParsedRecipe → save to library → onApplyToDay(full)
      → close sheet. Used by the Plan tab's day-preview Remix flow so
      picking a variation atomically replaces the day's plan entry. */
  onApplyToDay?: (full: ParsedRecipe) => Promise<void>;
  onClose: () => void;
}

interface ModeOption {
  mode: RemixMode;
  label: string;
  sub: string;
  symbol: string; // SF Symbol name
  tint: string; // chip background + symbol tint color
}

const MODES: ModeOption[] = [
  { mode: 'surprise', label: 'Surprise me', sub: 'A bold creative twist', symbol: 'sparkles', tint: colors.brand },
  { mode: 'protein', label: 'Swap protein', sub: 'Change the star', symbol: 'flame.fill', tint: colors.brand },
  { mode: 'add_protein', label: 'Add protein', sub: 'Bulk it up', symbol: 'plus.circle.fill', tint: colors.brand },
  { mode: 'veggies', label: 'Swap veggies', sub: 'Different flavor', symbol: 'leaf.fill', tint: colors.success },
  { mode: 'vegetarian', label: 'Vegetarian', sub: 'Drop the meat', symbol: 'carrot.fill', tint: colors.success },
  { mode: 'quicker', label: 'Quicker', sub: 'Shortcut the time', symbol: 'bolt.fill', tint: colors.brand },
  { mode: 'harder', label: 'Challenging', sub: 'Level up technique', symbol: 'star.fill', tint: colors.warning },
  { mode: 'healthier', label: 'Healthier', sub: 'Lighter, leaner', symbol: 'heart.fill', tint: colors.success },
  { mode: 'decadent', label: 'Decadent', sub: 'Rich, indulgent', symbol: 'crown.fill', tint: colors.warning },
];

// Non-Surprise modes flow into a flat 3-column grid below the hero
// card. The earlier 2-col paired sections (Protein / Veggies /
// Difficulty / Health) put labels on the equator of each section title,
// which made the page feel taller and choppier than it needed to be.
const GRID_MODES: ModeOption[] = MODES.slice(1);

const SURPRISE_MODE = MODES[0]!;

const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not authenticated');
  return data.session.access_token;
}

// Shared call — POSTs to /recipes/remix and returns the expanded ParsedRecipe.
// All three commit actions (expand, save-new, modify-existing) hit this endpoint.
//
// Timeout discipline: Claude can take 7-30s to rewrite a full recipe. Without
// an upper bound, a wedged network leaves the variation card spinner running
// indefinitely (the symptom in remix-variation-expand-hangs). We bound at 45s
// via AbortController — long enough for slow but real Claude responses
// (recent server log shows 7-10s typical, occasional 30s+), short enough
// that a hung connection surfaces as a visible error rather than a stuck UI.
const REMIX_TIMEOUT_MS = 45_000;

async function fetchRemixedRecipe(
  base: RemixSheetProps['baseForSave'] extends infer T ? T : never,
  variation: RemixVariation,
): Promise<ParsedRecipe> {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMIX_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/recipes/remix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ base, variation }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      throw new Error('Remix took too long. Try again.');
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string }).error ?? 'Failed to generate recipe',
    );
  }
  const body = (await res.json()) as { data?: ParsedRecipe };
  if (!body || !body.data || typeof body.data !== 'object') {
    // Defensive: malformed payload silently set `full = undefined` before,
    // which left the expand handler in a "ok-but-no-modal" limbo. Now we
    // throw so ensureFull's catch surfaces an error state on the card.
    throw new Error('Remix response was empty. Try again.');
  }
  return body.data;
}

export function RemixSheet({
  visible,
  recipeTitle,
  source,
  baseForSave,
  onApplyToDay,
  onClose,
}: RemixSheetProps) {
  const fetchVariations = useProgressionStore((s) => s.fetchVariations);
  const fetchVariationsForContext = useProgressionStore(
    (s) => s.fetchVariationsForContext,
  );
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  const [selectedMode, setSelectedMode] = useState<RemixMode | null>(null);
  const [variations, setVariations] = useState<RemixVariation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Free-form steering — user types something like "add Mediterranean spices"
  // or "swap dairy for plant-based" and it's forwarded to the variation
  // generator alongside the chosen mode.
  const [customInstructions, setCustomInstructions] = useState('');

  // Per-variation state
  const [fullByIdx, setFullByIdx] = useState<Record<number, ParsedRecipe>>({});
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [workingIdx, setWorkingIdx] = useState<number | null>(null);
  const [workingAction, setWorkingAction] = useState<
    'expand' | 'save' | 'modify' | 'cook' | 'remix' | 'apply' | null
  >(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());
  const [modifiedIdxs, setModifiedIdxs] = useState<Set<number>>(new Set());
  // Per-card error message — surfaces timeout / parse / network failures as
  // a visible state on the card rather than silently leaving the spinner
  // running. Cleared on retry. Without this, ensureFull's old behavior was
  // Alert.alert + return null, which on iOS sometimes raced with Modal
  // dismissal and the alert never showed (this was a likely cause of the
  // user-reported "stuck loading state" — visible spinner, no alert, no
  // modal). Inline error state survives modal lifecycle races.
  const [errorByIdx, setErrorByIdx] = useState<Record<number, string>>({});
  // Nested remix — when a user taps the sparkle icon on a variation card we
  // expand that variation to a full ParsedRecipe (so the nested sheet has
  // ingredients to anchor against), then mount another RemixSheet inline.
  const [nestedRemixContext, setNestedRemixContext] =
    useState<VariationContext | null>(null);

  useEffect(() => {
    if (!visible) {
      // Reset when the modal closes so next open starts fresh.
      setSelectedMode(null);
      setVariations(null);
      setLoading(false);
      setError(null);
      setFullByIdx({});
      setExpandedIdx(null);
      setWorkingIdx(null);
      setWorkingAction(null);
      setSavedIdxs(new Set());
      setModifiedIdxs(new Set());
      setCustomInstructions('');
      setNestedRemixContext(null);
      setErrorByIdx({});
    }
  }, [visible]);

  const resolveBase = (): NonNullable<RemixSheetProps['baseForSave']> => {
    return (
      baseForSave ??
      (source.kind === 'inline'
        ? {
            title: source.context.title,
            description: source.context.description ?? null,
            ingredients: source.context.ingredients,
            total_time_minutes: source.context.total_time_minutes ?? null,
          }
        : { title: recipeTitle })
    );
  };

  // Returns the cached full recipe if present, otherwise fetches it.
  const ensureFull = async (
    idx: number,
    variation: RemixVariation,
  ): Promise<ParsedRecipe | null> => {
    if (fullByIdx[idx]) return fullByIdx[idx];
    // Clear any prior error so a retry doesn't show stale state.
    setErrorByIdx((prev) => {
      if (prev[idx] === undefined) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    try {
      const full = await fetchRemixedRecipe(resolveBase(), variation);
      setFullByIdx((prev) => ({ ...prev, [idx]: full }));
      return full;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Remix failed. Try again.';
      // Inline error state on the card. Replaces Alert.alert which sometimes
      // failed to surface from inside nested Modals on iOS — leaving the
      // user with a stuck-looking spinner (the bug we're fixing here).
      setErrorByIdx((prev) => ({ ...prev, [idx]: message }));
      return null;
    }
  };

  const handleMode = async (mode: RemixMode) => {
    setSelectedMode(mode);
    setLoading(true);
    setError(null);
    setVariations(null);
    setSavedIdxs(new Set());
    setModifiedIdxs(new Set());
    setFullByIdx({});

    const trimmedCustom = customInstructions.trim();
    const result =
      source.kind === 'saved'
        ? await fetchVariations(source.recipeId, mode, trimmedCustom)
        : await fetchVariationsForContext(source.context, mode, trimmedCustom);

    setLoading(false);
    if (result === null) {
      setError('Could not fetch variations. Try again?');
      return;
    }
    setVariations(result);

    // Pre-warm Gemini image generation for each variation as soon as titles
    // arrive — overlaps the round-trip with the variations-fetch wait so
    // cards mount with the inflight promise already in cache. Uses base
    // recipe ingredients as visual anchors (same shape VariationCard uses).
    const baseIngredientsForPrefetch = baseForSave?.ingredients ?? null;
    const normalized =
      baseIngredientsForPrefetch && baseIngredientsForPrefetch.length > 0
        ? baseIngredientsForPrefetch.map((i) =>
            typeof i === 'string'
              ? { name: i, quantity: null, unit: null, notes: null }
              : {
                  name: i.name,
                  quantity: i.quantity ?? null,
                  unit: i.unit ?? null,
                  notes: i.notes ?? null,
                },
          )
        : null;
    for (const v of result) {
      prefetchGeneratedRecipeImage(v.title, {
        description: v.description,
        ingredients: normalized,
      });
    }
  };

  const handleTryAnother = () => {
    setSelectedMode(null);
    setVariations(null);
    setError(null);
    setSavedIdxs(new Set());
    setModifiedIdxs(new Set());
    setFullByIdx({});
  };

  const handleExpand = async (idx: number, variation: RemixVariation) => {
    setWorkingIdx(idx);
    setWorkingAction('expand');
    const full = await ensureFull(idx, variation);
    setWorkingIdx(null);
    setWorkingAction(null);
    if (full) setExpandedIdx(idx);
  };

  const handleSaveAsNew = async (
    idx: number,
    variation: RemixVariation,
    imageUri: string | null = null,
  ) => {
    setWorkingIdx(idx);
    setWorkingAction('save');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;
      // Pass through the variation card's already-resolved Gemini hero so
      // the saved recipe persists with the same image the user just saw.
      // Without this, the saved row has image_url=null and the recipe
      // detail page generates a fresh image (often different framing /
      // garnish) for the same title — confusing visual jump.
      await saveRecipe({
        ...full,
        image_url: full.image_url ?? imageUri,
        source_type: 'ai',
      });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        return;
      }
      setSavedIdxs((prev) => new Set([...prev, idx]));
    } finally {
      setWorkingIdx(null);
      setWorkingAction(null);
    }
  };

  // Plan-flow path: save the variation to the library AND replace the
  // calling day's plan entry. Two-step persistence keeps the variation
  // available for future weeks (vs. a one-off plan entry that vanishes
  // when the week is regenerated). Closes the sheet on success so the
  // user lands back on the Plan tab with the swap already reflected.
  const handleApplyToDay = async (idx: number, variation: RemixVariation) => {
    if (!onApplyToDay) return;
    setWorkingIdx(idx);
    setWorkingAction('apply');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;
      // Save to library first so the recipe persists across weeks.
      await saveRecipe({ ...full, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        return;
      }
      setSavedIdxs((prev) => new Set([...prev, idx]));
      // Then assign to the day. Parent owns the actual /entries/assign call.
      await onApplyToDay(full);
      // Close the remix sheet — caller closes its parent preview itself.
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not apply',
        e instanceof Error ? e.message : 'Try again.',
      );
    } finally {
      setWorkingIdx(null);
      setWorkingAction(null);
    }
  };

  const handleModifyExisting = async (
    idx: number,
    variation: RemixVariation,
  ) => {
    if (source.kind !== 'saved') return;
    setWorkingIdx(idx);
    setWorkingAction('modify');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;
      await updateRecipe(source.recipeId, {
        title: full.title,
        description: full.description,
        ingredients: full.ingredients,
        steps: full.steps,
        prep_time_minutes: full.prep_time_minutes,
        cook_time_minutes: full.cook_time_minutes,
        total_time_minutes: full.total_time_minutes,
        servings: full.servings,
        image_url: full.image_url,
      });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Update failed', state.error);
        return;
      }
      setModifiedIdxs((prev) => new Set([...prev, idx]));
    } finally {
      setWorkingIdx(null);
      setWorkingAction(null);
    }
  };

  // Nested remix — expand the tapped variation into a full ParsedRecipe so
  // the inner RemixSheet has ingredients to anchor variations against, then
  // open a nested sheet using that as inline context. Reuses the cached
  // expansion when available so this is free for variations the user has
  // already previewed.
  const handleRemixVariation = async (
    idx: number,
    variation: RemixVariation,
  ) => {
    setWorkingIdx(idx);
    setWorkingAction('remix');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;
      setNestedRemixContext({
        title: full.title,
        description: full.description ?? null,
        ingredients: full.ingredients,
        total_time_minutes: full.total_time_minutes ?? null,
      });
    } finally {
      setWorkingIdx(null);
      setWorkingAction(null);
    }
  };

  const handleOpenSaved = () => {
    // Close the sheet and navigate to the most recent recipe in the store
    // (the one we just saved).
    const all = useRecipeStore.getState().recipes;
    if (all.length > 0) {
      onClose();
      router.push(`/recipes/${all[0].id}`);
    }
  };

  const handleOpenModified = () => {
    if (source.kind !== 'saved') return;
    onClose();
    router.push(`/recipes/${source.recipeId}`);
  };

  // Cook Now: persist the variation, then jump straight into the cooking flow.
  // Saved-source remix → modify existing + cook against source.recipeId.
  // Inline-source remix → save as new + cook against the newly created id.
  const handleCookNow = async (idx: number, variation: RemixVariation) => {
    setWorkingIdx(idx);
    setWorkingAction('cook');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;

      let cookId: string | null = null;

      if (source.kind === 'saved') {
        await updateRecipe(source.recipeId, {
          title: full.title,
          description: full.description,
          ingredients: full.ingredients,
          steps: full.steps,
          prep_time_minutes: full.prep_time_minutes,
          cook_time_minutes: full.cook_time_minutes,
          total_time_minutes: full.total_time_minutes,
          servings: full.servings,
          image_url: full.image_url,
        });
        if (useRecipeStore.getState().error) {
          Alert.alert('Update failed', useRecipeStore.getState().error!);
          return;
        }
        setModifiedIdxs((prev) => new Set([...prev, idx]));
        cookId = source.recipeId;
      } else {
        const beforeIds = new Set(
          useRecipeStore.getState().recipes.map((r) => r.id),
        );
        await saveRecipe({ ...full, source_type: 'ai' });
        const state = useRecipeStore.getState();
        if (state.error) {
          Alert.alert('Save failed', state.error);
          return;
        }
        setSavedIdxs((prev) => new Set([...prev, idx]));
        const newRecipe = state.recipes.find((r) => !beforeIds.has(r.id));
        cookId = newRecipe?.id ?? state.recipes[0]?.id ?? null;
      }

      if (cookId) {
        onClose();
        router.push(`/recipes/${cookId}/cook`);
      }
    } finally {
      setWorkingIdx(null);
      setWorkingAction(null);
    }
  };

  const expandedVariation =
    expandedIdx !== null && variations ? variations[expandedIdx] : null;
  const expandedFull = expandedIdx !== null ? fullByIdx[expandedIdx] : undefined;

  // Hero slot for the PickerSheet — combines the Surprise hero card and the
  // free-form custom-instructions row. Both sit above the 2-col grid of
  // mode tiles when the user is at the picker step.
  const pickerHero = (
    <>
      <View style={styles.customInputRow}>
        <SymbolIcon
          name="wand.and.stars"
          size={18}
          tintColor={colors.textSecondary}
          weight="semibold"
        />
        <TextInput
          style={styles.customInput}
          value={customInstructions}
          onChangeText={setCustomInstructions}
          placeholder="Custom instructions (optional)"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (customInstructions.trim().length > 0) handleMode('surprise');
          }}
          multiline={false}
        />
        {customInstructions.length > 0 && (
          <>
            <Pressable
              onPress={() => setCustomInstructions('')}
              hitSlop={8}
              accessibilityLabel="Clear custom instructions"
            >
              <SymbolIcon
                name="xmark.circle.fill"
                size={18}
                tintColor={colors.textTertiary}
              />
            </Pressable>
            <Pressable
              onPress={() => handleMode('surprise')}
              hitSlop={8}
              accessibilityLabel="Generate variations from custom instructions"
              style={({ pressed }) => [
                styles.customSubmitBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <SymbolIcon
                name="arrow.up.circle.fill"
                size={28}
                tintColor={colors.brand}
              />
            </Pressable>
          </>
        )}
      </View>

      {/* Surprise me — full-width hero card. Visual language matches the
          OptionCards below (white surface, tinted icon chip, dark text) so
          the page reads as a coherent family. The brand accent owns the
          chip so this card remains the visual anchor of the page. */}
      <Pressable
        onPress={() => handleMode('surprise')}
        accessibilityRole="button"
        accessibilityLabel={`${SURPRISE_MODE.label}: ${SURPRISE_MODE.sub}`}
        style={({ pressed }) => [
          styles.surpriseCard,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.surpriseChip}>
          <SymbolIcon
            name="sparkles"
            size={26}
            tintColor={colors.brand}
            weight="semibold"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.surpriseLabel}>{SURPRISE_MODE.label}</Text>
          <Text style={styles.surpriseSub}>{SURPRISE_MODE.sub}</Text>
        </View>
      </Pressable>
    </>
  );

  return (
    <>
      {/* Mode picker step — shared PickerSheet shell with 2-col OptionCard
          grid. Mounts only when no mode is selected; otherwise the
          post-pick Modal below owns the visible surface. */}
      {!selectedMode && (
        <PickerSheet
          visible={visible}
          kicker="REMIX"
          title={recipeTitle}
          onClose={onClose}
          heroSlot={pickerHero}
        >
          <View style={styles.modeGrid}>
            {GRID_MODES.map((m) => (
              <View key={m.mode} style={styles.modeCell}>
                <OptionCard
                  label={m.label}
                  sub={m.sub}
                  symbol={m.symbol as never}
                  tint={m.tint}
                  onPress={() => handleMode(m.mode)}
                  accessibilityLabel={`${m.label}: ${m.sub}`}
                />
              </View>
            ))}
          </View>
        </PickerSheet>
      )}

      {/* Post-pick states — loading / error / results / expanded-preview ALL
          live inside ONE fullScreen Modal. PickerSheet only owns the picker
          step.

          Why a single Modal instead of two siblings: iOS UIKit's
          presentation stack does not handle two sibling <Modal> components
          both visible=true reliably. Previous fixes (79b07b3, 348e60f)
          tried tweaking presentationStyle on the inner expanded-preview
          Modal — those fixed direct entry chains (Recipe Box) but left the
          Plan-tab chain (PlanEntryPreview pageSheet → PickerSheet pageSheet
          → variations Modal → expand Modal) presenting four nested view
          controllers, which silently dropped the inner expand on iOS.

          Solution: render the expanded preview content as conditional
          children of THIS Modal (variations OR expanded-preview, never
          both at once). Eliminates the sibling-Modal pattern entirely.

          presentationStyle="fullScreen" because this Modal can be mounted
          from inside another pageSheet (Plan tab path). iOS allows only
          one pageSheet at a time. fullScreen stacks cleanly above any
          parent pageSheet. */}
      {selectedMode && (
        <Modal
          visible={visible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={
            expandedIdx !== null && expandedFull
              ? () => setExpandedIdx(null)
              : onClose
          }
        >
          {expandedIdx !== null && expandedFull && expandedVariation ? (
            // Expanded-preview takes over the same Modal — no sibling
            // Modal needed. PreviewSheet returns a plain <View> with the
            // hero image's close/favorite icons absolutely positioned at
            // top:12, so we MUST wrap with SafeAreaView edges={['top']}
            // here — fullScreen presentation extends content behind the
            // status bar / dynamic island, which would otherwise clip
            // those icons under the system UI.
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
              <RemixVariationPreview
                idx={expandedIdx}
                full={expandedFull}
                variation={expandedVariation}
                baseIngredients={baseForSave?.ingredients}
                saved={savedIdxs.has(expandedIdx)}
                modified={modifiedIdxs.has(expandedIdx)}
                saving={workingIdx === expandedIdx && workingAction === 'save'}
                modifying={
                  workingIdx === expandedIdx && workingAction === 'modify'
                }
                cooking={workingIdx === expandedIdx && workingAction === 'cook'}
                canModify={source.kind === 'saved'}
                onClose={() => setExpandedIdx(null)}
                onSave={() => handleSaveAsNew(expandedIdx, expandedVariation)}
                onModify={() =>
                  handleModifyExisting(expandedIdx, expandedVariation)
                }
                onCook={() => handleCookNow(expandedIdx, expandedVariation)}
              />
            </SafeAreaView>
          ) : (
            /* SafeAreaView with edges=['top'] insets the header below the
               status bar / notch. fullScreen presentation extends content
               behind the system UI, so without this the REMIX kicker sits
               under the time/battery indicators on iOS. */
            <SafeAreaView style={styles.sheet} edges={['top']}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>REMIX</Text>
                  <Text style={styles.title} numberOfLines={2}>
                    {recipeTitle}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.closeBtn}
                >
                  <SymbolIcon name="xmark" size={22} tintColor="#3E332A" />
                </Pressable>
              </View>

              {/* Loading state */}
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.brand} />
                  <Text style={styles.loadingText}>Brewing ideas...</Text>
                </View>
              )}

              {/* Error state */}
              {error && (
                <View style={styles.errorContainer}>
                  <SymbolIcon
                    name="exclamationmark.circle"
                    size={32}
                    tintColor="#DC2626"
                  />
                  <Text style={styles.errorText}>{error}</Text>
                  <View style={{ height: 12 }} />
                  <Button
                    title="Try Another Mode"
                    variant="outline"
                    onPress={handleTryAnother}
                  />
                </View>
              )}

              {/* Results */}
              {variations && !loading && (
                <ScrollView contentContainerStyle={styles.resultsContainer}>
                  <Text style={styles.resultsLabel}>
                    {MODES.find((m) => m.mode === selectedMode)?.label}
                  </Text>
                  {variations.map((v, i) => (
                    <VariationCard
                      key={i}
                      variation={v}
                      index={i}
                      saved={savedIdxs.has(i)}
                      modified={modifiedIdxs.has(i)}
                      isWorking={workingIdx === i}
                      isExpanding={
                        workingIdx === i && workingAction === 'expand'
                      }
                      isSaving={workingIdx === i && workingAction === 'save'}
                      isModifying={
                        workingIdx === i && workingAction === 'modify'
                      }
                      isCooking={workingIdx === i && workingAction === 'cook'}
                      isRemixing={
                        workingIdx === i && workingAction === 'remix'
                      }
                      isApplying={
                        workingIdx === i && workingAction === 'apply'
                      }
                      cardError={errorByIdx[i] ?? null}
                      disabled={workingIdx !== null && workingIdx !== i}
                      canModifyExisting={source.kind === 'saved'}
                      applyToDayMode={!!onApplyToDay}
                      baseIngredients={baseForSave?.ingredients}
                      onExpand={() => handleExpand(i, v)}
                      onCook={() => handleCookNow(i, v)}
                      onSaveAsNew={(uri) => handleSaveAsNew(i, v, uri)}
                      onModifyExisting={() => handleModifyExisting(i, v)}
                      onApplyToDay={() => handleApplyToDay(i, v)}
                      onRemix={() => handleRemixVariation(i, v)}
                      onOpenSaved={handleOpenSaved}
                      onOpenModified={handleOpenModified}
                      onDismissError={() =>
                        setErrorByIdx((prev) => {
                          if (prev[i] === undefined) return prev;
                          const next = { ...prev };
                          delete next[i];
                          return next;
                        })
                      }
                    />
                  ))}
                  <View style={{ height: 16 }} />
                  <Button
                    title="Try Another Mode"
                    variant="outline"
                    onPress={handleTryAnother}
                  />
                </ScrollView>
              )}
            </SafeAreaView>
          )}
        </Modal>
      )}

      {/* Nested remix — generated when the user taps the sparkle on a
          variation card. Source is `inline` because we have a freshly
          expanded ParsedRecipe (no persistent id yet) to anchor against. */}
      {nestedRemixContext && (
        <RemixSheet
          visible={nestedRemixContext !== null}
          recipeTitle={nestedRemixContext.title}
          source={{ kind: 'inline', context: nestedRemixContext }}
          baseForSave={{
            title: nestedRemixContext.title,
            description: nestedRemixContext.description ?? null,
            ingredients: nestedRemixContext.ingredients,
            total_time_minutes: nestedRemixContext.total_time_minutes ?? null,
          }}
          onClose={() => setNestedRemixContext(null)}
        />
      )}
    </>
  );
}

// ---------- Nested preview wrapper — adds AI image generation + PreviewSheet ----------

function RemixVariationPreview({
  idx,
  full,
  variation,
  baseIngredients,
  saved,
  modified,
  saving,
  modifying,
  cooking,
  canModify,
  onClose,
  onSave,
  onModify,
  onCook,
}: {
  idx: number;
  full: ParsedRecipe;
  variation: RemixVariation;
  baseIngredients?: Array<string | BaseIngredient>;
  saved: boolean;
  modified: boolean;
  saving: boolean;
  modifying: boolean;
  cooking: boolean;
  canModify: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onModify: () => Promise<void>;
  onCook: () => Promise<void>;
}) {
  // CRITICAL: cache key must match VariationCard exactly — same title,
  // same description, same normalized ingredients tuple. The expanded
  // ParsedRecipe carries a longer/different title (e.g. variation
  // "Mediterranean Dill And Cucumber" → full "Mediterranean Dill and
  // Cucumber Salmon Tacos") so we anchor on the variation row, not the
  // expansion. Without this, every tap-to-expand kicks off a fresh
  // Gemini round-trip even though the card already resolved.
  const normalizedBase = useMemo(() => {
    if (!baseIngredients || baseIngredients.length === 0) return null;
    return baseIngredients.map((i) =>
      typeof i === 'string'
        ? { name: i, quantity: null, unit: null, notes: null }
        : {
            name: i.name,
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
            notes: i.notes ?? null,
          },
    );
  }, [baseIngredients]);

  const { url: generatedUri } = useGeneratedRecipeImage(variation.title, {
    skip: !!full.image_url,
    description: variation.description,
    ingredients: normalizedBase,
  });
  const heroUri = getRecipeImage(
    `remix-${idx}-${full.title}`,
    full.image_url ?? generatedUri,
    full.title,
  );
  const discovered: DiscoveredRecipe = {
    ...full,
    _saved: saved,
    _modified: modified,
  };
  return (
    <PreviewSheet
      recipe={discovered}
      heroUri={heroUri}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      onModifyExisting={canModify ? onModify : undefined}
      modifying={modifying}
      onCookNow={onCook}
      cooking={cooking}
      hideRemix
      saveLabel="Save as new recipe"
      modifyLabel="Update existing recipe"
      modifiedLabel="Existing recipe updated"
    />
  );
}

// ---------- VariationCard — per-variation card with hero image + primary CTA ----------
//
// Extracted from the inline `variations.map((v, i) => ...)` body so that
// `useGeneratedRecipeImage` can be called at component top-level (hook rules
// forbid calling hooks inside a .map callback). The hero image starts as a
// keyword-matched Unsplash fallback (via `getRecipeImage(seed, null, title)`)
// and swaps to the Gemini-generated URL once the hook resolves — expo-image
// crossfades the transition via `transition={200}`.

interface VariationCardProps {
  variation: RemixVariation;
  index: number;
  saved: boolean;
  modified: boolean;
  isWorking: boolean;
  isExpanding: boolean;
  isSaving: boolean;
  isModifying: boolean;
  isCooking: boolean;
  isRemixing: boolean;
  isApplying: boolean;
  /** When set, render an inline red error row on the card. Tap-to-retry
      via onExpand; dismiss via onDismissError. */
  cardError: string | null;
  disabled: boolean;
  canModifyExisting: boolean;
  /** When true, the bookmark/save badge becomes a calendar.badge.checkmark
      "Apply to this day" badge that fires onApplyToDay. Used by the Plan
      tab's day-preview Remix flow. */
  applyToDayMode: boolean;
  baseIngredients?: Array<string | BaseIngredient>;
  onExpand: () => void;
  onCook: () => void;
  onSaveAsNew: (imageUri: string | null) => void;
  onModifyExisting: () => void;
  onApplyToDay: () => void;
  onRemix: () => void;
  onOpenSaved: () => void;
  onOpenModified: () => void;
  onDismissError: () => void;
}

/**
 * Animated shimmer skeleton — a translucent highlight band sweeps
 * left-to-right across a warm-beige base, repeating every ~1.4s.
 * Communicates "actively loading" rather than "image failed to render"
 * (the static beige box read as the latter to users). The translate
 * range overshoots the card width so the band exits cleanly off-screen
 * before re-entering. Built on Reanimated 3 (already in the stack) so
 * the animation runs on the UI thread without blocking JS.
 */
function ShimmerSkeleton({ width = 340 }: { width?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    // No cleanup needed — Reanimated cancels animations when the
    // shared value's owning component unmounts.
  }, [progress]);

  const bandStyle = useAnimatedStyle(() => {
    // Sweep from -bandWidth (off-left) to width+bandWidth (off-right).
    const bandWidth = width * 0.6;
    const translateX = progress.value * (width + bandWidth) - bandWidth;
    return { transform: [{ translateX }] };
  });

  return (
    <View style={styles.shimmerBase}>
      <Animated.View
        style={[
          styles.shimmerBand,
          { width: width * 0.6 },
          bandStyle,
        ]}
      />
    </View>
  );
}

function VariationCard({
  variation,
  index,
  saved,
  modified,
  isWorking,
  isExpanding,
  isSaving,
  isModifying: _isModifying,
  isCooking,
  isRemixing,
  isApplying,
  cardError,
  disabled,
  canModifyExisting: _canModifyExisting,
  applyToDayMode,
  baseIngredients,
  onExpand,
  onCook,
  onSaveAsNew,
  onModifyExisting: _onModifyExisting,
  onApplyToDay,
  onRemix,
  onOpenSaved,
  onOpenModified,
  onDismissError,
}: VariationCardProps) {
  // Normalize the parent's loose BaseIngredient[] (mix of strings and objects)
  // into the strict ParsedIngredient[] shape that useGeneratedRecipeImage
  // expects. Nulled optional fields are intentional — the hook tolerates them.
  const normalizedBaseIngredients = useMemo(() => {
    if (!baseIngredients || baseIngredients.length === 0) return null;
    return baseIngredients.map((i) =>
      typeof i === 'string'
        ? { name: i, quantity: null, unit: null, notes: null }
        : {
            name: i.name,
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
            notes: i.notes ?? null,
          },
    );
  }, [baseIngredients]);

  // Hero image uses base-recipe ingredients as visual anchors so Gemini
  // renders the actual dish family (e.g. tacos for a taco remix), not just
  // the variation's title keyword.
  //
  // We DO NOT fall back to getRecipeImage's keyword-stock pool while loading
  // or on failure — that pool's hash-based picks (e.g. shrimp variation →
  // cutting board, chorizo variation → bread) mislead more than they help.
  // Show a skeleton until Gemini definitively resolves.
  const { url: generatedUri, status: imageStatus } = useGeneratedRecipeImage(
    variation.title,
    {
      description: variation.description,
      ingredients: normalizedBaseIngredients,
    },
  );

  // Card-level tap routes by state: saved → open the saved recipe, modified
  // → open the modified one, otherwise expand the preview. Mirrors the
  // RecipeCard pattern in Something New (preview-mode tap = expand).
  const handleCardPress = () => {
    if (saved) onOpenSaved();
    else if (modified) onOpenModified();
    else onExpand();
  };

  return (
    <Pressable
      onPress={handleCardPress}
      disabled={disabled || isWorking}
      style={({ pressed }) => [
        styles.variationCard,
        pressed && !(disabled || isWorking) ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <View style={styles.heroWrap}>
        {/* Two-layer load: shimmer skeleton sits underneath as the
            persistent background; Image overlays it once the URL is set,
            with its own blurhash placeholder bridging the network-download
            gap. The shimmer signals "actively loading" so users don't
            mistake the warm-beige box for a permanently failed image
            (prior static skeleton looked dead). Once the Image's bytes
            arrive, it covers the shimmer entirely. */}
        <View style={[styles.variationHero, StyleSheet.absoluteFillObject]}>
          {imageStatus === 'failed' && !generatedUri ? (
            <View style={[styles.variationHeroSkeleton, StyleSheet.absoluteFillObject]}>
              <SymbolIcon name="photo" size={32} tintColor="#C9B89E" />
            </View>
          ) : (
            <ShimmerSkeleton />
          )}
        </View>
        {generatedUri && (
          <Image
            source={{ uri: generatedUri }}
            style={styles.variationHero}
            contentFit="cover"
            transition={300}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            cachePolicy="memory-disk"
          />
        )}
        {/* Hero action cluster — Cook / Remix / Save. Mirrors the
            Something New RecipeCard preview pattern (cluster top-right,
            dark circular badges over hero) so the affordances read
            identically across remix variations and discovery results. */}
        <View style={styles.heroActions}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (disabled || isWorking) return;
              onCook();
            }}
            hitSlop={8}
            disabled={disabled || isWorking}
            style={({ pressed }) => [
              styles.actionBadge,
              pressed && !(disabled || isWorking) ? { opacity: 0.6 } : null,
            ]}
            accessibilityLabel="Cook this variation now"
          >
            {isCooking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SymbolIcon name="flame.fill" size={26} tintColor="#FFE4B5" />
            )}
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (disabled || isWorking) return;
              onRemix();
            }}
            hitSlop={8}
            disabled={disabled || isWorking}
            style={({ pressed }) => [
              styles.actionBadge,
              pressed && !(disabled || isWorking) ? { opacity: 0.6 } : null,
            ]}
            accessibilityLabel="Remix this variation further"
          >
            {isRemixing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SymbolIcon name="sparkles" size={26} tintColor="#FFE4B5" />
            )}
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (disabled || isWorking) return;
              if (applyToDayMode) {
                onApplyToDay();
              } else {
                if (saved) return;
                onSaveAsNew(generatedUri ?? null);
              }
            }}
            hitSlop={8}
            disabled={
              disabled || isWorking || (!applyToDayMode && saved)
            }
            style={({ pressed }) => [
              styles.actionBadge,
              pressed && !(disabled || isWorking) ? { opacity: 0.6 } : null,
            ]}
            accessibilityLabel={
              applyToDayMode
                ? 'Use this for this day'
                : saved
                  ? 'Saved to library'
                  : 'Save to library'
            }
          >
            {isSaving || isApplying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SymbolIcon
                name={
                  applyToDayMode
                    ? 'calendar.badge.checkmark'
                    : saved
                      ? 'checkmark.circle.fill'
                      : 'bookmark'
                }
                size={26}
                tintColor={
                  applyToDayMode
                    ? '#FFFFFF'
                    : saved
                      ? '#10B981'
                      : '#FFFFFF'
                }
              />
            )}
          </Pressable>
        </View>
      </View>
      <View style={styles.variationBody}>
        <View style={styles.variationHeader}>
          <View style={styles.variationNum}>
            <Text style={styles.variationNumText}>{index + 1}</Text>
          </View>
          <Text style={styles.variationTitle}>{variation.title}</Text>
        </View>
        <Text style={styles.variationDescription} numberOfLines={2}>
          {variation.description}
        </Text>

        {saved && (
          <View style={[styles.statusRow, styles.savedRow]}>
            <SymbolIcon name="checkmark.circle.fill" size={16} tintColor="#047857" />
            <Text style={styles.savedText}>Saved to library</Text>
            <SymbolIcon name="chevron.forward" size={14} tintColor="#047857" />
          </View>
        )}

        {modified && (
          <View style={[styles.statusRow, styles.modifiedRow]}>
            <SymbolIcon name="checkmark.circle.fill" size={16} tintColor="#047857" />
            <Text style={styles.savedText}>Existing recipe updated</Text>
            <SymbolIcon name="chevron.forward" size={14} tintColor="#047857" />
          </View>
        )}

        {cardError && !isWorking && (
          /* Inline error row — tap the body to retry, tap the X to
             dismiss. Replaces the prior Alert.alert path which silently
             dropped on iOS when surfacing from inside a stacked Modal,
             leaving the user with a stuck-looking spinner. */
          <View style={[styles.statusRow, styles.errorRow]}>
            <SymbolIcon
              name="exclamationmark.triangle.fill"
              size={16}
              tintColor="#B91C1C"
            />
            <Text style={styles.errorRowText} numberOfLines={2}>
              {cardError} Tap to retry.
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDismissError();
              }}
              hitSlop={8}
              accessibilityLabel="Dismiss error"
            >
              <SymbolIcon name="xmark" size={14} tintColor="#B91C1C" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Loading veil — shown while we fetch the expanded ParsedRecipe in
          response to a card-body tap. The /recipes/remix call can take
          several seconds; without this the user gets no feedback that
          their tap registered until the modal slides in. */}
      {isExpanding && (
        <View style={styles.expandingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAE0',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C05A00',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  customSubmitBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modeGrid: {
    // 2-col flex grid for mode tiles — sibling layout to FocusPickerSheet
    // so both pickers read as a coherent family. Each cell wraps an
    // OptionCard at width: 48%; rowGap 12 keeps vertical rhythm.
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  modeCell: {
    width: '48%',
  },
  surpriseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    // Subtle brand-tinted hairline so the hero card reads as a level above
    // the plain mode tiles below it without resorting to a saturated fill.
    borderWidth: 1,
    borderColor: `${colors.brand}33`,
  },
  surpriseChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // Same 10% brand wash the section tiles use for their icon chips, so
    // the hero feels like the strongest member of the same family rather
    // than a one-off block of orange.
    backgroundColor: `${colors.brand}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surpriseLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.3,
  },
  surpriseSub: {
    fontSize: 13,
    color: '#7A6651',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#7A6651',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7A6651',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  variationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  heroWrap: {
    // Explicit relative positioning anchor for the heroActions cluster.
    // RN treats Views as position:'relative' by default, but spelling it
    // out makes the absolute child unambiguous and survives any future
    // refactors that wrap this in a flex container.
    position: 'relative',
    // Belt-and-suspenders: clip independently of the variationCard's
    // overflow:'hidden'. iOS Pressable + overflow + shadow can race in
    // some renderers and leave the inner Image rendering past the
    // rounded corners; clipping the wrapper makes it deterministic.
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  variationHero: {
    width: '100%',
    height: 170,
    backgroundColor: '#F1EAE0',
    // Mirror the wrapper's top radius directly on the image so even if
    // a child stylesheet later overrides overflow on heroWrap, the image
    // still presents with rounded top corners — matches the look of
    // RecipeCard hero photos in Something New / Recipe Box.
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  variationHeroSkeleton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ShimmerSkeleton — warm beige base + translucent highlight band that
  // sweeps left-to-right under the hero. overflow:hidden contains the
  // band's translateX so it doesn't leak outside the rounded hero frame.
  shimmerBase: {
    flex: 1,
    backgroundColor: '#F1EAE0',
    overflow: 'hidden',
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 251, 245, 0.6)',
  },
  // Single-capsule overlay — matches HeroDayCard.heroIconCluster +
  // RecipeCard.actionCluster so all hero overlay actions across
  // Plan / Something New / Recipe Box / Remix render as one family.
  heroActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  // Bare icon button — parent cluster owns the chrome now.
  actionBadge: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  variationBody: {
    padding: 16,
  },
  variationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  variationNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  variationNumText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C05A00',
  },
  variationTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.3,
  },
  variationDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3E332A',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  savedRow: {
    backgroundColor: '#D1FAE5',
  },
  modifiedRow: {
    backgroundColor: '#DBEAFE',
  },
  errorRow: {
    // Soft red wash matching the warning chip family used elsewhere in
    // the app. Body text in B91C1C reads at WCAG AA against this
    // background. Pairs with the alert triangle leading icon.
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    gap: 8,
    justifyContent: 'flex-start',
  },
  errorRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  savedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    flex: 0,
  },
});
