import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '../../../stores/recipeStore';
import { useProgressionStore } from '../../../stores/progressionStore';
import { ServingSizeStepper } from '../../../components/recipes/ServingSizeStepper';
import { ScaledIngredientList } from '../../../components/recipes/ScaledIngredientList';
import { FavoriteButton } from '../../../components/recipes/FavoriteButton';
import { Button } from '../../../components/ui/Button';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-4 pt-3">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-2xl font-bold text-warmGray-900 mr-3">
              {recipe.title}
            </Text>
            <FavoriteButton
              recipeId={recipe.id}
              isFavorite={recipe.is_favorite}
            />
          </View>

          {recipe.description && (
            <Text className="text-base text-warmGray-600 mt-2 leading-6">
              {recipe.description}
            </Text>
          )}

          <View className="flex-row items-center gap-4 mt-3">
            {totalTime > 0 && (
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text className="text-sm text-warmGray-500 ml-1">
                  {totalTime} min
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-4 mt-5">
          <Text className="text-lg font-semibold text-warmGray-900 mb-2">
            Servings
          </Text>
          <ServingSizeStepper
            servings={servings}
            onChange={setServings}
          />
        </View>

        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-warmGray-900 mb-2">
            Ingredients
          </Text>
          <ScaledIngredientList
            ingredients={recipe.ingredients}
            multiplier={multiplier}
          />
        </View>

        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-warmGray-900 mb-2">
            Steps
          </Text>
          {recipe.steps.map((step, idx) => (
            <View key={idx} className="flex-row items-start mb-3">
              <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center mr-3">
                <Text className="text-sm font-semibold text-orange-700">
                  {idx + 1}
                </Text>
              </View>
              <Text className="flex-1 text-base text-warmGray-800 leading-6">
                {step}
              </Text>
            </View>
          ))}
        </View>

        <View className="px-4 mt-6">
          <Button
            title="Start Cooking"
            onPress={() => router.push(`/recipes/${recipe.id}/cook`)}
          />
        </View>

        <View className="px-4 mt-3">
          <Pressable
            onPress={handleVariations}
            className="h-12 rounded-xl border border-amber-300 bg-amber-50 items-center justify-center flex-row"
            testID="creative-variations-button"
          >
            <Ionicons
              name={variationsLockedByCount ? 'lock-closed' : 'sparkles'}
              size={18}
              color="#B45309"
            />
            <Text className="text-amber-800 font-semibold ml-2">
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
            className="px-4 h-12 rounded-xl border border-red-200 bg-red-50 items-center justify-center flex-row"
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text className="text-red-700 font-medium ml-2">Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={variationsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setVariationsOpen(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-warmWhite rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-warmGray-900">
                Creative variations
              </Text>
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
              <Text className="text-base text-warmGray-600 leading-6">
                Cook this recipe 3 or more times to unlock creative
                variations from Claude.
              </Text>
            ) : variations && variations.length > 0 ? (
              <ScrollView>
                {variations.map((v, i) => (
                  <View key={i} className="flex-row mb-3">
                    <Text className="text-warmGray-500 mr-2">•</Text>
                    <Text className="flex-1 text-base text-warmGray-800 leading-6">
                      {v}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text className="text-base text-warmGray-600">
                No variations available right now.
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
