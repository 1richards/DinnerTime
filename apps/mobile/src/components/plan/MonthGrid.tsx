/**
 * Phase 22-03 — MonthGrid.
 *
 * 5×7 cell Pressable grid rendering the Month view. Each cell shows:
 *   - day-of-month number (top)
 *   - a single status-dot indicator (bottom)
 *
 * Interactions:
 *   - Tap cell with entry → onEntryPress(entry) — parent opens the shared
 *     PreviewSheet modal (same one Week-view DayRow uses), so the user can
 *     dismiss back to the calendar instead of being stuck on a drill-down.
 *   - Tap cell without entry → onPinCell(iso) — parent opens DatePickerSheet.
 *   - Long-press cell → ActionSheetIOS with 'Mark travel day' / 'Mark dinner
 *     party' / 'Cancel'. On select, onMarkSkipped(iso, reason) is invoked
 *     so the parent can POST /meal-plans/entries/assign.
 *
 * Token-driven status colors (Phase 19 tokens):
 *   - cooked → colors.success
 *   - planned → colors.brand
 *   - skipped → colors.warning
 *   - empty → colors.textTertiary (small muted dot)
 *
 * Loading state: when `loading=true`, render the 35-cell grid as a skeleton
 * (day numbers + muted dots, no Press handlers). Keeps layout identical so
 * the grid doesn't jump when data arrives.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActionSheetIOS } from 'react-native';
import { buildMonthGrid, type MonthCell, type CellStatus } from './monthHelpers';
import { colors } from '../../design/tokens';
import type { MealPlanEntry } from '../../types/mealPlan';

export interface MonthGridProps {
  fromWeekStart: string;
  entriesByIso: Map<string, MealPlanEntry>;
  loading?: boolean;
  /** Parent-supplied handler when a cell with an entry is tapped (opens
      the shared PreviewSheet modal). */
  onEntryPress?: (entry: MealPlanEntry) => void;
  /** Parent-supplied handler when an empty cell is tapped (opens DatePickerSheet). */
  onPinCell?: (iso: string) => void;
  /** Parent-supplied handler for long-press → mark as skipped with reason. */
  onMarkSkipped?: (iso: string, reason: 'travel' | 'dinner party') => void;
}

const DAY_HEADER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function dotColorForStatus(status: CellStatus): string {
  switch (status) {
    case 'cooked':
      return colors.success;
    case 'planned':
      return colors.brand;
    case 'skipped':
      return colors.warning;
    default:
      return colors.textTertiary;
  }
}

export function MonthGrid({
  fromWeekStart,
  entriesByIso,
  loading = false,
  onEntryPress,
  onPinCell,
  onMarkSkipped,
}: MonthGridProps) {
  const cells: MonthCell[] = buildMonthGrid(fromWeekStart, entriesByIso);

  const handlePress = (cell: MonthCell): void => {
    if (cell.entry) {
      onEntryPress?.(cell.entry);
      return;
    }
    onPinCell?.(cell.iso);
  };

  const handleLongPress = (cell: MonthCell): void => {
    // ActionSheetIOS with two mark-skipped reasons + Cancel. This is an
    // entry point parallel to swipe-to-skip on DayRow (shipped in 22-06).
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Mark as travel day', 'Mark as dinner party', 'Cancel'],
        cancelButtonIndex: 2,
        title: 'Mark this day',
      },
      (idx) => {
        if (idx === 0) onMarkSkipped?.(cell.iso, 'travel');
        else if (idx === 1) onMarkSkipped?.(cell.iso, 'dinner party');
      }
    );
  };

  return (
    <View style={styles.wrapper} accessibilityLabel="Month grid">
      <View style={styles.headerRow}>
        {DAY_HEADER.map((label, idx) => (
          <View key={`hdr-${idx}`} style={styles.headerCell}>
            <Text style={styles.headerLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell) => {
          const dotColor = dotColorForStatus(cell.status);
          const isEmpty = cell.status === 'empty';
          const content = (
            <View style={styles.cellInner}>
              <Text
                style={[
                  styles.dayNum,
                  isEmpty && styles.dayNumEmpty,
                ]}
              >
                {cell.dayOfMonth}
              </Text>
              <View
                style={[
                  styles.dot,
                  isEmpty && styles.dotEmpty,
                  { backgroundColor: dotColor },
                ]}
              />
            </View>
          );

          if (loading) {
            // Skeleton: non-pressable with muted colors. Render a bare View
            // so children match the non-loading shape for layout parity.
            return (
              <View key={cell.iso} style={styles.cell}>
                {content}
              </View>
            );
          }

          return (
            <Pressable
              key={cell.iso}
              style={styles.cell}
              onPress={() => handlePress(cell)}
              onLongPress={() => handleLongPress(cell)}
              accessibilityLabel={`${cell.iso} ${cell.status}`}
              accessibilityRole="button"
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 6,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
  },
  cellInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    alignSelf: 'flex-start',
  },
  dayNumEmpty: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotEmpty: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
