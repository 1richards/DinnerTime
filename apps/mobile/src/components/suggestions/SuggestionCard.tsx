import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { DinnerSuggestion } from '../../types/suggestions';
import { FOOD_IMAGES } from '../../constants/foodImages';

interface SuggestionCardProps {
  suggestion: DinnerSuggestion;
  onPress?: (s: DinnerSuggestion) => void;
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
 */
export function SuggestionCard({ suggestion, onPress }: SuggestionCardProps) {
  const heroUri =
    FOOD_IMAGES.hero[
      (suggestion.title.length + (suggestion.cuisine_type?.length ?? 0)) %
        FOOD_IMAGES.hero.length
    ];

  const pantryCount = suggestion.ingredients_used.length;

  return (
    <Pressable
      onPress={() => onPress?.(suggestion)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Food photo hero */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: heroUri }}
          style={StyleSheet.absoluteFillObject}
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
            <Text style={styles.kidBadgeEmoji}>👶</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {suggestion.title}
        </Text>

        <Text style={styles.description} numberOfLines={2}>
          {suggestion.description}
        </Text>

        {/* Meta row — time + pantry grounding */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color="#7A6651" />
            <Text style={styles.metaText}>
              {suggestion.estimated_time_minutes} min
            </Text>
          </View>
          {pantryCount > 0 && (
            <View style={[styles.metaItem, styles.metaPantry]}>
              <Ionicons name="checkmark-circle" size={13} color="#047857" />
              <Text style={styles.metaPantryText}>
                {pantryCount} {pantryCount === 1 ? 'item' : 'items'} from pantry
              </Text>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidBadgeEmoji: {
    fontSize: 16,
  },
  body: {
    padding: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 4,
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
});
