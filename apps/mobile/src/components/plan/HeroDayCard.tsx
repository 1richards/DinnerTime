/**
 * Quick-task 7 — HeroDayCard.
 *
 * Detailed-mode hero treatment for the active day in the Plan tab.
 * Rendered at the day's natural FlatList position (NOT pinned to top) so
 * day-order rhythm stays intact. Composition:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ┌──────────────────────────────────────────┐ │
 *   │ │ [16:9 hero image]                        │ │
 *   │ │                                          │ │
 *   │ │ MON · 4/27                               │ │
 *   │ │ Lemon Pan-Sauce Chicken                  │ │
 *   │ └──────────────────────────────────────────┘ │
 *   │ Medium · 35m · 4 servings                    │
 *   │ [Pan sauces] [Knife skills]                  │
 *   │ Practices fond → reduction → mounted butter. │
 *   └──────────────────────────────────────────────┘
 *
 * Swipe-left reveals the same Swap / Cooked / Clear actions the
 * SwipeableDayRow does — `renderRightActionsFor` is imported directly
 * from SwipeableDayRow so telemetry (`plan.swipe_action` with variant
 * 'swap'|'cook'|'skip') stays byte-identical. No re-emission needed.
 *
 * Tap routing is parent-owned (onPress prop) — same delegation contract
 * as DayRow / SwipeableDayRow. The parent's plan.tsx onPress callback
 * routes to savedDetail (recipe-backed) or previewEntry (ad-hoc) so
 * the modal flow stays consistent across both card kinds.
 *
 * Layout decisions:
 *   - cardWidth = window.width - 32 (matches SwipeableDayRow.tileWrap's
 *     mx-4 = 16pt margins on each side so adjacent rows align).
 *   - Hero height = (cardWidth * 9) / 16 — true 16:9.
 *   - Day label + title rendered as overlay children inside HeroImage so
 *     the bottom-fade gradient frames them naturally.
 *   - Chip row + skill_note live BELOW the hero image (inside the outer
 *     Pressable but outside HeroImage) so they sit on the warmWhite
 *     background and stay legible in either light/dark eyeball modes.
 *   - useGeneratedRecipeImage is called UNCONDITIONALLY (Rules of Hooks).
 *     We pass `skip: !!savedRecipe?.image_url` so it's a no-op when the
 *     saved recipe already has an image.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { HeroImage } from '../ui/HeroImage';
import { Chip } from '../ui/Chip';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useRecipeStore } from '../../stores/recipeStore';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { deriveStatusChips, type DayRowStatus } from './dayRowHelpers';
import { renderRightActionsFor } from './SwipeableDayRow';
import type { MealPlanEntry } from '../../types/mealPlan';
import type { SymbolViewProps } from 'expo-symbols';

export interface HeroDayCardProps {
  /** Hero never receives null — caller branches to SwipeableDayRow's empty
      placeholder for unplanned days. */
  entry: MealPlanEntry;
  dayLabel: string; // 'MON'
  dateLabel?: string; // '4/27'
  focusTheme?: string | null;
  onPress: () => void;
  onSwap: () => void;
  onCook: () => void;
  onSkip: () => void;
}

/**
 * Outer (stateless) HeroDayCard. Owns NO React hooks so vitest-node tests
 * can call it as a plain function. The image-loading hook (which requires
 * a real React renderer) lives in HeroDayCardImage so it only runs at
 * runtime in the production app.
 *
 * This mirrors the IngredientChecklist + dayRowHelpers split — the outer
 * surface is verifiable under node, the inner hook-bearing branch is
 * exercised on the device.
 */
