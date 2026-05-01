import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import type { MealPlanEntry } from '../../types/mealPlan';
import type { ParsedRecipe } from '../../types/recipe';
import { colors } from '../../design/tokens';

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
  const [candidates, setCandidates] = useState<ParsedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [committingIdx, setCommittingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentEntry) return;
    setLoading(true);
    try {
      // Use the entry's title as the search hint so candidates land in
      // the same culinary neighborhood (similar protein / cuisine /
      // weight). pantryOnly=true keeps the swap aligned with what the
      // user can actually cook tonight.
      const next = await fetchCandidates(currentEntry.title);
      setCandidates(next.slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, [currentEntry]);

  useEffect(() => {
    if (!visible) {
      setCandidates([]);
      setCommittingIdx(null);
      return;
    }
    void load();
  }, [visible, load]);

  const handlePick = async (idx: number, candidate: ParsedRecipe) => {
    setCommittingIdx(idx);
    try {
      await onSelect(candidate);
      onClose();
    } finally {
      setCommittingIdx(null);
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

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.loadingText}>Finding alternatives…</Text>
            </View>
          ) : candidates.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>
                No alternatives found. Try regenerating.
              </Text>
              <View style={{ height: 16 }} />
              <Button title="Try again" variant="outline" onPress={() => void load()} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {candidates.map((c, idx) => (
                <CandidateCard
                  key={`${c.title}-${idx}`}
                  recipe={c}
                  committing={committingIdx === idx}
                  disabled={committingIdx !== null && committingIdx !== idx}
                  onPress={() => void handlePick(idx, c)}
                />
              ))}
              <View style={{ height: 8 }} />
              <Button
                title="Show different options"
                variant="outline"
                onPress={() => void load()}
                disabled={committingIdx !== null}
              />
            </ScrollView>
          )}
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

  // Card chrome (bg + border + shadow) lives on a wrapping View, not the
  // Pressable, because iOS 26 / Fabric intermittently fails to paint a
  // Pressable's backgroundColor when shadow props are also set, which left
  // these tiles looking like content floating on cream (no card outline).
  // Same fix as the Surprise me hero on RemixSheet and the cooking-mode
  // Done button. Inner Pressable still owns the touch + opacity-on-press.
  return (
    <View style={[styles.card, disabled ? { opacity: 0.4 } : null]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || committing}
        style={({ pressed }) => [
          styles.cardInner,
          pressed && !disabled ? { opacity: 0.85 } : null,
        ]}
        accessibilityLabel={`Swap to ${recipe.title}`}
      >
        <View style={styles.cardThumbWrap}>
          {heroUri ? (
            <Image
              source={{ uri: heroUri }}
              style={styles.cardThumb}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.cardThumb, { backgroundColor: '#F1EAE0' }]} />
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          {totalTime > 0 && (
            <View style={styles.cardMeta}>
              <SymbolIcon name="clock" size={12} tintColor={colors.textSecondary} />
              <Text style={styles.cardMetaText}>{totalTime}m</Text>
            </View>
          )}
        </View>
        <View style={styles.cardAction}>
          {committing ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <SymbolIcon
              name="arrow.left.arrow.right"
              size="action"
              tintColor={colors.brand}
              weight="semibold"
            />
          )}
        </View>
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
    marginTop: 12,
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    // Wrapper owns chrome — bg + border + shadow paint reliably here on
    // iOS 26 / Fabric (Pressable does not). Outer paddings stay so the
    // touch surface fills the visible card.
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1EAE0',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  cardThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1EAE0',
    marginRight: 12,
  },
  cardThumb: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  cardMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  cardAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
