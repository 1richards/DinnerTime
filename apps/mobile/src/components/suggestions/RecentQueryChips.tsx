/**
 * RecentQueryChips — horizontal ScrollView of tappable query shortcuts
 * (CONTEXT D-05 + D-11).
 *
 * Parent is responsible for gating render on `queries.length > 0` and for
 * replaying the selected query through the store's searchRecipes action
 * with the current pantryOnly preference. This component is pure
 * presentation.
 *
 * D-11 locks the horizontal ScrollView layout (not a wrapping FlexWrap
 * row) to match the iOS chip affordances elsewhere in the app.
 */

import React from 'react';
import { Pressable, ScrollView, Text, StyleSheet } from 'react-native';
import { colors } from '../../design/tokens';

interface RecentQueryChipsProps {
  queries: string[];
  onSelect: (query: string) => void;
}

export function RecentQueryChips({ queries, onSelect }: RecentQueryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      accessibilityLabel="Recent searches"
    >
      {queries.map((q) => (
        <Pressable
          key={q}
          onPress={() => onSelect(q)}
          style={styles.chip}
          accessibilityLabel={`Search again for ${q}`}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {q}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});