export function HeroDayCard({
  entry,
  dayLabel,
  dateLabel,
  focusTheme,
  onPress,
  onSwap,
  onCook,
  onSkip,
}: HeroDayCardProps): React.ReactElement {
  // 16:9 aspect from current window width (minus the 16pt horizontal
  // margin on each side).
  const cardWidth = Dimensions.get('window').width - 32;
  const heroHeight = Math.round((cardWidth * 9) / 16);

  const status: DayRowStatus =
    entry.status === 'cooked'
      ? 'cooked'
      : entry.status === 'skipped'
        ? 'skipped'
        : 'planned';

  const chips = deriveStatusChips({
    status,
    isStretch: entry.is_stretch === true,
    pantryReady: entry.pantry_ready === true,
    entry: {
      title: entry.title,
      description: entry.description ?? null,
      ingredients: (entry.ingredients ?? []).map((i) => ({ name: i.name })),
    },
    difficulty: entry.difficulty ?? null,
    practicedSkills: entry.practiced_skills ?? null,
    focusTheme: focusTheme ?? null,
  });

  // Compute the difficulty/time/servings sub-strip: "Medium · 35m · 4 servings"
  const metaParts: string[] = [];
  if (entry.difficulty) {
    metaParts.push(
      entry.difficulty[0]!.toUpperCase() + entry.difficulty.slice(1),
    );
  }
  const totalMinutes =
    entry.estimated_time_minutes ??
    ((entry.prep_time_minutes ?? 0) + (entry.cook_time_minutes ?? 0) || null);
  if (totalMinutes != null) metaParts.push(`${totalMinutes}m`);
  if (entry.servings != null) {
    metaParts.push(`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'}`);
  }

  const isCooked = entry.status === 'cooked';

  return (
    <View style={styles.tileWrap}>
      <ReanimatedSwipeable
        renderRightActions={() =>
          renderRightActionsFor({ entry, onSwap, onCook, onSkip })
        }
        rightThreshold={80}
        overshootRight={false}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
            isCooked && styles.cardCooked,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel} hero meal: ${entry.title}`}
        >
          {/* Hero image lives in an inner component (owns the recipe-store
              selector + Gemini fetch hook). Day label + title render as
              overlay siblings inside the outer tree so vitest-node tests
              can see them without invoking the hook-bearing inner. */}
          <View style={styles.heroFrame}>
            <HeroDayCardImage entry={entry} heroHeight={heroHeight} />
            <View style={[styles.heroOverlayContent, { bottom: 16 }]}>
              {/* Date stack — day name as kicker, date as the prominent
                  line. Mirrors the Apple Calendar / Things-style
                  big-date-on-top pattern so the user can scan day-by-day
                  without hunting for the date in a thin meta strip. */}
              <Text style={styles.dayLabel}>{dayLabel.toUpperCase()}</Text>
              {dateLabel ? (
                <Text style={styles.dateLabel}>{dateLabel}</Text>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {entry.title}
              </Text>
            </View>
          </View>

          {/* Meta strip (difficulty · time · servings) */}
          {metaParts.length > 0 && (
            <View style={styles.metaRow}>
              <SymbolIcon
                name={'fork.knife' as SymbolViewProps['name']}
                size={13}
                tintColor={colors.textSecondary}
              />
              <Text style={styles.metaText}>{metaParts.join(' · ')}</Text>
            </View>
          )}

          {/* Chip row — ALL chips from deriveStatusChips (status / stretch /
              pantry / difficulty / ALL practiced_skills / health). */}
          {chips.length > 0 && (
            <View style={styles.chipRow}>
              {chips.map((c) => (
                <View key={c.label} style={styles.chipWrap}>
                  <Chip
                    kind="display"
                    tone={c.tone}
                    label={c.label}
                    leadingIcon={
                      c.leadingIcon as SymbolViewProps['name'] | undefined
                    }
                  />
                </View>
              ))}
            </View>
          )}

          {entry.skill_note ? (
            <Text style={styles.skillNote}>{entry.skill_note}</Text>
          ) : null}
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

/**
 * Inner image-loading sub-component. Owns the recipeStore selector +
 * Gemini image-fetch hook. Splitting these into an inner component keeps
 * the outer HeroDayCard hook-free so vitest-node tests can call it as a
 * plain function (RN's react-native module is mocked at vitest setup
 * time, so HeroImage / Image rendering is a no-op under tests).
 */
interface HeroDayCardImageProps {
  entry: MealPlanEntry;
  heroHeight: number;
}

function HeroDayCardImage({
  entry,
  heroHeight,
}: HeroDayCardImageProps): React.ReactElement {
  const savedRecipe = useRecipeStore((s) =>
    entry.recipe_id ? s.recipes.find((r) => r.id === entry.recipe_id) : null,
  );

  const normalizedIngredients = useMemo(() => {
    const src = savedRecipe?.ingredients ?? entry.ingredients ?? null;
    if (!src || src.length === 0) return null;
    return src.map((i) => {
      if (typeof i === 'string') {
        return { name: i, quantity: null, unit: null, notes: null };
      }
      const obj = i as {
        name: string;
        quantity?: number | null;
        unit?: string | null;
        notes?: string | null;
      };
      return {
        name: obj.name,
        quantity: obj.quantity ?? null,
        unit: obj.unit ?? null,
        notes: obj.notes ?? null,
      };
    });
  }, [savedRecipe, entry]);

  const { url: generatedUri } = useGeneratedRecipeImage(entry.title, {
    skip: !!savedRecipe?.image_url,
    description: savedRecipe?.description ?? entry.description ?? null,
    ingredients: normalizedIngredients,
  });

  const heroUri = savedRecipe?.image_url ?? generatedUri ?? null;

  return <HeroImage uri={heroUri} height={heroHeight} borderRadius={14} />;
}

const styles = StyleSheet.create({
  // Match SwipeableDayRow.tileWrap so adjacent rows align horizontally.
  tileWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardCooked: {
    opacity: 0.65,
  },
  heroFrame: {
    position: 'relative',
  },
  heroOverlayContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'column',
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
  },
  dateLabel: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  chipWrap: {
    marginRight: 6,
    marginTop: 4,
  },
  skillNote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
    paddingHorizontal: 14,
    paddingTop: 10,
    lineHeight: 18,
  },
});
