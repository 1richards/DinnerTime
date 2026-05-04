import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { HeroImage } from '../ui/HeroImage';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { useRecipeStore } from '../../stores/recipeStore';
import type { MealPlanEntry } from '../../types/mealPlan';
import type { ParsedRecipe, Recipe } from '../../types/recipe';
import { colors } from '../../design/tokens';

/**
 * Recipe Box → ParsedRecipe shape. Strips the DB-only fields (id,
 * profile_id, created_at, etc.) so the swap commit (`applySwap`)
 * receives the same shape it gets from AI candidates and Remix flows.
 */
function recipeToParsed(r: Recipe): ParsedRecipe {
  return {
    title: r.title,
    description: r.description ?? null,
    ingredients: r.ingredients,
    steps: r.steps,
    prep_time_minutes: r.prep_time_minutes ?? null,
    cook_time_minutes: r.cook_time_minutes ?? null,
    total_time_minutes: r.total_time_minutes ?? null,
    servings: r.servings ?? null,
    image_url: r.image_url ?? null,
    source_type: r.source_type ?? null,
    source_url: r.source_url ?? null,
    calories_per_serving: r.calories_per_serving ?? null,
    protein_grams_per_serving: r.protein_grams_per_serving ?? null,
    fat_grams_per_serving: r.fat_grams_per_serving ?? null,
    difficulty: r.difficulty ?? null,
    practiced_skills: r.practiced_skills ?? null,
    skill_note: r.skill_note ?? null,
  };
}

