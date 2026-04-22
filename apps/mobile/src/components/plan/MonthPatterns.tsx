/**
 * Phase 22-03 — MonthPatterns.
 *
 * Renders three aggregate sections derived from a 5-week window of entries:
 *   1. Protein distribution — horizontal bars per bucket (chicken/beef/fish/
 *      pork/veg/other), sized proportionally to the max count.
 *   2. Cuisine distribution — list of labeled chips with count badges.
 *   3. Repeats — list of titles appearing ≥2 times in the window.
 *
 * All three come from pure helpers in monthHelpers.ts — this component is
 * a thin renderer. Empty state: a single muted Text telling the user to
 * cook meals to see patterns.
 *
 * No chart library: bars are plain Views with computed width percentages.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  aggregateProtein,
  aggregateCuisine,
  findRepeats,
  type ProteinBucket,
  type CuisineBucket,
  type RepeatMeal,
} from './monthHelpers';
import { colors } from '../../design/tokens';
import type { MealPlanEntry } from '../../types/mealPlan';

export interface MonthPatternsProps {
  entries: MealPlanEntry[];
}

function maxCount<T extends { count: number }>(arr: T[]): number {
  return arr.reduce((m, x) => (x.count > m ? x.count : m), 0);
}

function renderProteinSection(buckets: ProteinBucket[]): React.ReactNode {
  if (!buckets.length) {
    return (
      <View style={styles.section} key="protein">
        <Text style={styles.sectionTitle}>Protein</Text>
        <Text style={styles.emptyText}>
          No data yet — cook meals to see your patterns.
        </Text>
      </View>
    );
  }
  const max = maxCount(buckets) || 1;
  return (
    <View
      style={styles.section}
      accessibilityLabel="Protein distribution"
      key="protein"
    >
      <Text style={styles.sectionTitle}>Protein</Text>
      {buckets.map((b) => (
        <View key={`protein-${b.key}`} style={styles.barRow}>
          <Text style={styles.barLabel}>{b.key}</Text>
          <View style={styles.barTrack}>
            <View
              style={[styles.barFill, { width: `${(b.count / max) * 100}%` }]}
            />
          </View>
          <Text style={styles.barCount}>{b.count}</Text>
        </View>
      ))}
    </View>
  );
}

function renderCuisineSection(buckets: CuisineBucket[]): React.ReactNode {
  if (!buckets.length) {
    return (
      <View style={styles.section} key="cuisine">
        <Text style={styles.sectionTitle}>Cuisine</Text>
        <Text style={styles.emptyText}>
          No data yet — cook meals to see your patterns.
        </Text>
      </View>
    );
  }
  return (
    <View
      style={styles.section}
      accessibilityLabel="Cuisine distribution"
      key="cuisine"
    >
      <Text style={styles.sectionTitle}>Cuisine</Text>
      <View style={styles.chipRow}>
        {buckets.map((b) => (
          <View key={`cuisine-${b.key}`} style={styles.chip}>
            <Text style={styles.chipText}>
              {b.key} · {b.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderRepeatsSection(repeats: RepeatMeal[]): React.ReactNode {
  if (!repeats.length) {
    return (
      <View style={styles.section} key="repeats">
        <Text style={styles.sectionTitle}>Repeats</Text>
        <Text style={styles.emptyText}>
          No data yet — cook meals to see your patterns.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.section} accessibilityLabel="Repeat meals" key="repeats">
      <Text style={styles.sectionTitle}>Repeats</Text>
      <View style={styles.chipRow}>
        {repeats.map((r) => (
          <View key={`repeat-${r.title}`} style={styles.chip}>
            <Text style={styles.chipText}>
              {r.title} · ×{r.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MonthPatterns({ entries }: MonthPatternsProps) {
  const proteinBuckets = aggregateProtein(entries);
  const cuisineBuckets = aggregateCuisine(entries);
  const repeats = findRepeats(entries);

  return (
    <View style={styles.wrapper}>
      {renderProteinSection(proteinBuckets)}
      {renderCuisineSection(cuisineBuckets)}
      {renderRepeatsSection(repeats)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 70,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: 5,
  },
  barCount: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
    marginLeft: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
