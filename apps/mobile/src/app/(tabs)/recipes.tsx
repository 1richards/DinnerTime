import React, { useEffect, useState, useDeferredValue } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRecipeStore } from '../../stores/recipeStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useNetworkStore } from '../../stores/networkStore';
import { RecipeCard } from '../../components/recipes/RecipeCard';
import { SearchBar } from '../../components/recipes/SearchBar';
import { ChipToggle } from '../../components/ui/ChipToggle';
import { Button } from '../../components/ui/Button';
import { HeroImage } from '../../components/ui/HeroImage';
import { SuggestedForYou } from '../../components/SuggestedForYou';
import { FOOD_IMAGES } from '../../constants/foodImages';
import type { Recipe } from '../../types/recipe';

// Stable hero for the recipes banner
const RECIPES_HERO = FOOD_IMAGES.bakedGoods[0];
const EMPTY_STATE_IMG = FOOD_IMAGES.pasta[0];

function ImportFab() {
  return (
    <Pressable
      onPress={() => router.push('/recipes/import')}
      style={styles.fab}
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
    if (!isOnline && recipes.length > 0) return;
    fetchRecipes({
      q: deferredQuery || undefined,
      favoritesOnly: showFavoritesOnly,
    });
  }, [deferredQuery, showFavoritesOnly, fetchRecipes, isOnline, recipes.length]);

  // Phase 10: skill progression
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
      {/* Hero banner */}
      <HeroImage uri={RECIPES_HERO} height={140} style={{ marginBottom: 0 }}>
        <View>
          <Text style={styles.heroBannerTitle}>My Recipes</Text>
          <Text style={styles.heroBannerSub}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your library
          </Text>
        </View>
      </HeroImage>

      <SuggestedForYou suggestions={ambitionSuggestions} />
      <View className="px-4 pt-3">
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
        {/* Hero banner at top */}
        <HeroImage uri={EMPTY_STATE_IMG} height={200}>
          <Text style={styles.heroBannerTitle}>My Recipes</Text>
          <Text style={styles.heroBannerSub}>Start building your collection</Text>
        </HeroImage>

        <View style={styles.emptyStateBody}>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySubtitle}>
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
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
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

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  heroBannerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroBannerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  emptyStateBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#7A6651',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});