interface SwapSheetProps {
  visible: boolean;
  currentEntry: MealPlanEntry | null;
  /** Day-of-week (0=Mon..6=Sun) the swap targets — needed to scope
      the suggestion fetch even though commit happens server-side. */
  day: number | null;
  /** Fire when the user picks a candidate. Parent commits via the
      meal-plan store's assign action. */
  onSelect: (candidate: ParsedRecipe) => Promise<void>;
  onClose: () => void;
}

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchCandidates(
  query: string,
): Promise<ParsedRecipe[]> {
  const token = await getAuthToken();
  if (!token) return [];
  const res = await fetch(`${getApiBaseUrl()}/api/v1/recipes/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, pantryOnly: true }),
  });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.data ?? []) as ParsedRecipe[];
}

export function SwapSheet({
  visible,
  currentEntry,
  day: _day,
  onSelect,
  onClose,
}: SwapSheetProps) {
  // Recipe Box first: the user's existing library is the primary source.
  // Filter out the entry's own backing recipe so the user can't "swap"
  // the meal for the same meal, then sort alphabetically for predictable
  // scanning. AI candidates only fetch when the user explicitly asks via
  // "Generate fresh ideas" — keeps the default open instant + offline.
  const recipeBox = useRecipeStore((s) => s.recipes);
  const boxCandidates = useMemo<ParsedRecipe[]>(() => {
    const filtered = currentEntry?.recipe_id
      ? recipeBox.filter((r) => r.id !== currentEntry.recipe_id)
      : recipeBox;
    return [...filtered]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(recipeToParsed);
  }, [recipeBox, currentEntry?.recipe_id]);

  const [aiCandidates, setAiCandidates] = useState<ParsedRecipe[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [committingKey, setCommittingKey] = useState<string | null>(null);

  const loadAi = useCallback(async () => {
    if (!currentEntry) return;
    setLoadingAi(true);
    try {
      // Title-anchored, pantry-only — same culinary neighborhood, ingredients
      // the user can actually cook tonight.
      const next = await fetchCandidates(currentEntry.title);
      setAiCandidates(next.slice(0, 4));
    } finally {
      setLoadingAi(false);
    }
  }, [currentEntry]);

  useEffect(() => {
    if (!visible) {
      setAiCandidates([]);
      setLoadingAi(false);
      setCommittingKey(null);
    }
  }, [visible]);

  const handlePick = async (key: string, candidate: ParsedRecipe) => {
    setCommittingKey(key);
    try {
      await onSelect(candidate);
      onClose();
    } finally {
      setCommittingKey(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>SWAP THIS MEAL</Text>
              {currentEntry && (
                <Text style={styles.currentTitle} numberOfLines={2}>
                  {currentEntry.title}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <SymbolIcon name="xmark" size="action" tintColor={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {boxCandidates.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>FROM YOUR RECIPE BOX</Text>
                {boxCandidates.map((c, idx) => {
                  const key = `box-${idx}`;
                  return (
                    <CandidateCard
                      key={key}
                      recipe={c}
                      committing={committingKey === key}
                      disabled={committingKey !== null && committingKey !== key}
                      onPress={() => void handlePick(key, c)}
                    />
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyBox}>
                <SymbolIcon
                  name="tray"
                  size={28}
                  tintColor={colors.textTertiary}
                />
                <Text style={styles.emptyBoxText}>
                  Your Recipe Box is empty. Generate ideas below or save
                  recipes from Discover first.
                </Text>
              </View>
            )}

            {/* Generate-ideas section. Stays collapsed until the user asks
                for AI candidates — keeps the default sheet open instant
                and offline-friendly. */}
            <View style={styles.aiSectionDivider} />
            <Text style={styles.sectionLabel}>FRESH IDEAS</Text>
            {loadingAi ? (
              <View style={styles.aiLoadingWrap}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.loadingText}>Finding alternatives…</Text>
              </View>
            ) : aiCandidates.length === 0 ? (
              <Button
                title="Generate ideas"
                variant="outline"
                onPress={() => void loadAi()}
                disabled={committingKey !== null}
              />
            ) : (
              <>
                {aiCandidates.map((c, idx) => {
                  const key = `ai-${idx}`;
                  return (
                    <CandidateCard
                      key={key}
                      recipe={c}
                      committing={committingKey === key}
                      disabled={committingKey !== null && committingKey !== key}
                      onPress={() => void handlePick(key, c)}
                    />
                  );
                })}
                <View style={{ height: 4 }} />
                <Button
                  title="Show different ideas"
                  variant="outline"
                  onPress={() => void loadAi()}
                  disabled={committingKey !== null}
                />
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface CandidateCardProps {
  recipe: ParsedRecipe;
  committing: boolean;
  disabled: boolean;
  onPress: () => void;
}

function CandidateCard({
  recipe,
  committing,
  disabled,
  onPress,
}: CandidateCardProps) {
  // Pull the same Gemini-generated thumbnail RecipeCard / Plan tile use,
  // so the swap suggestion looks identical to how this recipe would
  // appear once committed to the plan.
  const { url: generatedUri } = useGeneratedRecipeImage(recipe.title, {
    skip: !!recipe.image_url,
    description: recipe.description,
    ingredients: recipe.ingredients,
  });
  const heroUri = recipe.image_url ?? generatedUri ?? null;
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  // Meta strip mirrors HeroDayCard ("Easy · 25m · 4 servings") so swap
  // candidates read as the same surface as the day they'll replace.
  const metaParts: string[] = [];
  if (recipe.difficulty) {
    metaParts.push(
      recipe.difficulty[0]!.toUpperCase() + recipe.difficulty.slice(1),
    );
  }
  if (totalTime > 0) metaParts.push(`${totalTime}m`);
  if (recipe.servings != null) {
    metaParts.push(
      `${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
    );
  }

  // Card chrome (bg + border + shadow) lives on a wrapping View, not the
  // Pressable, because iOS 26 / Fabric intermittently fails to paint a
  // Pressable's backgroundColor when shadow props are also set. Same fix
  // pattern as the Surprise me hero on RemixSheet and the cooking-mode
  // Done button. Inner Pressable owns the touch + opacity-on-press.
  return (
    <View style={[styles.card, disabled ? { opacity: 0.4 } : null]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || committing}
        style={({ pressed }) => [
          styles.cardInner,
          pressed && !disabled ? { opacity: 0.92 } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Swap to ${recipe.title}`}
      >
        {/* 16:9 hero with title overlay — same visual language as the
            Plan tab landing hero day card (HeroDayCard). Big white title
            on a darkened bottom band of the photo. */}
        <View style={styles.heroFrame}>
          <HeroImage uri={heroUri} height={180} borderRadius={14} />
          <View style={styles.heroOverlayContent}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {recipe.title}
            </Text>
          </View>
          {committing ? (
            <View style={styles.heroSpinner}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {/* Meta strip (difficulty · time · servings) + optional nutrition
            pill — mirrors HeroDayCard's strip below its hero. */}
        {(metaParts.length > 0 ||
          recipe.calories_per_serving != null ||
          recipe.protein_grams_per_serving != null) && (
          <View style={styles.metaRow}>
            {metaParts.length > 0 && (
              <>
                <SymbolIcon
                  name="fork.knife"
                  size={13}
                  tintColor={colors.textSecondary}
                />
                <Text style={styles.metaText}>{metaParts.join(' · ')}</Text>
              </>
            )}
            {(recipe.calories_per_serving != null ||
              recipe.protein_grams_per_serving != null) && (
              <View style={styles.nutritionPill}>
                <SymbolIcon
                  name="bolt.fill"
                  size={11}
                  tintColor={colors.warning}
                />
                <Text style={styles.nutritionPillText}>
                  {recipe.calories_per_serving != null
                    ? `${Math.round(recipe.calories_per_serving)} kcal`
                    : ''}
                  {recipe.calories_per_serving != null &&
                  recipe.protein_grams_per_serving != null
                    ? ' · '
                    : ''}
                  {recipe.protein_grams_per_serving != null
                    ? `${Math.round(recipe.protein_grams_per_serving)}g`
                    : ''}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFBF5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAE0',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C05A00',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  currentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  // Section header for "FROM YOUR RECIPE BOX" / "FRESH IDEAS"
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#C05A00',
    marginBottom: 10,
    marginLeft: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyBoxText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  aiSectionDivider: {
    height: 1,
    backgroundColor: '#F1EAE0',
    marginVertical: 16,
  },
  aiLoadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    // Wrapper owns chrome — bg + border + shadow paint reliably here on
    // iOS 26 / Fabric (Pressable does not). Inner paddingBottom mirrors
    // HeroDayCard so the meta strip sits below the image with the same
    // breathing room.
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    paddingBottom: 12,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInner: {
    // Stack: hero image on top, meta strip below — matches HeroDayCard.
    flexDirection: 'column',
  },
  heroFrame: {
    position: 'relative',
  },
  heroOverlayContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSpinner: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  nutritionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 153, 0, 0.15)',
    marginLeft: 'auto',
    gap: 3,
  },
  nutritionPillText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
});
