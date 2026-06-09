import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { Recipe } from '../../types/recipe';
import { getRecipeImage } from '../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { useRecipeStore } from '../../stores/recipeStore';
import { colors } from '../../design/tokens';
import { resolveCardClasses, type RecipeCardMode } from './recipeCardStyles';
import { RemixSheet } from './RemixSheet';

/**
 * Preview-mode quick-action overlays. When `preview` is true AND any handler
 * is provided, the card renders these icons over the hero (Save, Remix,
 * Cook now) in place of the saved-mode Favorite + Remix cluster. Each button
 * stops propagation so tapping an icon doesn't trigger the card's own onPress.
 */
export interface PreviewActions {
  onSave?: () => void | Promise<void>;
  onRemix?: () => void;
  onCookNow?: () => void | Promise<void>;
  /** Save the recipe AND mark it favorite in one tap. Renders as a
      heart icon alongside the bookmark; flips to heart.fill when done. */
  onSaveAndFavorite?: () => void | Promise<void>;
  /** Show a green check + "Saved" state instead of the save icon. */
  saved?: boolean;
  /** Show a filled heart instead of the outline. Independent of `saved`
      because the bookmark + heart actions are separate paths. */
  favorited?: boolean;
  /** Which action is currently in-flight (shows a spinner on that icon). */
  working?: 'save' | 'cook' | 'favorite' | null;
}

interface RecipeCardProps {
  recipe: Recipe;
  /**
   * `grid` (default) — 2-col image-forward layout with 4:3 hero photo on top
   * (Spotify album-card feel). Used on Library browse and Home suggestion grid.
   * `list` — horizontal row with fixed 96pt square thumbnail left, title +
   * metadata stacked right. Used for Something New / search results (Phase 17).
   */
  mode?: RecipeCardMode;
  /**
   * When true, suppress mutative overlays (favorite heart + remix sparkle)
   * and don't mount the RemixSheet. Used for unsaved preview surfaces
   * (Something New results) where the recipe has no persistent id yet.
   */
  preview?: boolean;
  /**
   * Preview-mode quick actions — Save / Remix / Cook now overlays rendered
   * over the hero. Only honored when `preview` is true.
   */
  previewActions?: PreviewActions;
  /**
   * Optional Cook now handler for saved recipes (non-preview mode). When
   * provided, a flame badge is added to the action cluster alongside the
   * remix sparkle and favorite heart — matching the Something New layout
   * so the affordance reads identically across both surfaces.
   */
  onCookNow?: (recipe: Recipe) => void;
  onPress?: (recipe: Recipe) => void;
  /**
   * Accepted for backwards compatibility (SuggestionList passes a cuisine
   * type), but no longer rendered. The source-type / cuisine corner badge
   * was removed entirely in Plan 27-02 (Decision 7) — no AI/URL/cuisine
   * label appears on any card now.
   */
  cuisineLabel?: string | null;
  /**
   * When > 0, renders a green "X items from pantry" pill in the meta
   * row beneath the title. Lets the card surface how much of the
   * recipe is already in the user's kitchen.
   */
  pantryMatchCount?: number;
  /**
   * When true, suppresses the "X servings" meta cell. The unified
   * Cook Tonight / Something New view drops servings from cards in
   * favor of cuisine + pantry-match badges — the saved-recipe
   * surfaces (Library) keep the default and still show servings.
   */
  hideServings?: boolean;
}

