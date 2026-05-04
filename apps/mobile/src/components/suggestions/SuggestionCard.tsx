import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { DinnerSuggestion } from '../../types/suggestions';
import { FOOD_IMAGES, getRecipeImage } from '../../constants/foodImages';
import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
import { supabase } from '../../lib/supabase';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { colors } from '../../design/tokens';
import { DatePickerSheet } from '../plan/DatePickerSheet';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';

interface SuggestionCardProps {
  suggestion: DinnerSuggestion;
  onPress?: (s: DinnerSuggestion) => void;
}

const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not authenticated');
  return data.session.access_token;
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Module-level helper: pin a Something New suggestion to a specific date as
 * an ad-hoc meal plan entry (recipe_id: null per 22-RESEARCH Pitfall 7).
 *
 * Mirrors SuggestionPreviewModal.handleAddToPlan's POST shape, but adds
 * `date: isoDate` (server 22-00) and `recipe_id: null` (ad-hoc).
 */
async function pinSuggestionToDay(
  suggestion: DinnerSuggestion,
  iso: string,
  sessionId: string,
): Promise<void> {
  try {
    const token = await getAuthToken();
    const body = {
      date: iso,
      title: suggestion.title,
      description: suggestion.description,
      ingredients: [
        ...(suggestion.ingredients_used ?? []).map((name) => ({ name })),
        ...(suggestion.ingredients_needed ?? []).map((name) => ({ name })),
      ],
      estimated_time_minutes: suggestion.estimated_time_minutes,
      difficulty: suggestion.difficulty,
      kid_friendly: suggestion.kid_friendly,
      why_suggested: suggestion.why_suggested,
      recipe_id: null, // ad-hoc: 22-RESEARCH Pitfall 7
    };
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/meal-plans/entries/assign`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      Alert.alert('Could not pin suggestion', err.error ?? 'Please try again.');
      return;
    }
    const resBody = await res.json().catch(() => ({}));
    const mealPlanId: string | null = resBody?.data?.meal_plan_id ?? null;
    logPlanEvent({
      name: 'plan.suggestion_pin_succeeded',
      session_id: sessionId,
      meal_plan_id: mealPlanId,
      payload: sanitizePayload({
        date: iso,
        meal_plan_id: mealPlanId,
      }),
    });
    useMealPlanStore
      .getState()
      .fetchCurrent()
      .catch(() => {});
    Alert.alert('Pinned', `Added to ${formatIsoDate(iso)}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Alert.alert('Could not pin suggestion', message);
  }
}

/**
 * Home "tonight's suggestions" card.
 *
 * Visually mirrors the Discover recipe card — food photography hero,
 * title, and tight meta row — so the two surfaces feel like siblings.
 * The rich metadata (pantry breakdown, "why we picked this") moves into
 * the preview modal where it belongs. The card itself stays glanceable.
 *
 * Semantic distinction is preserved in the subtitle at the bottom:
 * "From your pantry" tag reminds the user this is pantry-grounded and
 * not just a generic suggestion.
 *
 * Phase 22 (22-01 / PLAN-X-04): adds an in-card "Pin to day" action via a
 * calendar.badge.plus icon. Tapping it opens DatePickerSheet (separate from
 * the card onPress that still routes to the preview modal).
 */
