import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '../../types/recipe';
import { getRecipeImage } from '../../constants/foodImages';
import { useRecipeStore } from '../../stores/recipeStore';

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: (recipe: Recipe) => void;
}

const SOURCE_LABELS: Record<Recipe['source_type'], string> = {
  url: 'URL',
  photo: 'Photo',
  manual: 'Manual',
  ai: 'AI',
};

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const imageUri = getRecipeImage(recipe.id, recipe.image_url);

  return (
    <Pressable
      onPress={() => onPress?.(recipe)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Food photo */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
          placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
          cachePolicy="memory-disk"
        />
        {/* Subtle gradient overlay for text legibility */}
        <View style={styles.imageOverlay} />
        {/* Source badge over image */}
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>
            {SOURCE_LABELS[recipe.source_type]}
          </Text>
        </View>
        {/* Favorite heart — interactive, not just a visual. Stop propagation
            so tapping the heart doesn't also trigger the outer card press. */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(recipe.id);
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.heartBadge,
            pressed && { opacity: 0.6 },
          ]}
          accessibilityLabel={recipe.is_favorite ? 'Unfavorite recipe' : 'Favorite recipe'}
        >
          <Ionicons
            name={recipe.is_favorite ? 'heart' : 'heart-outline'}
            size={22}
            color={recipe.is_favorite ? '#EF4444' : '#FFFFFF'}
          />
        </Pressable>
      </View>

      {/* Text content */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <View style={styles.metaRow}>
          {totalTime > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color="#7A6651" />
              <Text style={styles.metaText}>{totalTime} min</Text>
            </View>
          )}
          {recipe.servings != null && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color="#7A6651" />
              <Text style={styles.metaText}>{recipe.servings} servings</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#2A221A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    height: 160,
    width: '100%',
    backgroundColor: '#2A221A',
    position: 'relative',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,10,5,0.18)',
  },
  sourceBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A140F',
    letterSpacing: -0.2,
    lineHeight: 21,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#7A6651',
  },
});
