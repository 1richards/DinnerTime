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
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
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
async function fetchRemixedRecipe(
  base: RemixSheetProps['baseForSave'] extends infer T ? T : never,
  variation: RemixVariation,
): Promise<ParsedRecipe> {
  const token = await getAuthToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/recipes/remix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ base, variation }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to generate recipe');
  }
  const body = await res.json();
  return body.data as ParsedRecipe;
}

export function RemixSheet({
  visible,
  recipeTitle,
  source,
  baseForSave,
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
    'expand' | 'save' | 'modify' | 'cook' | 'remix' | null
  >(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());
  const [modifiedIdxs, setModifiedIdxs] = useState<Set<number>>(new Set());
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
    try {
      const full = await fetchRemixedRecipe(resolveBase(), variation);
      setFullByIdx((prev) => ({ ...prev, [idx]: full }));
      return full;
    } catch (err) {
      Alert.alert(
        'Remix failed',
        err instanceof Error ? err.message : String(err),
      );
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

  const handleSaveAsNew = async (idx: number, variation: RemixVariation) => {
    setWorkingIdx(idx);
    setWorkingAction('save');
    try {
      const full = await ensureFull(idx, variation);
      if (!full) return;
      await saveRecipe({ ...full, source_type: 'ai' });
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>REMIX</Text>
            <Text style={styles.title} numberOfLines={2}>
              {recipeTitle}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <SymbolIcon name="xmark" size={22} tintColor="#3E332A" />
          </Pressable>
        </View>

        {/* Mode picker */}
        {!selectedMode && (
          <ScrollView contentContainerStyle={styles.modesContainer}>
            <Text style={styles.helperText}>
              How do you want to shake it up?
            </Text>

            {/* Free-form steering. Anything typed here is forwarded to the
                variation generator alongside the selected mode — e.g. user
                taps "Swap protein" with "use only what's in my pantry"
                typed and the prompt steering picks up both signals. */}
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

            {/* Surprise me — full-width hero card. Visual language matches
                the sectioned mode tiles below (white surface, tinted icon
                chip, dark text) so the remix grid reads as a coherent
                family rather than one orange slab on top of a cream
                page. The brand accent still owns the chip + chevron so
                this card remains the visual anchor of the page. */}
            <Pressable
              onPress={() => handleMode('surprise')}
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
                <Text style={styles.surpriseLabel}>Surprise me</Text>
                <Text style={styles.surpriseSub}>A bold creative twist</Text>
              </View>
              <SymbolIcon
                name="chevron.forward"
                size={18}
                tintColor={colors.brand}
              />
            </Pressable>

            {/* Vertical list of remix modes — Apple Settings / Linear
                command-palette pattern. Single left edge for the icon
                chip aligns every label and sub text on the same axis,
                so the eye scans straight down. Trades horizontal density
                (vs the earlier 3-col grid) for legibility and tap target
                size; the dropped pixels are well-spent in a sheet that
                only ever shows nine choices. */}
            <View style={styles.modeList}>
              {GRID_MODES.map((m, i) => (
                <Pressable
                  key={m.mode}
                  onPress={() => handleMode(m.mode)}
                  style={({ pressed }) => [
                    styles.modeRowList,
                    i === 0 && styles.modeRowListFirst,
                    pressed && { backgroundColor: '#F7F0E5' },
                  ]}
                >
                  <View
                    style={[styles.modeRowChip, { backgroundColor: `${m.tint}1A` }]}
                  >
                    <SymbolIcon
                      name={m.symbol as never}
                      size={22}
                      tintColor={m.tint}
                      weight="semibold"
                    />
                  </View>
                  <View style={styles.modeRowContent}>
                    <Text style={styles.modeRowLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text style={styles.modeRowSub} numberOfLines={1}>
                      {m.sub}
                    </Text>
                  </View>
                  <SymbolIcon
                    name="chevron.forward"
                    size={14}
                    tintColor="#A89478"
                  />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Loading state */}
        {selectedMode && loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Brewing ideas...</Text>
          </View>
        )}

        {/* Error state */}
        {selectedMode && error && (
          <View style={styles.errorContainer}>
            <SymbolIcon name="exclamationmark.circle" size={32} tintColor="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <View style={{ height: 12 }} />
            <Button title="Try Another Mode" variant="outline" onPress={handleTryAnother} />
          </View>
        )}

        {/* Results */}
        {selectedMode && variations && !loading && (
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
                isExpanding={workingIdx === i && workingAction === 'expand'}
                isSaving={workingIdx === i && workingAction === 'save'}
                isModifying={workingIdx === i && workingAction === 'modify'}
                isCooking={workingIdx === i && workingAction === 'cook'}
                isRemixing={workingIdx === i && workingAction === 'remix'}
                disabled={workingIdx !== null && workingIdx !== i}
                canModifyExisting={source.kind === 'saved'}
                baseIngredients={baseForSave?.ingredients}
                onExpand={() => handleExpand(i, v)}
                onCook={() => handleCookNow(i, v)}
                onSaveAsNew={() => handleSaveAsNew(i, v)}
                onModifyExisting={() => handleModifyExisting(i, v)}
                onRemix={() => handleRemixVariation(i, v)}
                onOpenSaved={handleOpenSaved}
                onOpenModified={handleOpenModified}
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
      </View>

      {/* Nested expanded preview — full recipe for the tapped variation.
          Rendered via the shared PreviewSheet with hideRemix + modify support. */}
      <Modal
        visible={expandedIdx !== null && expandedFull != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExpandedIdx(null)}
      >
        {expandedIdx !== null && expandedFull && expandedVariation && (
          <RemixVariationPreview
            idx={expandedIdx}
            full={expandedFull}
            variation={expandedVariation}
            baseIngredients={baseForSave?.ingredients}
            saved={savedIdxs.has(expandedIdx)}
            modified={modifiedIdxs.has(expandedIdx)}
            saving={workingIdx === expandedIdx && workingAction === 'save'}
            modifying={workingIdx === expandedIdx && workingAction === 'modify'}
            cooking={workingIdx === expandedIdx && workingAction === 'cook'}
            canModify={source.kind === 'saved'}
            onClose={() => setExpandedIdx(null)}
            onSave={() => handleSaveAsNew(expandedIdx, expandedVariation)}
            onModify={() => handleModifyExisting(expandedIdx, expandedVariation)}
            onCook={() => handleCookNow(expandedIdx, expandedVariation)}
          />
        )}
      </Modal>

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
    </Modal>
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
  disabled: boolean;
  canModifyExisting: boolean;
  baseIngredients?: Array<string | BaseIngredient>;
  onExpand: () => void;
  onCook: () => void;
  onSaveAsNew: () => void;
  onModifyExisting: () => void;
  onRemix: () => void;
  onOpenSaved: () => void;
  onOpenModified: () => void;
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
  disabled,
  canModifyExisting: _canModifyExisting,
  baseIngredients,
  onExpand,
  onCook,
  onSaveAsNew,
  onModifyExisting: _onModifyExisting,
  onRemix,
  onOpenSaved,
  onOpenModified,
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
        {generatedUri ? (
          <Image
            source={{ uri: generatedUri }}
            style={styles.variationHero}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          // Skeleton while Gemini resolves OR if it failed. Subtle pulse via
          // the warm beige #F1EAE0 placeholder — same tone the rest of the
          // app uses for image placeholders. Better than misleading stock.
          <View style={[styles.variationHero, styles.variationHeroSkeleton]}>
            {imageStatus === 'failed' && (
              <SymbolIcon name="photo" size={32} tintColor="#C9B89E" />
            )}
          </View>
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
              <SymbolIcon name="flame.fill" size={24} tintColor="#FFE4B5" />
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
              <SymbolIcon name="sparkles" size={24} tintColor="#FFE4B5" />
            )}
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (saved || disabled || isWorking) return;
              onSaveAsNew();
            }}
            hitSlop={8}
            disabled={saved || disabled || isWorking}
            style={({ pressed }) => [
              styles.actionBadge,
              pressed && !(saved || disabled || isWorking) ? { opacity: 0.6 } : null,
            ]}
            accessibilityLabel={saved ? 'Saved to library' : 'Save to library'}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SymbolIcon
                name={saved ? 'checkmark.circle.fill' : 'bookmark'}
                size={26}
                tintColor={saved ? '#10B981' : '#FFFFFF'}
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
  modesContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  helperText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
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
  modeList: {
    // Card surface that wraps the eight mode rows. Hairline borders
    // between rows give the list a clean alignment edge without a
    // 1pt gap collecting dust between cards.
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  modeRowList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBE2D2',
  },
  modeRowListFirst: {
    // First row has no top divider — the card border serves as the cap.
    borderTopWidth: 0,
  },
  modeRowChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeRowContent: {
    flex: 1,
  },
  modeRowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  modeRowSub: {
    fontSize: 13,
    color: '#7A6651',
    marginTop: 1,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  modeChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRowText: {
    flex: 1,
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
  modeLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modeSub: {
    fontSize: 13,
    color: colors.textSecondary,
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
  heroActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 10,
  },
  actionBadge: {
    // 52pt mirrors RecipeCard's hero overlay buttons exactly so the
    // affordance is visually identical across Something New, Recipe Box,
    // and Remix surfaces.
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  savedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    flex: 0,
  },
});
