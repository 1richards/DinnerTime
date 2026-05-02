import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { Image } from 'expo-image';
import { Button } from '../../components/ui/Button';
import { RemixSheet, type RemixSource } from '../../components/recipes/RemixSheet';
import { DatePickerSheet } from '../../components/plan/DatePickerSheet';
import { ServingSizeStepper } from '../../components/recipes/ServingSizeStepper';
import { ScaledIngredientList } from '../../components/recipes/ScaledIngredientList';
import { useRecipeStore } from '../../stores/recipeStore';
import { usePantryStore } from '../../stores/pantryStore';
import { useShoppingStore } from '../../stores/shoppingStore';
import { supabase } from '../../lib/supabase';
import { getRecipeImage } from '../../constants/foodImages';
import type { ParsedRecipe } from '../../types/recipe';
import { colors } from '../../design/tokens';
import { shareRecipeAsPdf } from '../../lib/recipePdf';
import { useToast } from '../../components/ui/Toast';

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

export type DiscoveredRecipe = ParsedRecipe & {
  _saved?: boolean;
  _modified?: boolean;
};

/** Normalize a title for cross-checking against the user's library. */
const normalizeTitle = (t: string): string => t.trim().toLowerCase();

export default function DiscoverScreen() {
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  // Reactive set of normalized titles already in the library. Keeps the
  // "Saved" badge correct across re-fetches and after deletes — the
  // ephemeral `_saved` flag we used to seed at fetch time would lie on
  // the second fetch if Claude re-surfaced the same suggestion.
  const savedTitles = useRecipeStore((s) =>
    new Set(s.recipes.map((r) => normalizeTitle(r.title))),
  );

  const [recipes, setRecipes] = useState<DiscoveredRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const fetchDiscover = useCallback(
    async (withPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getAuthToken();
        const body: { prompt?: string } = {};
        if (withPrompt && withPrompt.trim()) body.prompt = withPrompt.trim();
        const response = await fetch(
          `${getApiBaseUrl()}/api/v1/recipes/discover`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          setError(errBody.error ?? 'Failed to load suggestions');
          setRecipes([]);
          setIsLoading(false);
          return;
        }

        const json = await response.json();
        const list: ParsedRecipe[] = json.data ?? [];
        // Don't seed _saved here — it's derived reactively below from
        // useRecipeStore so re-fetches and concurrent saves stay in sync.
        setRecipes(list as DiscoveredRecipe[]);
        setIsLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load suggestions'
        );
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDiscover();
  }, [fetchDiscover]);

  // Reactive enrichment: a card is "saved" iff its title matches a recipe
  // already in the user's library (or it was just saved this session).
  const enrichedRecipes: DiscoveredRecipe[] = recipes.map((r) => ({
    ...r,
    _saved: r._saved === true || savedTitles.has(normalizeTitle(r.title)),
  }));

  const handleSave = async (idx: number, recipe: DiscoveredRecipe) => {
    setSavingIdx(idx);
    try {
      const { _saved, ...parsed } = recipe;
      await saveRecipe({ ...parsed, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save Failed', state.error);
      } else {
        setRecipes((list) =>
          list.map((r, i) => (i === idx ? { ...r, _saved: true } : r))
        );
      }
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 12 }}
      >
        <Text className="text-xs font-bold text-brand-pressed uppercase tracking-wider mb-1">
          New ideas
        </Text>
        <Text className="text-2xl font-black text-warmGray-900 mb-1 -tracking-wider">
          Discover
        </Text>
        <Text className="text-xs text-warmGray-500 mb-5">
          Full recipes your household might love. Ingredient-agnostic —
          we don't limit to what's in your pantry.
        </Text>

        <View className="flex-row gap-2 mb-4">
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. quick weeknight pastas"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-warmGray-50 border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900"
            returnKeyType="search"
            onSubmitEditing={() => fetchDiscover(prompt)}
          />
          <Pressable
            onPress={() => fetchDiscover(prompt)}
            disabled={isLoading}
            className="px-4 rounded-button bg-brand items-center justify-center"
          >
            <SymbolIcon name="arrow.clockwise" size={20} tintColor="#FFFFFF" />
          </Pressable>
        </View>

        {isLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color={colors.brand} />
            <Text className="text-sm text-warmGray-500 mt-3">
              Brewing ideas...
            </Text>
          </View>
        )}

        {!isLoading && error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-sm text-red-700 mb-3">{error}</Text>
            <Button
              title="Retry"
              variant="outline"
              onPress={() => fetchDiscover(prompt)}
            />
          </View>
        )}

        {!isLoading && !error && recipes.length === 0 && (
          <Text className="text-sm text-warmGray-500 text-center mt-8">
            No suggestions. Try a different prompt.
          </Text>
        )}

        {!isLoading &&
          enrichedRecipes.map((recipe, idx) => {
            const totalTime =
              recipe.total_time_minutes ??
              (recipe.prep_time_minutes ?? 0) +
                (recipe.cook_time_minutes ?? 0);
            const heroUri = getRecipeImage(
              `discover-${recipe.title}-${idx}`,
              recipe.image_url,
              recipe.title,
            );
            return (
              <Pressable
                key={`${recipe.title}-${idx}`}
                onPress={() => setPreviewIdx(idx)}
                style={styles.card}
              >
                <Image
                  source={heroUri ? { uri: heroUri } : null}
                  style={[
                    styles.cardImage,
                    !heroUri && { backgroundColor: '#F1EAE0' },
                  ]}
                  contentFit="cover"
                  transition={300}
                  placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
                  cachePolicy="memory-disk"
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{recipe.title}</Text>
                  {recipe.description && (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  )}
                  <View style={styles.cardMetaRow}>
                    {totalTime > 0 && (
                      <View style={styles.cardMetaItem}>
                        <SymbolIcon name="clock" size={14} tintColor="#6B7280" />
                        <Text style={styles.cardMetaText}>{totalTime} min</Text>
                      </View>
                    )}
                    {recipe.servings != null && (
                      <View style={styles.cardMetaItem}>
                        <SymbolIcon name="person.2" size={14} tintColor="#6B7280" />
                        <Text style={styles.cardMetaText}>
                          {recipe.servings} servings
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardMetaItem}>
                      <SymbolIcon name="chevron.forward" size={16} tintColor={colors.brand} />
                      <Text style={styles.cardCtaText}>View recipe</Text>
                    </View>
                  </View>
                  {recipe._saved && (
                    <View style={styles.savedBadge}>
                      <SymbolIcon name="checkmark.circle.fill" size={14} tintColor="#10B981" />
                      <Text style={styles.savedBadgeText}>Saved to library</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
      </ScrollView>

      {/* Preview modal — full recipe content with Save CTA */}
      <Modal
        visible={previewIdx !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewIdx(null)}
      >
        {previewIdx !== null && enrichedRecipes[previewIdx] && (
          <PreviewSheet
            recipe={enrichedRecipes[previewIdx]}
            heroUri={getRecipeImage(
              `discover-${enrichedRecipes[previewIdx].title}-${previewIdx}`,
              enrichedRecipes[previewIdx].image_url,
              enrichedRecipes[previewIdx].title,
            )}
            onClose={() => setPreviewIdx(null)}
            onSave={async () => {
              await handleSave(previewIdx, enrichedRecipes[previewIdx]);
            }}
            saving={savingIdx === previewIdx}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Preview sheet (modal) ----------

export function PreviewSheet({
  recipe,
  heroUri,
  onClose,
  onSave,
  saving,
  onModifyExisting,
  modifying = false,
  onCookNow,
  cooking = false,
  onCookLater,
  cookingLater = false,
  onRemove,
  removing = false,
  removeLabel = 'Remove',
  bodyExtra,
  hideRemix = false,
  hideSave = false,
  saveLabel = 'Save Recipe',
  modifyLabel = 'Update existing recipe',
  modifiedLabel = 'Recipe updated',
  stepsLoading = false,
}: {
  recipe: DiscoveredRecipe;
  /** Null renders a beige skeleton — no keyword-stock fallback exists anymore. */
  heroUri: string | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  /** If provided, render a second primary button that replaces an existing
      recipe's contents with this variation (used from RemixSheet when the
      source is a saved recipe). */
  onModifyExisting?: () => Promise<void>;
  modifying?: boolean;
  /** If provided, render a Cook Now CTA that persists the recipe then
      navigates into the cooking flow. */
  onCookNow?: () => Promise<void>;
  cooking?: boolean;
  /** If provided, render a Cook Later CTA next to Cook Now. The callback
      receives an ISO date (YYYY-MM-DD) the user picked from a sheet
      mounted inside this component. */
  onCookLater?: (isoDate: string) => Promise<void>;
  cookingLater?: boolean;
  /** When provided, render a destructive Remove button next to Remix.
      Used by Recipe Box detail to delete the recipe from the library. */
  onRemove?: () => Promise<void>;
  removing?: boolean;
  /** Label override for the remove button — Recipe Box uses "Remove",
      Plan uses "Clear", etc. */
  removeLabel?: string;
  /** Optional content rendered below the description (above ingredients).
      Used by Recipe Box detail to inject the LabelsEditor. */
  bodyExtra?: React.ReactNode;
  hideRemix?: boolean;
  /** Suppress the Save Recipe button — used when the recipe is already
      saved (Recipe Box detail) and Save would be a no-op. */
  hideSave?: boolean;
  saveLabel?: string;
  modifyLabel?: string;
  modifiedLabel?: string;
  /** When true, the Steps section renders a "Generating steps…"
      placeholder + spinner instead of the empty-state copy. Used by
      the Plan tab while it fetches the AI-expanded recipe in the
      background, so users don't see "No steps listed." flash. */
  stepsLoading?: boolean;
}) {
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const [remixOpen, setRemixOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { show: showToast, ToastComponent } = useToast();

  const handleSharePdf = async () => {
    // PreviewSheet's heroUri is the same image the sheet renders —
    // pass it so the PDF picks up Gemini-fallback images for legacy
    // recipes whose recipe.image_url is null.
    const result = await shareRecipeAsPdf(recipe, { heroUri });
    if (!result.ok) {
      const msg =
        result.reason === 'print_unavailable' ||
        result.reason === 'sharing_unavailable' ||
        result.reason === 'native_module_missing'
          ? 'Sharing needs a dev-client rebuild to enable PDF export.'
          : result.reason === 'sharing_disabled'
            ? 'Sharing isn’t available on this device.'
            : 'Couldn’t build the PDF — try again.';
      showToast(msg, 'error');
    }
  };
  // Servings stepper — initialize from the recipe's own servings (falling
  // back to 1 when absent). Multiplier is applied purely client-side via
  // ScaledIngredientList; the underlying recipe.ingredients data is never
  // mutated, matching the Recipe Box detail behavior.
  const baseServings = recipe.servings ?? 1;
  const [servings, setServings] = useState<number>(baseServings);
  const multiplier = baseServings > 0 ? servings / baseServings : 1;

  // Phase 01-01: missing-ingredient indicator wiring. Reactive subscriptions
  // so the cart-add affordance reflects pantry / shopping list edits made
  // elsewhere while the sheet is open.
  const pantryItems = usePantryStore((s) => s.items);
  const addToShoppingList = useShoppingStore((s) => s.addItem);
  // Per-sheet "added in this session" set so the icon flips to cart.fill
  // immediately on tap. Lifecycle is intentionally bound to this sheet —
  // re-opening a recipe re-evaluates from pantryItems alone (no stale flips).
  const [addedNames, setAddedNames] = useState<Set<string>>(() => new Set());
  // Bug 3 contract per CONTEXT.md — even though loadItems() filters to
  // status === 'available' already, defensive re-filter at the consumer.
  const pantryNames = pantryItems
    .filter((p) => p.status === 'available')
    .map((p) => p.name);

  // Phase 17 P17-05: inline-source RemixSheet for unsaved discovery results.
  // `kind: 'inline'` avoids requiring recipe.id (which Discover cards don't have).
  const remixSource: RemixSource = {
    kind: 'inline',
    context: {
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      total_time_minutes: recipe.total_time_minutes,
    },
  };

  return (
    <View style={styles.sheet}>
      <ToastComponent />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: 'relative' }}>
          {heroUri ? (
            <Image
              source={{ uri: heroUri }}
              style={styles.sheetHero}
              contentFit="cover"
              transition={300}
              placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            />
          ) : (
            <View style={[styles.sheetHero, { backgroundColor: '#F1EAE0' }]} />
          )}
          <View style={styles.sheetHeroOverlay} />
          <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size={22} tintColor="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={handleSharePdf}
            style={styles.sheetShare}
            hitSlop={12}
            accessibilityLabel="Share recipe as PDF"
          >
            <SymbolIcon name="square.and.arrow.up" size={22} tintColor="#FFFFFF" />
          </Pressable>
          <View style={styles.sheetHeroText}>
            <Text style={styles.sheetTitle} numberOfLines={3}>
              {recipe.title}
            </Text>
            {totalTime > 0 && (
              <View style={styles.sheetMeta}>
                <SymbolIcon name="clock" size={14} tintColor="rgba(255,255,255,0.8)" />
                <Text style={styles.sheetMetaText}>{totalTime} min</Text>
                {recipe.servings != null && (
                  <>
                    <Text style={styles.sheetMetaText}>{'  ·  '}</Text>
                    <SymbolIcon name="person.2" size={14} tintColor="rgba(255,255,255,0.8)" />
                    <Text style={styles.sheetMetaText}>
                      {recipe.servings} servings
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {recipe.description && (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetDescription}>{recipe.description}</Text>
          </View>
        )}

        {(recipe.calories_per_serving != null ||
          recipe.protein_grams_per_serving != null ||
          recipe.fat_grams_per_serving != null) && (
          <View style={styles.nutritionRow}>
            {recipe.calories_per_serving != null && (
              <View style={styles.nutritionBadge}>
                <Text style={styles.nutritionValue}>
                  {Math.round(recipe.calories_per_serving)}
                </Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
            )}
            {recipe.protein_grams_per_serving != null && (
              <View style={styles.nutritionBadge}>
                <Text style={styles.nutritionValue}>
                  {Math.round(recipe.protein_grams_per_serving)}g
                </Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
            )}
            {recipe.fat_grams_per_serving != null && (
              <View style={styles.nutritionBadge}>
                <Text style={styles.nutritionValue}>
                  {Math.round(recipe.fat_grams_per_serving)}g
                </Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            )}
            <Text style={styles.nutritionPerServing}>per serving</Text>
          </View>
        )}

        {bodyExtra}

        <View style={styles.sheetCard}>
          <View style={styles.sheetIngredientHeader}>
            <Text style={styles.sheetSectionHeading}>Ingredients</Text>
            <ServingSizeStepper servings={servings} onChange={setServings} />
          </View>
          {recipe.ingredients.length === 0 ? (
            <Text style={styles.sheetEmpty}>No ingredients listed.</Text>
          ) : (
            <ScaledIngredientList
              ingredients={recipe.ingredients}
              multiplier={multiplier}
              pantryNames={pantryNames}
              addedNames={addedNames}
              onAddIngredient={async (ing) => {
                const key = ing.name.trim().toLowerCase();
                // Optimistic flip — icon → cart.fill (success tone) instantly.
                setAddedNames((prev) => {
                  const next = new Set(prev);
                  next.add(key);
                  return next;
                });
                try {
                  await addToShoppingList({
                    name: ing.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                  });
                } catch (err) {
                  // Rollback so the icon returns to cart.badge.plus and the
                  // user can retry. Mirrors PantryItemCard.handleGetMore.
                  setAddedNames((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                  Alert.alert(
                    'Could not add to shopping list',
                    err instanceof Error ? err.message : 'Please try again.',
                  );
                }
              }}
            />
          )}
        </View>

        <View style={styles.sheetCard}>
          <Text style={styles.sheetSectionHeading}>Steps</Text>
          {recipe.steps.length === 0 ? (
            stepsLoading ? (
              <View style={styles.sheetStepsLoading}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.sheetEmpty}>Generating steps…</Text>
              </View>
            ) : (
              <Text style={styles.sheetEmpty}>No steps listed.</Text>
            )
          ) : (
            recipe.steps.map((step, i) => (
              <View key={i} style={styles.sheetStep}>
                <Text style={styles.sheetStepNum}>{i + 1}</Text>
                <Text style={styles.sheetStepText}>{step}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Fixed bottom save bar (Save + Remix — Phase 17 D-03). Pitfall 9
          invariant: onSave must remain unchanged so source_type: 'ai' still
          stamps through the unchanged parent handleSave closure.
          When `onModifyExisting` is provided (Remix preview for a saved
          recipe), a second primary button renders for updating the source
          recipe in place. Remix is hidden in that flow to avoid nesting. */}
      <View style={styles.sheetBottomBar}>
        {recipe._saved ? (
          <View style={styles.sheetSavedRow}>
            <SymbolIcon name="checkmark.circle.fill" size={20} tintColor="#10B981" />
            <Text style={styles.sheetSavedText}>Saved to library</Text>
            <View style={{ flex: 1 }} />
            <Button title="Done" variant="outline" onPress={onClose} />
          </View>
        ) : recipe._modified ? (
          <View style={styles.sheetSavedRow}>
            <SymbolIcon name="checkmark.circle.fill" size={20} tintColor="#10B981" />
            <Text style={styles.sheetSavedText}>{modifiedLabel}</Text>
            <View style={{ flex: 1 }} />
            <Button title="Done" variant="outline" onPress={onClose} />
          </View>
        ) : onModifyExisting ? (
          <View style={{ gap: 8 }}>
            <Button
              title={saveLabel}
              onPress={onSave}
              loading={saving}
              disabled={modifying || cooking || cookingLater}
            />
            <Button
              title={modifyLabel}
              variant="outline"
              onPress={onModifyExisting}
              loading={modifying}
              disabled={saving || cooking || cookingLater}
            />
            {(onCookNow || onCookLater) && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {onCookNow && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cook Now"
                      onPress={onCookNow}
                      loading={cooking}
                      disabled={saving || modifying || cookingLater}
                    />
                  </View>
                )}
                {onCookLater && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cook Later"
                      variant="outline"
                      onPress={() => setDatePickerOpen(true)}
                      loading={cookingLater}
                      disabled={saving || modifying || cooking}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(!hideSave || !hideRemix || onRemove) && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Remix on the LEFT — secondary action that lives next
                    to the recipe content. */}
                {!hideRemix && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Remix"
                      variant="outline"
                      onPress={() => setRemixOpen(true)}
                      disabled={saving || cooking || cookingLater || removing}
                    />
                  </View>
                )}
                {/* Save on the RIGHT — primary save affordance for
                    unsaved previews. Hidden once the recipe is in the
                    library (use Remove there instead). */}
                {!hideSave && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title={saveLabel}
                      variant="outline"
                      onPress={onSave}
                      loading={saving}
                      disabled={cooking || cookingLater || removing}
                    />
                  </View>
                )}
                {/* Remove on the RIGHT for already-saved recipes — pairs
                    with Remix on the left so the row reads as
                    "rework | delete". Label is overridable so Plan
                    uses "Clear" while Recipe Box uses "Remove". */}
                {onRemove && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title={removeLabel}
                      variant="outline"
                      onPress={onRemove}
                      loading={removing}
                      disabled={saving || cooking || cookingLater}
                    />
                  </View>
                )}
              </View>
            )}
            {(onCookNow || onCookLater) && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {onCookNow && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cook Now"
                      onPress={onCookNow}
                      loading={cooking}
                      disabled={saving || cookingLater}
                    />
                  </View>
                )}
                {onCookLater && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cook Later"
                      variant="outline"
                      onPress={() => setDatePickerOpen(true)}
                      loading={cookingLater}
                      disabled={saving || cooking}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Phase 17 P17-05: RemixSheet with inline-source kind. Opens when the
          user taps Remix on an unsaved discovery preview. Suppressed via
          `hideRemix` when this sheet is already mounted from within a
          RemixSheet (avoids recursive remix modals). */}
      {!hideRemix && (
        <RemixSheet
          visible={remixOpen}
          recipeTitle={recipe.title}
          source={remixSource}
          baseForSave={{
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            total_time_minutes: recipe.total_time_minutes,
          }}
          onClose={() => setRemixOpen(false)}
        />
      )}

      {/* Cook Later → day picker. Mounts the shared DatePickerSheet so
          the user picks any day in the next 60. Confirm fires onCookLater
          with the ISO date string; parent owns the actual /entries/assign
          call so this component stays presentation-only. */}
      {onCookLater && (
        <DatePickerSheet
          visible={datePickerOpen}
          onConfirm={async (iso) => {
            setDatePickerOpen(false);
            await onCookLater(iso);
          }}
          onDismiss={() => setDatePickerOpen(false)}
          title="Cook this on…"
          confirmLabel="Add to plan"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#2A221A',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#7A6651',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#7A6651',
  },
  cardCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  savedBadgeText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },

  // Preview sheet
  sheet: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  sheetHero: {
    width: '100%',
    height: 260,
    backgroundColor: '#2A221A',
  },
  sheetHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,10,5,0.32)',
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetShare: {
    position: 'absolute',
    top: 14,
    right: 58,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeroText: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  sheetTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  sheetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  sheetMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  sheetSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexWrap: 'wrap',
  },
  nutritionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: 'rgba(192,90,0,0.18)',
    alignItems: 'center',
    minWidth: 64,
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  nutritionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A6651',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  nutritionPerServing: {
    fontSize: 11,
    color: '#7A6651',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  sheetDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5C4B39',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  sheetSectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A140F',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sheetIngredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetEmpty: {
    fontSize: 13,
    color: '#A89178',
    fontStyle: 'italic',
  },
  // Spinner + label combo shown in the Steps section while the Plan
  // tab is fetching the AI-expanded recipe behind the scenes.
  sheetStepsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetIngredient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sheetBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 8,
    marginRight: 10,
  },
  sheetIngredientText: {
    flex: 1,
    fontSize: 14,
    color: '#3E332A',
    lineHeight: 20,
  },
  sheetStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sheetStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF4E6',
    color: '#C05A00',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 12,
  },
  sheetStepText: {
    flex: 1,
    fontSize: 14,
    color: '#3E332A',
    lineHeight: 21,
  },
  sheetBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#FFFBF5',
    borderTopWidth: 1,
    borderTopColor: '#F1EAE0',
  },
  sheetSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetSavedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
});
