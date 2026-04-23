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
import { useRecipeStore } from '../../stores/recipeStore';
import { supabase } from '../../lib/supabase';
import { getRecipeImage } from '../../constants/foodImages';
import type { ParsedRecipe } from '../../types/recipe';
import { colors } from '../../design/tokens';

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

export type DiscoveredRecipe = ParsedRecipe & { _saved?: boolean };

export default function DiscoverScreen() {
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);

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
        setRecipes(list.map((r) => ({ ...r, _saved: false })));
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
          recipes.map((recipe, idx) => {
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
                  source={{ uri: heroUri }}
                  style={styles.cardImage}
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
        {previewIdx !== null && recipes[previewIdx] && (
          <PreviewSheet
            recipe={recipes[previewIdx]}
            heroUri={getRecipeImage(
              `discover-${recipes[previewIdx].title}-${previewIdx}`,
              recipes[previewIdx].image_url,
              recipes[previewIdx].title,
            )}
            onClose={() => setPreviewIdx(null)}
            onSave={async () => {
              await handleSave(previewIdx, recipes[previewIdx]);
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
}: {
  recipe: DiscoveredRecipe;
  heroUri: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const [remixOpen, setRemixOpen] = useState(false);

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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: heroUri }}
            style={styles.sheetHero}
            contentFit="cover"
            transition={300}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
          />
          <View style={styles.sheetHeroOverlay} />
          <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size={22} tintColor="#FFFFFF" />
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

        <View style={styles.sheetCard}>
          <Text style={styles.sheetSectionHeading}>Ingredients</Text>
          {recipe.ingredients.length === 0 ? (
            <Text style={styles.sheetEmpty}>No ingredients listed.</Text>
          ) : (
            recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.sheetIngredient}>
                <View style={styles.sheetBullet} />
                <Text style={styles.sheetIngredientText}>
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                  {ing.notes ? ` — ${ing.notes}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sheetCard}>
          <Text style={styles.sheetSectionHeading}>Steps</Text>
          {recipe.steps.length === 0 ? (
            <Text style={styles.sheetEmpty}>No steps listed.</Text>
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
          stamps through the unchanged parent handleSave closure. */}
      <View style={styles.sheetBottomBar}>
        {recipe._saved ? (
          <View style={styles.sheetSavedRow}>
            <SymbolIcon name="checkmark.circle.fill" size={20} tintColor="#10B981" />
            <Text style={styles.sheetSavedText}>Saved to library</Text>
            <View style={{ flex: 1 }} />
            <Button title="Done" variant="outline" onPress={onClose} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Save to Library" onPress={onSave} loading={saving} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Remix"
                variant="outline"
                onPress={() => setRemixOpen(true)}
              />
            </View>
          </View>
        )}
      </View>

      {/* Phase 17 P17-05: RemixSheet with inline-source kind. Opens when the
          user taps Remix on an unsaved discovery preview. */}
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
  sheetEmpty: {
    fontSize: 13,
    color: '#A89178',
    fontStyle: 'italic',
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
