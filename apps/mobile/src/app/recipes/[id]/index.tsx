import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '../../../stores/recipeStore';
import { useProgressionStore } from '../../../stores/progressionStore';
import { ServingSizeStepper } from '../../../components/recipes/ServingSizeStepper';
import { ScaledIngredientList } from '../../../components/recipes/ScaledIngredientList';
import { FavoriteButton } from '../../../components/recipes/FavoriteButton';
import { Button } from '../../../components/ui/Button';
import { HeroImage } from '../../../components/ui/HeroImage';
import { getRecipeImage } from '../../../constants/foodImages';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { recipes, fetchRecipes, deleteRecipe } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id);

  const [servings, setServings] = useState<number>(recipe?.servings ?? 1);

  const cookStats = useProgressionStore((s) => s.cookStats);
  const fetchVariations = useProgressionStore((s) => s.fetchVariations);
  const [variations, setVariations] = useState<string[] | null>(null);
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [variationsLocked, setVariationsLocked] = useState(false);

  const cookCount =
    cookStats.find((s) => s.recipe_id === id)?.cook_count ?? 0;
  const variationsLockedByCount = cookCount < 3;

  const handleVariations = async () => {
    if (!recipe) return;
    setVariationsLoading(true);
    setVariationsOpen(true);
    setVariationsLocked(false);
    const result = await fetchVariations(recipe.id);
    if (result === null) {
      setVariations(null);
      setVariationsLocked(true);
    } else {
      setVariations(result);
    }
    setVariationsLoading(false);
  };

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
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
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
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
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

        <View className="px-4 mt-3">
          <Pressable
            onPress={handleVariations}
            style={styles.variationsButton}
            testID="creative-variations-button"
          >
            <Ionicons
              name={variationsLockedByCount ? 'lock-closed' : 'sparkles'}
              size={18}
              color="#B45309"
            />
            <Text style={styles.variationsButtonText}>
              {variationsLockedByCount
                ? `Creative variations (cook ${3 - cookCount} more)`
                : 'Creative variations'}
            </Text>
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
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Variations modal */}
      <Modal
        visible={variationsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setVariationsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Creative variations</Text>
              <Pressable
                onPress={() => setVariationsOpen(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </Pressable>
            </View>
            {variationsLoading ? (
              <ActivityIndicator size="large" color="#F97316" />
            ) : variationsLocked ? (
              <Text style={styles.modalBody}>
                Cook this recipe 3 or more times to unlock creative
                variations from Claude.
              </Text>
            ) : variations && variations.length > 0 ? (
              <ScrollView>
                {variations.map((v, i) => (
                  <View key={i} style={styles.variationRow}>
                    <Text style={styles.variationBullet}>•</Text>
                    <Text style={styles.variationText}>{v}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.modalBody}>
                No variations available right now.
              </Text>
            )}
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFBF5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A140F',
  },
  modalBody: {
    fontSize: 15,
    color: '#5C4D3D',
    lineHeight: 23,
  },
  variationRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  variationBullet: {
    color: '#7A6651',
    marginRight: 8,
    fontSize: 16,
  },
  variationText: {
    flex: 1,
    fontSize: 15,
    color: '#2A221A',
    lineHeight: 23,
  },
});
