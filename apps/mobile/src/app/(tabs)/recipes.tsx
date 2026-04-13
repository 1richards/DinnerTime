import React, { useEffect, useState, useDeferredValue } from 'react';
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
import { useProgressionStore } from '../../stores/progressionStore';
import { useNetworkStore } from '../../stores/networkStore';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { SearchBar } from '../../components/recipes/SearchBar';
import { ChipToggle } from '../../components/ui/ChipToggle';
import { Button } from '../../components/ui/Button';
import { SuggestedForYou } from '../../components/SuggestedForYou';
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
  const ambitionSuggestions = useProgressionStore((s) => s.ambitionSuggestions);
  const fetchSuggestions = useProgressionStore((s) => s.fetchSuggestions);
  const fetchCookStats = useProgressionStore((s) => s.fetchCookStats);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    // Skip network call when offline AND we already have a cached list.
    // Persisted recipes from 10-04 will still render.
    if (!isOnline && recipes.length > 0) return;
    fetchRecipes({
      q: deferredQuery || undefined,
      favoritesOnly: showFavoritesOnly,
    });
  }, [deferredQuery, showFavoritesOnly, fetchRecipes, isOnline, recipes.length]);

  // Phase 10: skill progression — fetch ambition suggestions + cook stats once
  // on mount. Both gracefully no-op when offline.
  useEffect(() => {
    if (!isOnline) return;
    void fetchSuggestions();
    void fetchCookStats();
  }, [isOnline, fetchSuggestions, fetchCookStats]);

  const handleCardPress = (recipe: Recipe) => {
    router.push(`/recipes/${recipe.id}`);
  };

  const header = (
    <View className="pt-2 pb-3">
      <SuggestedForYou suggestions={ambitionSuggestions} />
      <View className="px-4">
      <Text className="text-2xl font-bold text-warmGray-900">My Recipes</Text>
      <Text className="text-sm text-warmGray-500 mt-0.5 mb-3">
        {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
      </Text>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <View className="flex-row items-center gap-2 mt-3">
        <ChipToggle
          label="Favorites"
          selected={showFavoritesOnly}
          onToggle={() => setShowFavoritesOnly((v) => !v)}
          colorScheme="red"
        />
        <Pressable
          onPress={() => router.push('/recipes/discover')}
          className="flex-row items-center px-4 py-2 rounded-full bg-amber-100 border border-amber-200"
        >
          <Ionicons name="sparkles" size={14} color="#B45309" />
          <Text className="text-sm font-medium text-amber-800 ml-1">
            Discover
          </Text>
        </Pressable>
      </View>
      </View>
    </View>
  );

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

  if (
    !isLoading &&
    recipes.length === 0 &&
    !deferredQuery &&
    !showFavoritesOnly
  ) {
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
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={handleCardPress} />
        )}
        ListEmptyComponent={
          <View className="items-center mt-12 px-6">
            <Text className="text-base text-warmGray-500 text-center">
              {showFavoritesOnly
                ? 'No favorites yet. Tap the heart on a recipe to favorite it.'
                : 'No recipes match your search.'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() =>
              fetchRecipes({
                q: deferredQuery || undefined,
                favoritesOnly: showFavoritesOnly,
              })
            }
            tintColor="#F97316"
          />
        }
      />

      <ImportFab />
    </SafeAreaView>
  );
}
