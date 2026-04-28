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
import { HeroImage } from '../../../components/ui/HeroImage';
import { getRecipeImage } from '../../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../../hooks/useGeneratedRecipeImage';
import { colors } from '../../../design/tokens';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { recipes, fetchRecipes, deleteRecipe } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id);

  const [servings, setServings] = useState<number>(recipe?.servings ?? 1);

  const [remixOpen, setRemixOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

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
          {/* Floating back chevron — top-left, above the notch */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.heroBack, { top: insets.top + 8 }]}
            accessibilityLabel="Back"
          >
            <SymbolIcon name="chevron.backward" size={22} tintColor="#FFFFFF" />
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
          title="Start Cooking"
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
});
