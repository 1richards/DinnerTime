/**
 * Phase 22 Wave 0 — shared native date picker sheet.
 *
 * A Modal wrapper around @react-native-community/DateTimePicker's inline
 * calendar (iOS 14+ default UI — matches Apple Calendar). Consumed by:
 *   - plan 22-01: AddToPlanSheet (Recipe Detail → "Add to Plan")
 *   - plan 22-01: SuggestionCard's "Pin to day" action (Something New)
 *   - plan 22-03: month → day drill-down "move to" flow
 *
 * Design per 22-RESEARCH.md Pattern 1:
 *   - display="inline" for iOS 14+ calendar grid (not spinner).
 *   - minimumDate defaults to today (UTC midnight) — prevents back-dating.
 *   - maximumDate defaults to today+60d — the roadmap cap; aligns with the
 *     server-side 70-day range ceiling (GET /meal-plans from/to).
 *   - Value MUST be initialized to a Date before mount (Pitfall 2: blank
 *     modal renders if value is undefined). We guarantee this via the
 *     useState initializer.
 *
 * Design per 22-CONTEXT D-30 ("native iOS date picker"):
 *   - No custom calendar grid — uses DateTimePicker for accessibility,
 *     localization, dark mode, and iOS feel out of the box.
 *
 * Parent-owned state: `visible` + `onConfirm(isoDate)` + `onDismiss()`.
 * The sheet does not write to any store or call any API — those are
 * downstream-plan concerns.
 *
 * The CTAs are Pressable + Text (not <Button/>) for parity with the
 * Wave 0 HandoffSheet static-tree test pattern used by Phase 20.
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SymbolIcon } from '../ui/SymbolIcon';
import { variantStyles } from '../ui/buttonStyles';
import { colors } from '../../design/tokens';

/**
 * Return today at UTC midnight (a stable "today" that ignores the local
 * time-of-day). Used as the default minimumDate so back-dating is prevented
 * regardless of when the user opens the sheet.
 */
export function todayUtcMidnight(): Date {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
}

/** Add `days` to `d` in UTC. Pure — does not mutate input. */
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Slice a Date to its YYYY-MM-DD string (UTC). */
export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DatePickerSheetProps {
  visible: boolean;
  initialDate?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (isoDate: string) => void;
  onDismiss: () => void;
  title?: string;
  confirmLabel?: string;
}

export function DatePickerSheet({
  visible,
  initialDate,
  minimumDate,
  maximumDate,
  onConfirm,
  onDismiss,
  title = 'Pick a day',
  confirmLabel = 'Add',
}: DatePickerSheetProps) {
  const [selected, setSelected] = useState<Date>(
    initialDate ?? todayUtcMidnight(),
  );

  // Reset the selection when the sheet re-opens with a different initialDate.
  useEffect(() => {
    if (visible) {
      setSelected(initialDate ?? todayUtcMidnight());
    }
  }, [visible, initialDate]);

  const resolvedMin = minimumDate ?? todayUtcMidnight();
  const resolvedMax = maximumDate ?? addDays(todayUtcMidnight(), 60);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <SymbolIcon
              name="xmark"
              size={22}
              tintColor={colors.textPrimary}
            />
          </Pressable>
        </View>
        <View style={styles.body}>
          <DateTimePicker
            value={selected}
            mode="date"
            display="inline"
            minimumDate={resolvedMin}
            maximumDate={resolvedMax}
            onChange={(_, d) => {
              if (d) setSelected(d);
            }}
          />
        </View>
        <View style={styles.footer}>
          <Pressable
            onPress={() => onConfirm(toIso(selected))}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            className={variantStyles.primary.container}
          >
            <Text className={variantStyles.primary.text}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#FFFBF5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAE0',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, padding: 16 },
  footer: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F1EAE0',
  },
});