function RecipeCardBase({
  recipe,
  mode = 'grid',
  preview = false,
  previewActions,
  onCookNow,
  onPress,
  // cuisineLabel is still accepted (SuggestionList passes it) but no longer
  // rendered — the source-type / cuisine corner badge was removed in Plan
  // 27-02 (Decision 7). Intentionally not destructured so it's a harmless
  // accepted-but-ignored prop.
  pantryMatchCount,
  hideServings,
}: RecipeCardProps) {
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);
  const [remixOpen, setRemixOpen] = useState(false);
  const c = resolveCardClasses(mode);
  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  // When the saved recipe has no persisted image_url (common for AI recipes
  // saved before Gemini resolved, or pre-quick-3 saves), fall through to
  // useGeneratedRecipeImage so Recipe Box converges on the same Gemini photo
  // Something New shows. Hook is a no-op for cache hits / when image_url is
  // already set, so this is free for the common path.
  const { url: generatedUri } = useGeneratedRecipeImage(
    recipe.image_url ? null : recipe.title,
    {
      skip: !!recipe.image_url,
      description: recipe.description,
      ingredients: recipe.ingredients,
      // Decision 1 wiring — when this is a saved recipe, send its id so the
      // server (Plan 27-01) persists the generated URL to recipes.image_url.
      // Unsaved "Something New" previews carry no id → undefined → no write.
      recipeId: recipe.id ?? undefined,
    },
  );
  const imageUri = getRecipeImage(
    recipe.id,
    recipe.image_url ?? generatedUri,
    recipe.title,
  );

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
            source={imageUri ? { uri: imageUri } : null}
            style={[
              StyleSheet.absoluteFillObject,
              !imageUri && { backgroundColor: '#F1EAE0' },
            ]}
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
          {/* Preview-mode quick actions — Save, Remix, Cook now. Rendered
              over the hero when the card represents an unsaved ParsedRecipe
              (e.g. Something New results). Each button stops propagation so
              tapping the icon doesn't also trigger the card's onPress. */}
          {preview && previewActions && (
            <View style={styles.actionCluster}>
              {previewActions.onCookNow && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    void previewActions.onCookNow?.();
                  }}
                  hitSlop={10}
                  disabled={previewActions.working != null}
                  style={({ pressed }) => [
                    styles.actionBadge,
                    pressed && { opacity: 0.6 },
                  ]}
                  accessibilityLabel="Cook this recipe now"
                >
                  {previewActions.working === 'cook' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <SymbolIcon name="flame.fill" size={26} tintColor="#FFE4B5" />
                  )}
                </Pressable>
              )}
              {previewActions.onRemix && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    previewActions.onRemix?.();
                  }}
                  hitSlop={10}
                  disabled={previewActions.working != null}
                  style={({ pressed }) => [
                    styles.actionBadge,
                    pressed && { opacity: 0.6 },
                  ]}
                  accessibilityLabel="Remix recipe"
                >
                  <SymbolIcon name="sparkles" size={26} tintColor="#FFE4B5" />
                </Pressable>
              )}
              {previewActions.onSave && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (previewActions.saved) return;
                    void previewActions.onSave?.();
                  }}
                  hitSlop={10}
                  disabled={
                    previewActions.saved || previewActions.working != null
                  }
                  style={({ pressed }) => [
                    styles.actionBadge,
                    pressed && { opacity: 0.6 },
                  ]}
                  accessibilityLabel={
                    previewActions.saved ? 'Saved to library' : 'Save to library'
                  }
                >
                  {previewActions.working === 'save' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <SymbolIcon
                      name={previewActions.saved ? 'checkmark.circle.fill' : 'bookmark'}
                      size={26}
                      tintColor={previewActions.saved ? '#10B981' : '#FFFFFF'}
                    />
                  )}
                </Pressable>
              )}
              {previewActions.onSaveAndFavorite && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (previewActions.favorited) return;
                    void previewActions.onSaveAndFavorite?.();
                  }}
                  hitSlop={10}
                  disabled={
                    previewActions.favorited || previewActions.working != null
                  }
                  style={({ pressed }) => [
                    styles.actionBadge,
                    pressed && { opacity: 0.6 },
                  ]}
                  accessibilityLabel={
                    previewActions.favorited
                      ? 'Saved and favorited'
                      : 'Save and favorite'
                  }
                >
                  {previewActions.working === 'favorite' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <SymbolIcon
                      name={previewActions.favorited ? 'heart.fill' : 'heart'}
                      size={26}
                      tintColor={
                        previewActions.favorited ? colors.brand : '#FFFFFF'
                      }
                    />
                  )}
                </Pressable>
              )}
            </View>
          )}
          {/* Top-right action cluster: Remix sparkle + Favorite heart.
              Both stop propagation so taps don't trigger the outer card.
              Hidden in `preview` mode — unsaved ParsedRecipes have no id
              to favorite or remix-against. */}
          {!preview && (
            <View style={styles.actionCluster}>
              {onCookNow && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onCookNow(recipe);
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.actionBadge,
                    pressed && { opacity: 0.6 },
                  ]}
                  accessibilityLabel="Cook this recipe now"
                >
                  <SymbolIcon name="flame.fill" size={26} tintColor="#FFE4B5" />
                </Pressable>
              )}
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
                <SymbolIcon name="sparkles" size={26} tintColor="#FFE4B5" />
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
                  size={26}
                  tintColor={recipe.is_favorite ? colors.destructive : '#FFFFFF'}
                />
              </Pressable>
            </View>
          )}
        </View>

        {/* Text content */}
        <View className={c.body}>
          <Text className={c.title} numberOfLines={2}>
            {recipe.title}
          </Text>

          {recipe.description ? (
            <Text
              className={`${c.description} mt-1`}
              numberOfLines={2}
            >
              {recipe.description}
            </Text>
          ) : null}

          <View className={c.metaRow}>
            {totalTime > 0 && (
              <View className="flex-row items-center mr-3">
                <SymbolIcon name="clock" size={13} tintColor={colors.textSecondary} />
                <Text className={`ml-1 ${c.metaText}`}>{totalTime} min</Text>
              </View>
            )}
            {!hideServings && recipe.servings != null && (
              <View className="flex-row items-center mr-3">
                <SymbolIcon name="person.2" size={13} tintColor={colors.textSecondary} />
                <Text className={`ml-1 ${c.metaText}`}>{recipe.servings} servings</Text>
              </View>
            )}
            {(recipe.calories_per_serving != null ||
              recipe.protein_grams_per_serving != null) && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(217,119,6,0.15)',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  gap: 3,
                  marginRight: 6,
                }}
              >
                <SymbolIcon name="bolt.fill" size={11} tintColor={colors.warning} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.warning,
                  }}
                >
                  {recipe.calories_per_serving != null
                    ? `${Math.round(recipe.calories_per_serving)} kcal`
                    : ''}
                  {recipe.calories_per_serving != null &&
                  recipe.protein_grams_per_serving != null
                    ? ' · '
                    : ''}
                  {recipe.protein_grams_per_serving != null
                    ? `${Math.round(recipe.protein_grams_per_serving)}g`
                    : ''}
                </Text>
              </View>
            )}
            {pantryMatchCount != null && pantryMatchCount > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#D1FAE5',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  gap: 3,
                }}
              >
                <SymbolIcon
                  name="checkmark.circle.fill"
                  size={11}
                  tintColor="#047857"
                />
                <Text
                  style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}
                >
                  {pantryMatchCount}{' '}
                  {pantryMatchCount === 1 ? 'item' : 'items'} from pantry
                </Text>
              </View>
            )}
          </View>
          {recipe.labels && recipe.labels.length > 0 && (
            <View className="flex-row flex-wrap mt-2 gap-1">
              {recipe.labels.slice(0, 3).map((label) => (
                <View
                  key={label}
                  className="px-2 py-0.5 rounded-pill bg-warning/15"
                >
                  <Text className="text-caption font-semibold" style={{ color: '#C05A00' }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>

      {!preview && (
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
      )}
    </>
  );
}

/**
 * Memoized so a parent re-render (e.g. kitchen.tsx search/filter state) doesn't
 * re-render every mounted card. The comparator returns true (skip render) when
 * none of the render-affecting fields changed. Decision 4 / Image P2 — pairs
 * with the useCallback renderItem + FlatList windowing in kitchen.tsx.
 */
export const RecipeCard = React.memo(
  RecipeCardBase,
  (prev, next) =>
    // recipeStore.updateRecipe replaces the row object ({ ...r, ...patch }) for
    // ANY field edit, so we compare every render-affecting field — not just
    // id/image/favorite. Missing fields here caused stale cards after a
    // title/description/labels/servings/nutrition edit (HI-01). `labels`
    // compares by reference, which is correct because the store always replaces
    // the row object (and the labels array) on update, so the win from 27-02
    // (stable renderItem + windowing) is preserved: an unchanged row object
    // still skips the render.
    prev.recipe.id === next.recipe.id &&
    prev.recipe.image_url === next.recipe.image_url &&
    prev.recipe.is_favorite === next.recipe.is_favorite &&
    prev.recipe.title === next.recipe.title &&
    prev.recipe.description === next.recipe.description &&
    prev.recipe.servings === next.recipe.servings &&
    prev.recipe.total_time_minutes === next.recipe.total_time_minutes &&
    prev.recipe.prep_time_minutes === next.recipe.prep_time_minutes &&
    prev.recipe.cook_time_minutes === next.recipe.cook_time_minutes &&
    prev.recipe.calories_per_serving === next.recipe.calories_per_serving &&
    prev.recipe.protein_grams_per_serving ===
      next.recipe.protein_grams_per_serving &&
    prev.recipe.labels === next.recipe.labels &&
    prev.mode === next.mode &&
    prev.pantryMatchCount === next.pantryMatchCount,
);

export type { RecipeCardMode };

// Non-tokenizable positioning styles (absolute overlay clusters) — colors use
// rgba over imagery, not brand tokens. Text sizes use the type scale via
// NativeWind classes on the actionable text; these are decorative badges.
const styles = StyleSheet.create({
  // Single-capsule overlay — same chrome HeroDayCard.heroIconCluster uses.
  // Wraps all action icons in one rounded translucent pill (rgba 0.20)
  // so the action chrome reads as one unit instead of 2-3 separate
  // dark circles. Matches Plan / Something New / Recipe Box / Remix.
  actionCluster: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  // Bare icon button — no individual circle bg now that the parent
  // cluster owns the chrome. 36pt min touch target preserved.
  actionBadge: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