export function SuggestionCard({ suggestion, onPress }: SuggestionCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sessionId] = useState<string>(() =>
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `sc-${Date.now()}`,
  );

  // Async Gemini nano-banana hero, cached server-side by title hash +
  // ingredient fingerprint. Forwarding description + ingredients_used gives
  // Gemini the context to render the specific dish instead of generic food.
  // No keyword-stock fallback anymore — getRecipeImage returns null when
  // Gemini hasn't resolved, and the Image renders a beige skeleton.
  const { url: generatedUri } = useGeneratedRecipeImage(suggestion.title, {
    description: suggestion.description,
    ingredients: (suggestion.ingredients_used ?? []).map((name) => ({
      name,
      quantity: null,
      unit: null,
      notes: null,
    })),
  });
  const heroUri = generatedUri;
  // Suppress unused-warning on FOOD_IMAGES if it's no longer referenced.
  void FOOD_IMAGES;

  const pantryCount = suggestion.ingredients_used.length;

  return (
    <>
      <Pressable
        onPress={() => onPress?.(suggestion)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* Food photo hero */}
        <View style={styles.imageContainer}>
          <Image
            source={heroUri ? { uri: heroUri } : null}
            style={[
              StyleSheet.absoluteFillObject,
              !heroUri && { backgroundColor: '#F1EAE0' },
            ]}
            contentFit="cover"
            transition={300}
            placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            cachePolicy="memory-disk"
          />
          <View style={styles.imageOverlay} />

          {/* Cuisine badge, top-left */}
          {suggestion.cuisine_type && (
            <View style={styles.cuisineBadge}>
              <Text style={styles.cuisineBadgeText}>
                {suggestion.cuisine_type}
              </Text>
            </View>
          )}

          {/* Kid-friendly indicator, top-right */}
          {suggestion.kid_friendly && (
            <View style={styles.kidBadge}>
              <Text style={styles.kidBadgeText}>Kid-friendly</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.bodyHeaderRow}>
            <Text style={styles.title} numberOfLines={2}>
              {suggestion.title}
            </Text>
            {/* Pin-to-day action — stopPropagation so we don't also open
                the preview modal (card onPress). */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setPickerOpen(true);
              }}
              hitSlop={8}
              style={styles.pinBtn}
              accessibilityLabel="Pin to day"
            >
              <SymbolIcon
                name="calendar.badge.plus"
                size={20}
                tintColor={colors.brand}
              />
            </Pressable>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {suggestion.description}
          </Text>

          {/* Meta row — time + pantry grounding + nutrition */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <SymbolIcon name="clock" size={13} tintColor="#7A6651" />
              <Text style={styles.metaText}>
                {suggestion.estimated_time_minutes} min
              </Text>
            </View>
            {(suggestion.calories_per_serving != null ||
              suggestion.protein_grams_per_serving != null) && (
              <View style={[styles.metaItem, styles.metaNutrition]}>
                <SymbolIcon name="bolt.fill" size={11} tintColor={colors.warning} />
                <Text style={styles.metaNutritionText}>
                  {suggestion.calories_per_serving != null
                    ? `${Math.round(suggestion.calories_per_serving)} kcal`
                    : ''}
                  {suggestion.calories_per_serving != null &&
                  suggestion.protein_grams_per_serving != null
                    ? ' · '
                    : ''}
                  {suggestion.protein_grams_per_serving != null
                    ? `${Math.round(suggestion.protein_grams_per_serving)}g`
                    : ''}
                </Text>
              </View>
            )}
            {pantryCount > 0 && (
              <View style={[styles.metaItem, styles.metaPantry]}>
                <SymbolIcon name="checkmark.circle.fill" size={13} tintColor="#047857" />
                <Text style={styles.metaPantryText}>
                  {pantryCount} {pantryCount === 1 ? 'item' : 'items'} from pantry
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      <DatePickerSheet
        visible={pickerOpen}
        title={`Pin "${suggestion.title}" to…`}
        confirmLabel="Pin"
        onConfirm={(iso) => {
          setPickerOpen(false);
          void pinSuggestionToDay(suggestion, iso, sessionId);
        }}
        onDismiss={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
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
  cuisineBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  cuisineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  kidBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  body: {
    padding: 14,
  },
  bodyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 4,
  },
  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: '#7A6651',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  metaPantry: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  metaPantryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  // Per-serving nutrition pill (kcal · protein). Same warm-warning tone as
  // the other recipe-surface nutrition pills.
  metaNutrition: {
    backgroundColor: 'rgba(217,119,6,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  metaNutritionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
});
