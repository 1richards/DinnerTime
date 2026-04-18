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
import { useRecipeStore } from '../../../stores/recipeStore';
import { ServingSizeStepper } from '../../../components/recipes/ServingSizeStepper';
import { ScaledIngredientList } from '../../../components/recipes/ScaledIngredientList';
import { FavoriteButton } from '../../../components/recipes/FavoriteButton';
import { RemixSheet } from '../../../components/recipes/RemixSheet';
import { AddToPlanSheet } from '../../../components/recipes/AddToPlanSheet';
import { Button } from '../../../components/ui/Button';
import { HeroImage } from '../../../components/ui/HeroImage';
import { getRecipeImage } from '../../../constants/foodImages';

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
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">Loading recipe...</Text>
      </SafeAreaView>
    );
  }

  const baseServings = recipe.servings ?? 1;
  const multiplier = baseServings > 0 ? servings / baseServings : 1;
  const heroUri = getRecipeImage(recipe.id, recipe.image_url);

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
        contentContainerStyle={{ paddingBottom: 120 }}
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
          {/* Favorite button floats over the image */}
          <View style={[styles.heroFavorite, { top: insets.top + 8 }]}>
            <FavoriteButton
              recipeId={recipe.id}
              isFavorite={recipe.is_favorite}
            />
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

        {/* CTAs */}
        <View className="px-4 mt-4">
          <Button
            title="Start Cooking"
            onPress={() => router.push(`/recipes/${recipe.id}/cook`)}
          />
        </View>

        <View className="px-4 mt-3 flex-row gap-3">
          <Pressable
            onPress={() => setPlanOpen(true)}
            style={[styles.variationsButton, { flex: 1 }]}
            testID="add-to-plan-button"
          >
            <SymbolIcon name="calendar" size={18} tintColor="#B45309" />
            <Text style={styles.variationsButtonText}>Add to plan</Text>
          </Pressable>
          <Pressable
            onPress={() => setRemixOpen(true)}
            style={[styles.variationsButton, { flex: 1 }]}
            testID="creative-variations-button"
          >
            <SymbolIcon name="sparkles" size={18} tintColor="#B45309" />
            <Text style={styles.variationsButtonText}>Remix</Text>
          </Pressable>
        </View>

        <View className="px-4 mt-3 flex-row gap-3">
          <View className="flex-1">
            <Button
              title="Edit"
              variant="outline"
              onPress={() => router.push(`/recipes/${recipe.id}/edit`)}
            />
          </View>
          <Pressable
            onPress={handleDelete}
            style={styles.deleteButton}
          >
            <SymbolIcon name="trash" size={18} tintColor="#DC2626" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

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
  heroFavorite: {
    position: 'absolute',
    right: 14,
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
  variationsButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  variationsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  deleteButton: {
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
});
