import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SymbolIcon } from '../../../components/ui/SymbolIcon';
import { HeaderEllipsis } from '../../../components/ui/HeaderEllipsis';
import { useRecipeStore } from '../../../stores/recipeStore';
import { ServingSizeStepper } from '../../../components/recipes/ServingSizeStepper';
import { ScaledIngredientList } from '../../../components/recipes/ScaledIngredientList';
import { FavoriteButton } from '../../../components/recipes/FavoriteButton';
import { RemixSheet } from '../../../components/recipes/RemixSheet';
import { AddToPlanSheet } from '../../../components/recipes/AddToPlanSheet';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { HeroImage } from '../../../components/ui/HeroImage';
import { getRecipeImage } from '../../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../../hooks/useGeneratedRecipeImage';
import { colors } from '../../../design/tokens';
import { shareRecipeAsPdf } from '../../../lib/recipePdf';
import { useToast } from '../../../components/ui/Toast';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { recipes, fetchRecipes, deleteRecipe } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id);

  const [servings, setServings] = useState<number>(recipe?.servings ?? 1);

  const [remixOpen, setRemixOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const { show, ToastComponent } = useToast();

  useEffect(() => {
    if (!recipe) {
      fetchRecipes();
    }
  }, [recipe, fetchRecipes]);

  useEffect(() => {
    if (recipe?.servings != null) {
      setServings((prev) => (prev === 0 ? recipe.servings ?? 1 : prev));
    }
  }, [recipe?.id]);

  if (!recipe) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color={colors.brand} />
        <Text className="text-sm text-warmGray-500 mt-3">Loading recipe...</Text>
      </SafeAreaView>
    );
  }

  const baseServings = recipe.servings ?? 1;
  const multiplier = baseServings > 0 ? servings / baseServings : 1;
  // Same Gemini fallback the listing card uses when image_url is null —
  // hits the shared session+AsyncStorage cache so legacy recipes converge
  // on the same image both surfaces show.
  const { url: generatedHeroUri } = useGeneratedRecipeImage(
    recipe.image_url ? null : recipe.title,
    {
      skip: !!recipe.image_url,
      description: recipe.description,
      ingredients: recipe.ingredients,
    },
  );
  const heroUri = getRecipeImage(
    recipe.id,
    recipe.image_url ?? generatedHeroUri,
    recipe.title,
  );

  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const handleSharePdf = async () => {
    // Pass the resolved heroUri so the PDF embeds whatever the detail
    // screen is showing — covers the Gemini-fallback case where
    // recipe.image_url is null but the app renders a generated image.
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
      show(msg, 'error');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe?',
      `"${recipe.title}" will be removed from your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecipe(recipe.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ToastComponent />
      {/* Hide the default nav header — it's rendered behind the hero. The
          floating back button below replaces it. Swipe-from-left-edge still
          pops the stack natively. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 180 }}
      >
        {/* Hero image with title overlay — NYT Cooking style */}
        <View style={{ position: 'relative' }}>
          <HeroImage uri={heroUri} height={280}>
            {/* Title + meta on image */}
            <Text style={styles.heroTitle} numberOfLines={3}>
              {recipe.title}
            </Text>
            {totalTime > 0 && (
              <View style={styles.heroMeta}>
                <SymbolIcon name="clock" size={14} tintColor="rgba(255,255,255,0.8)" />
                <Text style={styles.heroMetaText}>{totalTime} min</Text>
              </View>
            )}
          </HeroImage>
          {/* Floating close (X) — top-left, above the notch. Uses xmark
              instead of chevron.backward to match the close affordance
              users expect from every other recipe surface (PreviewSheet,
              RemixSheet, etc). canGoBack() guards the case where this
              screen was reached via a deep-link / stale Modal save flow
              with no parent route — falling back to /kitchen guarantees
              the X always exits to a known-good screen instead of
              silently no-op'ing. */}
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/kitchen');
              }
            }}
            hitSlop={12}
            style={[styles.heroBack, { top: insets.top + 8 }]}
            accessibilityLabel="Close"
          >
            <SymbolIcon name="xmark" size={22} tintColor="#FFFFFF" />
          </Pressable>
          {/* Floating action row, top-right: ellipsis overflow + favorite.
              The ellipsis collapses the 3+ secondary actions (Add to Plan,
              Remix, Delete) that used to live as inline body buttons — matches
              Apple's Mail/Notes header pattern (Phase 15 CONTEXT D-05). */}
          <View style={[styles.heroActions, { top: insets.top + 8 }]}>
            <View style={styles.heroActionBubble}>
              <HeaderEllipsis
                tintColor="#FFFFFF"
                actions={[
                  { label: 'Add to Plan', onPress: () => setPlanOpen(true) },
                  { label: 'Remix', onPress: () => setRemixOpen(true) },
                  { label: 'Share PDF', onPress: handleSharePdf },
                  { label: 'Delete', onPress: handleDelete, destructive: true },
                ]}
              />
            </View>
            <View style={styles.heroFavoriteInline}>
              <FavoriteButton
                recipeId={recipe.id}
                isFavorite={recipe.is_favorite}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        {recipe.description && (
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{recipe.description}</Text>
          </View>
        )}

        {/* Per-serving nutrition badges. Renders only when at least one
            field is populated (legacy rows + non-AI imports skip). Mirrors
            the badge cluster on PreviewSheet so the standalone detail view
            and the modal preview show the same nutrition surface. */}
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

        {/* Skills practiced card — Quick-task 6.
            Renders only when at least one of difficulty / practiced_skills /
            skill_note is set. Legacy recipes (all three null) get NO card,
            matching the "no fallback badges" rule. */}
        {(recipe.difficulty ||
          (recipe.practiced_skills && recipe.practiced_skills.length > 0) ||
          recipe.skill_note) && (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Skills practiced</Text>
            <View style={styles.skillChipRow}>
              {recipe.difficulty && (
                <Chip
                  kind="display"
                  tone={
                    recipe.difficulty === 'hard'
                      ? 'warning'
                      : recipe.difficulty === 'easy'
                        ? 'success'
                        : 'default'
                  }
                  label={
                    recipe.difficulty[0]!.toUpperCase() +
                    recipe.difficulty.slice(1)
                  }
                  leadingIcon="gauge.with.dots.needle.33percent"
                />
              )}
              {(recipe.practiced_skills ?? []).map((skill) => {
                const lc = skill.toLowerCase();
                const display = lc[0]!.toUpperCase() + lc.slice(1);
                return (
                  <Chip
                    key={skill}
                    kind="display"
                    tone="default"
                    label={display}
                    leadingIcon="sparkles"
                  />
                );
              })}
            </View>
            {recipe.skill_note && (
              <Text style={styles.skillNote}>{recipe.skill_note}</Text>
            )}
          </View>
        )}

        {/* Servings card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Servings</Text>
          <ServingSizeStepper
            servings={servings}
            onChange={setServings}
          />
        </View>

        {/* Ingredients card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Ingredients</Text>
          <ScaledIngredientList
            ingredients={recipe.ingredients}
            multiplier={multiplier}
          />
        </View>

        {/* Steps card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Steps</Text>
          {recipe.steps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Sticky footer CTAs — always visible regardless of scroll position so
          Start Cooking + Edit + Remix are one-tap from anywhere on the recipe.
          Mirrors the Something New PreviewSheet's fixed action bar. */}
      <View style={styles.stickyFooter}>
        <Button
          title="Cook Now"
          onPress={() => router.push(`/recipes/${recipe.id}/cook`)}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Edit"
              variant="outline"
              onPress={() => router.push(`/recipes/${recipe.id}/edit`)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Remix"
              variant="outline"
              onPress={() => setRemixOpen(true)}
            />
          </View>
        </View>
      </View>

      {/* Remix sheet — 4 modes + inline results. Passing the full recipe
          as `baseForSave` lets "Save as new recipe" AI-expand a variation
          into a complete new recipe in the library. */}
      <RemixSheet
        visible={remixOpen}
        source={{ kind: 'saved', recipeId: recipe.id }}
        recipeTitle={recipe.title}
        baseForSave={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          total_time_minutes: recipe.total_time_minutes,
        }}
        onClose={() => setRemixOpen(false)}
      />

      <AddToPlanSheet
        visible={planOpen}
        recipe={recipe}
        onClose={() => setPlanOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Per-serving nutrition cluster mirroring PreviewSheet's badges so the
  // standalone detail view and the modal preview render identical chips.
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
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFBF5',
    borderTopWidth: 1,
    borderTopColor: '#F1EAE0',
  },
  heroBack: {
    position: 'absolute',
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroActionBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFavoriteInline: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: '#5C4D3D',
    lineHeight: 23,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#2A221A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A140F',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2500A',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#2A221A',
    lineHeight: 23,
  },
  // Quick-task 6 — Skills practiced card.
  skillChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillNote: {
    marginTop: 10,
    fontSize: 14,
    color: '#7A6651',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
