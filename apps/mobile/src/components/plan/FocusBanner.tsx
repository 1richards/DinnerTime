/**
 * Phase 22-05: Weekly Skill Focus banner.
 *
 * Lives at the top of the Week list in apps/mobile/src/app/(tabs)/plan.tsx.
 * Mounted only when `settingsStore.planFocusBannerEnabled === true`. Null
 * when there is no currentPlan (no week generated yet → nothing to theme).
 *
 * Interaction contract:
 *   - When `currentPlan.focus_theme` is a non-empty string, the banner
 *     shows `This week: <theme>` with a "Change" action.
 *   - When `focus_theme` is null/undefined/empty, the banner shows the
 *     CTA copy ("Set a weekly focus to uplevel this week's meals") with a
 *     "Set focus" action.
 *   - Tapping the action opens an `Alert.prompt` pre-filled with the
 *     current theme (empty string when unset). On submit we call
 *     `mealPlanStore.setFocusTheme(trimmed || null)` which PATCHes
 *     /meal-plans/{id}. Telemetry fires `plan.focus_theme_set` when a
 *     non-empty value is committed.
 *
 * Note on `Alert.prompt`: iOS-only. On Android the prompt is a no-op and
 * the banner degrades to a read-only display. DinnerTime is iOS-first
 * (CLAUDE.md), so this is fine; when we expand to Android we'd swap in a
 * custom modal wrapping TextInput.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';
import { FocusPickerSheet } from './FocusPickerSheet';

interface FocusBannerProps {
  /** Optional second row rendered inside the same warm-tinted card,
      below the focus row. Used by plan.tsx to consolidate the weekly
      health chip + shopping-cart action into the same "this week"
      section so the user reads them as one unit. */
  children?: React.ReactNode;
}

export function FocusBanner({ children }: FocusBannerProps = {}) {
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const setFocusTheme = useMealPlanStore((s) => s.setFocusTheme);
  const planLoading = useMealPlanStore((s) => s.loading);
  const [pickerVisible, setPickerVisible] = useState(false);
  // Local progress flag — covers the PATCH window between the user
  // tapping a focus card and the regenerate Alert appearing. The plan
  // store's `loading` only flips during regenerate itself, so we add
  // this so the banner shows "Saving focus…" through the full lifecycle.
  const [savingFocus, setSavingFocus] = useState(false);

  if (!currentPlan) return null;

  const theme = currentPlan.focus_theme ?? null;
  const planId = currentPlan.id;
  const weekStart = currentPlan.week_start;

  // Picker flow:
  //   1. User taps a card → FocusPickerSheet shows an optimistic checkmark.
  //   2. PATCH lands (await setFocusTheme); on success we present the
  //      Regenerate Alert ON TOP OF the still-visible picker sheet.
  //   3. Whichever Alert button the user taps closes the picker. iOS stacks
  //      the Alert above the modal correctly when the modal isn't being
  //      dismissed concurrently — so no setTimeout dance is needed.
  // Clearing the focus (next === null) skips the Alert and just dismisses.
  const handleSelect = async (next: string | null) => {
    setSavingFocus(true);
    try {
      await setFocusTheme(next);
    } finally {
      setSavingFocus(false);
    }

    if (!next) {
      setPickerVisible(false);
      return;
    }

    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `fc-${Date.now()}`;
    logPlanEvent({
      name: 'plan.focus_theme_set',
      session_id: sessionId,
      meal_plan_id: planId,
      payload: sanitizePayload({
        meal_plan_id: planId,
        week_start: weekStart,
      }),
    });

    Alert.alert(
      'Regenerate this week?',
      `Rebuild the week's meals to lean into "${next}"?`,
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => setPickerVisible(false),
        },
        {
          text: 'Regenerate',
          style: 'default',
          onPress: () => {
            setPickerVisible(false);
            void useMealPlanStore.getState().generate(weekStart);
          },
        },
      ],
      { cancelable: false },
    );
  };

  const handleSet = () => setPickerVisible(true);
  const isBusy = savingFocus || planLoading;

  // When `children` are passed (from plan.tsx), render a stacked card
  // with the focus row on top and the children (week health chip +
  // cart icon) on a second row, all sharing the same warm-tinted card.
  // This consolidates "this week" affordances into one section the user
  // reads as a single unit.
  const hasChildren = React.Children.count(children) > 0;

  return (
    <View
      style={[styles.banner, hasChildren && styles.bannerStacked]}
      accessibilityLabel="Weekly skill focus banner"
    >
      <View style={styles.focusRow}>
        <Text style={styles.focusLabel}>Skill Focus</Text>
        {isBusy ? (
          <>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.text} numberOfLines={2}>
              {planLoading
                ? `Rebuilding the week${theme ? ` around “${theme}”` : ''}…`
                : 'Saving focus…'}
            </Text>
          </>
        ) : (
          <Pressable
            onPress={handleSet}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={theme ? 'Change focus theme' : 'Set focus theme'}
            style={({ pressed }) => [
              styles.focusChip,
              pressed && styles.focusChipPressed,
            ]}
          >
            <SymbolIcon
              name="target"
              size={14}
              tintColor={colors.warning}
              weight="semibold"
            />
            <Text style={styles.focusChipLabel} numberOfLines={1}>
              {theme ?? 'Set focus'}
            </Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
      </View>

      {hasChildren ? (
        <View style={styles.childrenRow}>{children}</View>
      ) : null}

      <FocusPickerSheet
        visible={pickerVisible}
        currentTheme={theme}
        onSelect={handleSelect}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    // Warm accent mirroring the warning-tone chip used on the stretch DayRow;
    // gives the banner a visible-but-not-alarming "this week is special" vibe.
    backgroundColor: '#FFF4E6',
  },
  // Stacked variant — when children are passed, switch from a single
  // row to a column so the focus row sits on top and the children row
  // (week health chip + cart) sits below, sharing the same card.
  bannerStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  childrenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  // "Skill Focus" section label that sits to the left of the chip.
  // Lower weight than the chip so the chip itself reads as the primary
  // affordance.
  focusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Focus theme rendered as a pressable pill chip. White bg gives clean
  // contrast against the warm cream banner (#FFF4E6) so the chip pops as
  // a tappable affordance rather than blending in.
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexShrink: 1,
  },
  focusChipPressed: {
    opacity: 0.7,
  },
  focusChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: colors.warning,
  },
});
