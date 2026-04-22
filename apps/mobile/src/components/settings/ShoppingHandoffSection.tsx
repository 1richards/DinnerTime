/**
 * Phase 20-02: Hidden rollback UI for SHOP-DC-05 feature flag.
 *
 * Design intent (from 20-CONTEXT §Telemetry & Rollback + 20-RESEARCH Open
 * Question 1): normal users must NEVER see the legacy-flow toggle — only
 * admins/Patrick during beta. The 5-tap hidden reveal on the "Shopping"
 * section header follows Apple's well-known "tap Build Number 7 times to
 * enable developer mode" pattern.
 *
 * Gesture: REVEAL_TAP_COUNT (5) taps on the section header within
 * REVEAL_WINDOW_MS (1500ms) flip `revealed` to true, exposing a Switch row
 * wired to `setShoppingHandoffMode`. Persist is automatic via the
 * settingsStore's persist middleware (shipped in 20-00).
 *
 * Placement: mounted between the Cooking section and Account/Sign-out block
 * in `app/(tabs)/settings.tsx`. When unrevealed, the section looks like a
 * benign info strip so normal users see only a reassuring sentence about
 * the draft-cart handoff.
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../design/tokens';

const REVEAL_TAP_COUNT = 5;
const REVEAL_WINDOW_MS = 1500;

export function ShoppingHandoffSection() {
  const mode = useSettingsStore((s) => s.shoppingHandoffMode);
  const setMode = useSettingsStore((s) => s.setShoppingHandoffMode);
  const [revealed, setRevealed] = useState(false);
  const tapLog = useRef<number[]>([]);

  const handleHeaderTap = useCallback(() => {
    const now = Date.now();
    // Sliding-window: keep only taps within REVEAL_WINDOW_MS of `now`.
    tapLog.current = [...tapLog.current, now].filter(
      (t) => now - t <= REVEAL_WINDOW_MS,
    );
    if (tapLog.current.length >= REVEAL_TAP_COUNT) {
      setRevealed(true);
      tapLog.current = [];
    }
  }, []);

  return (
    <View className="mt-8">
      <Pressable
        onPress={handleHeaderTap}
        accessibilityLabel="Shopping settings"
        hitSlop={8}
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-warmGray-500 mb-2">
          Shopping
        </Text>
      </Pressable>

      {!revealed ? (
        <Text className="text-sm text-warmGray-500">
          Items send to Instacart as a draft cart.
        </Text>
      ) : (
        <View className="bg-white rounded-xl border border-warmGray-100 px-4 py-3 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-medium text-warmGray-900">
              Use legacy order flow
            </Text>
            <Text className="text-xs text-warmGray-500 mt-0.5">
              Rollback to Phase 8 inline WebBrowser flow. Only flip this if the
              draft-cart handoff is broken in production.
            </Text>
          </View>
          <Switch
            value={mode === 'legacy'}
            onValueChange={(next) => setMode(next ? 'legacy' : 'draft_cart')}
            // phase-19-exception: Switch trackColor prop requires literal hex
            // values (cannot accept className). '#D9D2C7' matches the visual
            // weight of warmGray-200 (#E5D9CA) with slightly less saturation.
            trackColor={{ false: '#D9D2C7', true: colors.brand }}
            accessibilityLabel="Use legacy order flow"
            accessibilityState={{ checked: mode === 'legacy' }}
          />
        </View>
      )}
    </View>
  );
}
