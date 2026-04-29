/**
 * WeekHealthChip — at-a-glance vibe label for the current week's plan.
 * Slots into the planActionsRow next to the cart + ellipsis icons.
 *
 * Tap to open a tooltip-style popover (TODO: future iteration). Today
 * the chip is read-only and the tooltip surfaces would just clutter.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { SymbolViewProps } from 'expo-symbols';
import { colors } from '../../design/tokens';
import {
  scoreWeekHealth,
  verdictFor,
  trendVs,
  type ScoredEntry,
  type WeekHealthScore,
} from '../../plan/weekHealthScore';

interface WeekHealthChipProps {
  entries: ScoredEntry[];
  /** Optional prior-week score for trend snippet ("lighter than last week"). */
  priorWeek?: WeekHealthScore | null;
}

export function WeekHealthChip({ entries, priorWeek }: WeekHealthChipProps) {
  const score = scoreWeekHealth(entries);
  const verdict = verdictFor(score);
  if (verdict.kind === 'unknown') return null;
  const trend = trendVs(score, priorWeek ?? null);
  const tone = TONE_STYLES[verdict.tone];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <SymbolIcon
        name={iconFor(verdict.kind)}
        size={14}
        tintColor={tone.fg}
        weight="semibold"
      />
      <Text style={[styles.label, { color: tone.fg }]} numberOfLines={1}>
        {trend ? `${verdict.label} · ${trend}` : verdict.label}
      </Text>
    </View>
  );
}

function iconFor(
  kind: ReturnType<typeof verdictFor>['kind'],
): SymbolViewProps['name'] {
  switch (kind) {
    case 'indulgent':
      return 'flame.fill';
    case 'carb-heavy':
      return 'fork.knife';
    case 'veg-forward':
      return 'leaf.fill';
    case 'light':
      return 'sparkle';
    case 'balanced':
    default:
      return 'checkmark.seal.fill';
  }
}

const TONE_STYLES: Record<string, { bg: string; fg: string }> = {
  success: { bg: '#E7F5EE', fg: colors.success },
  warning: { bg: '#FFF1DE', fg: colors.warning },
  default: { bg: '#F1EAE0', fg: colors.textSecondary },
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
