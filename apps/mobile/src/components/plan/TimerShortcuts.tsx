/**
 * Phase 22-04 — Day drill-down: TimerShortcuts.
 *
 * Three hard-coded preset-duration buttons (10 / 20 / 30 min). Tapping a
 * button attempts to open Apple's Clock app via the legacy
 * `clock-alarm://` scheme. Apple deprecated 3rd-party access to that
 * scheme years ago — the `Linking.canOpenURL` probe will almost always
 * return `false` on modern iOS. When that happens we fall back to an
 * `Alert` that tells the user to open the Clock app manually OR start
 * cooking to use voice timers (Phase 16's TimerBar is the real timer
 * surface — these buttons are a discoverability nudge).
 *
 * Per PLAN 22-04 behavior block: "Apple deprecated the scheme but the
 * intent is clear; v1 uses an Alert showing the picked duration."
 */
import React from 'react';
import { View, Text, Pressable, Alert, Linking, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

const PRESETS = [10, 20, 30] as const;

/**
 * Pure URL-open helper — exported for test surface. Returns the outcome
 * so callers (and tests) can observe whether the native scheme was
 * reachable or the Alert fallback fired.
 */
export async function startTimer(minutes: number): Promise<'opened' | 'alert'> {
  try {
    const supported = await Linking.canOpenURL('clock-alarm://');
    if (supported) {
      await Linking.openURL('clock-alarm://');
      return 'opened';
    }
  } catch {
    // Fall through to Alert.
  }
  Alert.alert(
    `${minutes}-minute timer`,
    `Open the Clock app and set a ${minutes}-minute timer, or start cooking to use voice timers.`,
  );
  return 'alert';
}

export function TimerShortcuts() {
  return (
    <View style={styles.row}>
      {PRESETS.map((m) => (
        <Pressable
          key={m}
          onPress={() => {
            void startTimer(m);
          }}
          accessibilityLabel={`Start ${m} minute timer`}
          accessibilityRole="button"
          style={styles.btn}
          hitSlop={8}
        >
          <SymbolIcon name="timer" size={18} tintColor={colors.brand} />
          <Text style={styles.label}>{m}m</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
