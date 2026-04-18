import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { Recipe } from '../../types/recipe';
import { getRecipeImage } from '../../constants/foodImages';
import { useRecipeStore } from '../../stores/recipeStore';
import { colors } from '../../design/tokens';
import { resolveCardClasses, type RecipeCardMode } from './recipeCardStyles';
import { RemixSheet } from './RemixSheet';

interface RecipeCardProps {
  recipe: Recipe;
  /**
   * `grid` (default) — 2-col image-forward layout with 4:3 hero photo on top
   * (Spotify album-card feel). Used on Library browse and Home suggestion grid.
   * `list` — horizontal row with fixed 96pt square thumbnail left, title +
   * metadata stacked right. Used for Something New / search results (Phase 17).
   */
  mode?: RecipeCardMode;
  onPress?: (recipe: Recipe) => void;
}

const SOURCE_LABELS: Record<Recipe['source_type'], string> = {
  url: 'URL',
  photo: 'Photo',
  manual: 'Manual',
  ai: 'AI',
};

export function RecipeCard({ recipe, mode = 'grid', onPress }: RecipeCardProps) {
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);
  const [remixOpen, setRemixOpen] = useState(false);
  const c = resolveCardClasses(mode);
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const imageUri = getRecipeImage(recipe.id, recipe.image_url);

  return (
    <>
      <Pressable
        onPress={() => onPress?.(recipe)}
        className={c.container}
        style={({ pressed }) => [
          {
            // RN iOS shadows don't compose cleanly through NativeWind; apply inline
            // with tokenized color so dark-mode palette swap (Phase 23+) picks
            // this up automatically.
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          },
          pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
        ]}
      >
        {/* Food photo */}
        <View className={c.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            cachePolicy="memory-disk"
          />
          {/* Subtle gradient overlay for text legibility over the photo.
              Uses rgba over the image for contrast — this is a pure overlay
              effect, not a brand color, so rgba literal is acceptable. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(15,10,5,0.18)' },
            ]}
          />
          {/* Source badge over image */}
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>
              {SOURCE_LABELS[recipe.source_type]}
            </Text>
          </View>
          {/* Top-right action cluster: Remix sparkle + Favorite heart.
              Both stop propagation so taps don't trigger the outer card. */}
          <View style={styles.actionCluster}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setRemixOpen(true);
              }}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionBadge,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel="Remix recipe"
            >
              {/* `#FFE4B5` is an intentional decorative warm off-white accent
                  specifically for the sparkle glyph over dark imagery — NOT a
                  brand color. Documented deviation from Phase 19 purity. */}
              <SymbolIcon name="sparkles" size={18} tintColor="#FFE4B5" />
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                toggleFavorite(recipe.id);
              }}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionBadge,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel={
                recipe.is_favorite ? 'Unfavorite recipe' : 'Favorite recipe'
              }
            >
              <SymbolIcon
                name={recipe.is_favorite ? 'heart.fill' : 'heart'}
                size={20}
                tintColor={recipe.is_favorite ? colors.destructive : '#FFFFFF'}
              />
            </Pressable>
          </View>
        </View>

        {/* Text content */}
        <View className={c.body}>
          <Text className={c.title} numberOfLines={2}>
            {recipe.title}
          </Text>

          <View className={c.metaRow}>
            {totalTime > 0 && (
              <View className="flex-row items-center mr-3">
                <SymbolIcon name="clock" size={13} tintColor={colors.textSecondary} />
                <Text className={`ml-1 ${c.metaText}`}>{totalTime} min</Text>
              </View>
            )}
            {recipe.servings != null && (
              <View className="flex-row items-center">
                <SymbolIcon name="person.2" size={13} tintColor={colors.textSecondary} />
                <Text className={`ml-1 ${c.metaText}`}>{recipe.servings} servings</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      <RemixSheet
        visible={remixOpen}
        recipeTitle={recipe.title}
        source={{ kind: 'saved', recipeId: recipe.id }}
        baseForSave={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          total_time_minutes: recipe.total_time_minutes,
        }}
        onClose={() => setRemixOpen(false)}
      />
    </>
  );
}

export type { RecipeCardMode };

// Non-tokenizable positioning styles (absolute overlay clusters) — colors use
// rgba over imagery, not brand tokens. Text sizes use the type scale via
// NativeWind classes on the actionable text; these are decorative badges.
const styles = StyleSheet.create({
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
  actionCluster: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  actionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
