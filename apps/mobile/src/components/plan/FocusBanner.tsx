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

import React from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';

export function FocusBanner() {
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const setFocusTheme = useMealPlanStore((s) => s.setFocusTheme);

  if (!currentPlan) return null;

  const theme = currentPlan.focus_theme ?? null;

  const handleSet = () => {
    Alert.prompt(
      'Weekly skill focus',
      'What do you want to practice this week? (e.g. "knife skills", "pan sauces", "Italian")',
      async (value) => {
        const trimmed = (value ?? '').trim();
        const next = trimmed.length > 0 ? trimmed : null;
        await setFocusTheme(next);
        if (next) {
          const sessionId =
            typeof globalThis.crypto?.randomUUID === 'function'
              ? globalThis.crypto.randomUUID()
              : `fc-${Date.now()}`;
          logPlanEvent({
            name: 'plan.focus_theme_set',
            session_id: sessionId,
            meal_plan_id: currentPlan.id,
            payload: sanitizePayload({
              meal_plan_id: currentPlan.id,
              week_start: currentPlan.week_start,
            }),
          });
        }
      },
      'plain-text',
      theme ?? ''
    );
  };

  return (
    <View style={styles.banner} accessibilityLabel="Weekly skill focus banner">
      <SymbolIcon name="sparkles" size={16} tintColor={colors.warning} />
      {theme ? (
        <Text style={styles.text} numberOfLines={2}>
          This week: <Text style={styles.themeText}>{theme}</Text>
        </Text>
      ) : (
        <Text style={styles.text} numberOfLines={2}>
          Set a weekly focus to uplevel this week&apos;s meals
        </Text>
      )}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={handleSet}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={theme ? 'Change focus theme' : 'Set focus theme'}
      >
        <Text style={styles.action}>{theme ? 'Change' : 'Set focus'}</Text>
      </Pressable>
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
