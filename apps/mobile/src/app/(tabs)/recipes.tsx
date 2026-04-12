import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '../../stores/recipeStore';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { Button } from '../../components/ui/Button';
import type { Recipe } from '../../types/recipe';

function ImportFab() {
  return (
    <Pressable
      onPress={() => router.push('/recipes/import')}
      className="absolute bottom-6 right-6 w-16 h-16 bg-orange-500 rounded-full items-center justify-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </Pressable>
  );
}

export default function RecipesScreen() {
  const { recipes, isLoading, fetchRecipes, error } = useRecipeStore();

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleCardPress = (recipe: Recipe) => {
    // Detail view navigation to be added later
    console.log('Recipe tapped:', recipe.title);
  };

  if (isLoading && recipes.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">
          Loading recipes...
        </Text>
      </SafeAreaView>
    );
  }

  if (!isLoading && recipes.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📖</Text>
          <Text className="text-2xl font-bold text-warmGray-900 mb-2">
            No recipes yet
          </Text>
          <Text className="text-base text-warmGray-500 text-center leading-6 mb-6">
            Import your first recipe from a URL, photo, or paste some text.
          </Text>
          <Button
            title="Import Your First Recipe"
            onPress={() => router.push('/recipes/import')}
          />
          {error && (
            <Text className="text-sm text-red-600 mt-4">{error}</Text>
          )}
        </View>
        <ImportFab />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-2xl font-bold text-warmGray-900">
          My Recipes
        </Text>
        <Text className="text-sm text-warmGray-500 mt-0.5">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </Text>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={handleCardPress} />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchRecipes}
            tintColor="#F97316"
          />
        }
      />

      <ImportFab />
    </SafeAreaView>
  );
}
