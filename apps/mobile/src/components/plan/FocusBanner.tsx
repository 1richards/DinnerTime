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

export function FocusBanner() {
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

  return (
    <View style={styles.banner} accessibilityLabel="Weekly skill focus banner">
      {isBusy ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <SymbolIcon name="sparkles" size={16} tintColor={colors.warning} />
      )}
      {isBusy ? (
        <Text style={styles.text} numberOfLines={2}>
          {planLoading
            ? `Rebuilding the week${theme ? ` around “${theme}”` : ''}…`
            : 'Saving focus…'}
        </Text>
      ) : theme ? (
        <Text style={styles.text} numberOfLines={2}>
          This week: <Text style={styles.themeText}>{theme}</Text>
        </Text>
      ) : (
        <Text style={styles.text} numberOfLines={2}>
          Set a weekly focus to uplevel this week&apos;s meals
        </Text>
      )}
      <View style={{ flex: 1 }} />
      {!isBusy && (
        <Pressable
          onPress={handleSet}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={theme ? 'Change focus theme' : 'Set focus theme'}
        >
          <Text style={styles.action}>{theme ? 'Change' : 'Set focus'}</Text>
        </Pressable>
      )}
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
  text: {
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  themeText: {
    fontWeight: '800',
    color: colors.brand,
  },
  action: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
});
