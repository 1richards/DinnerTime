import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
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
import type { ParsedRecipe } from '../../types/recipe';
import { colors } from '../../design/tokens';

/**
 * RemixSheet accepts one of two sources:
 * - `{ kind: 'saved', recipeId }`: looks up the recipe via GET variations
 * - `{ kind: 'inline', context }`: uses POST variations for unsaved data
 *
 * The save-as-recipe flow hits POST /recipes/remix with a base context
 * (derived from whichever source) + the selected variation, receives a
 * full ParsedRecipe, then calls saveRecipe to persist.
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
  emoji: string;
}

const MODES: ModeOption[] = [
  { mode: 'surprise', label: 'Surprise me', sub: 'A bold creative twist', emoji: '🎲' },
  { mode: 'protein', label: 'Swap protein', sub: 'Keep the dish, change the star', emoji: '🥩' },
  { mode: 'veggies', label: 'Swap veggies', sub: 'Different flavor profile', emoji: '🥗' },
  { mode: 'quicker', label: 'Make it quicker', sub: 'Shortcut the cook time', emoji: '⏱️' },
];

const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not authenticated');
  return data.session.access_token;
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

  const [selectedMode, setSelectedMode] = useState<RemixMode | null>(null);
  const [variations, setVariations] = useState<RemixVariation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) {
      // Reset when the modal closes so next open starts fresh.
      setSelectedMode(null);
      setVariations(null);
      setLoading(false);
      setError(null);
      setSavingIdx(null);
      setSavedIdxs(new Set());
    }
  }, [visible]);

  const handleMode = async (mode: RemixMode) => {
    setSelectedMode(mode);
    setLoading(true);
    setError(null);
    setVariations(null);
    setSavedIdxs(new Set());

    const result =
      source.kind === 'saved'
        ? await fetchVariations(source.recipeId, mode)
        : await fetchVariationsForContext(source.context, mode);

    setLoading(false);
    if (result === null) {
      setError('Could not fetch variations. Try again?');
      return;
    }
    setVariations(result);
  };

  const handleTryAnother = () => {
    setSelectedMode(null);
    setVariations(null);
    setError(null);
    setSavingIdx(null);
    setSavedIdxs(new Set());
  };

  const handleSaveAsRecipe = async (idx: number, variation: RemixVariation) => {
    setSavingIdx(idx);
    try {
      const token = await getAuthToken();

      // Build the base context for the /recipes/remix call. If an explicit
      // baseForSave was provided (saved recipe with full ingredients + steps),
      // use that. Otherwise fall back to whatever context we have.
      const base =
        baseForSave ??
        (source.kind === 'inline'
          ? {
              title: source.context.title,
              description: source.context.description ?? null,
              ingredients: source.context.ingredients,
              total_time_minutes: source.context.total_time_minutes ?? null,
            }
          : { title: recipeTitle });

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
        Alert.alert('Remix save failed', err.error ?? 'Please try again.');
        setSavingIdx(null);
        return;
      }
      const body = await res.json();
      const parsed = body.data as ParsedRecipe;
      await saveRecipe({ ...parsed, source_type: 'ai' });

      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save failed', state.error);
        setSavingIdx(null);
        return;
      }
      setSavedIdxs((prev) => new Set([...prev, idx]));
      setSavingIdx(null);
    } catch (err) {
      Alert.alert(
        'Remix save failed',
        err instanceof Error ? err.message : String(err),
      );
      setSavingIdx(null);
    }
  };

  const handleOpenSaved = (idx: number) => {
    // Best-effort: close the sheet and navigate to the most recent recipe
    // in the store (the one we just saved).
    const all = useRecipeStore.getState().recipes;
    if (all.length > 0) {
      onClose();
      router.push(`/recipes/${all[0].id}`);
    }
  };

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
            <Text style={styles.title} numberOfLines={1}>
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
            {MODES.map((m) => (
              <Pressable
                key={m.mode}
                onPress={() => handleMode(m.mode)}
                style={({ pressed }) => [
                  styles.modeCard,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.modeEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeLabel}>{m.label}</Text>
                  <Text style={styles.modeSub}>{m.sub}</Text>
                </View>
                <SymbolIcon name="chevron.forward" size={18} tintColor="#A89178" />
              </Pressable>
            ))}
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
              {MODES.find((m) => m.mode === selectedMode)?.emoji}{' '}
              {MODES.find((m) => m.mode === selectedMode)?.label}
            </Text>
            {variations.map((v, i) => {
              const saved = savedIdxs.has(i);
              const saving = savingIdx === i;
              return (
                <View key={i} style={styles.variationCard}>
                  <View style={styles.variationHeader}>
                    <View style={styles.variationNum}>
                      <Text style={styles.variationNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.variationTitle}>{v.title}</Text>
                  </View>
                  <Text style={styles.variationDescription}>{v.description}</Text>

                  {saved ? (
                    <Pressable
                      onPress={() => handleOpenSaved(i)}
                      style={styles.savedRow}
                    >
                      <SymbolIcon name="checkmark.circle.fill" size={16} tintColor="#047857" />
                      <Text style={styles.savedText}>Saved to library</Text>
                      <SymbolIcon name="chevron.forward" size={14} tintColor="#047857" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleSaveAsRecipe(i, v)}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.saveBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#C05A00" />
                      ) : (
                        <>
                          <SymbolIcon name="plus.circle" size={16} tintColor="#C05A00" />
                          <Text style={styles.saveBtnText}>Save as new recipe</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
            <View style={{ height: 16 }} />
            <Button
              title="Try Another Mode"
              variant="outline"
              onPress={handleTryAnother}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
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
    padding: 20,
    paddingBottom: 40,
  },
  helperText: {
    fontSize: 14,
    color: '#7A6651',
    marginBottom: 14,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modeEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 2,
  },
  modeSub: {
    fontSize: 13,
    color: '#7A6651',
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
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD9B0',
    backgroundColor: '#FFF7EE',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C05A00',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
  },
  savedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    flex: 0,
  },
});
