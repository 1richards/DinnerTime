/**
 * Phase 23-03 (NFR-07): Settings → Security toggle for Face ID unlock.
 *
 * Mirrors the dark-mode Switch pattern already in settings.tsx (COOKING +
 * PLAN sections). Key behaviors (from 23-03 PLAN <behavior>):
 *
 * OFF→ON:
 *   1. Optimistically flip the toggle ON.
 *   2. Immediately run promptBiometricUnlock("Enable Face ID unlock?") — this
 *      serves as both a capability probe (device can actually do Face ID
 *      right now) AND consent (user completes the prompt with their face).
 *   3. On 'success' → stays ON.
 *   4. On 'cancelled' / 'failed' / 'unavailable' → revert to OFF + toast
 *      "Face ID unavailable. Check Settings app." The toast copy intentionally
 *      collapses all three failure modes into one message because the user
 *      can't distinguish "Face ID is disabled in iOS Settings" from "my face
 *      didn't match" — both are resolved by visiting Settings.app.
 *
 * ON→OFF: unconditional. No prompt required to disable (we never lock someone
 * out of their own app).
 *
 * Device support: on mount we probe isBiometricAvailable() once and store
 * the result. If false, the row renders disabled with the subtitle "Face ID
 * unavailable on this device." — same visual affordance as a regular row but
 * the Switch is non-interactive.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isBiometricAvailable,
  promptBiometricUnlock,
} from '../../auth/biometric';

interface BiometricUnlockSectionProps {
  /** Optional toast injection so callers (settings.tsx) can reuse the page's
   *  useToast instance. When omitted, failures are silent beyond the revert. */
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

// Flip to true ONLY after the iOS dev client has been rebuilt with the
// expo-local-authentication pod linked (see BiometricGate for full rationale).
const BIOMETRIC_ENABLED = false;

export function BiometricUnlockSection(props: BiometricUnlockSectionProps = {}) {
  if (!BIOMETRIC_ENABLED) return null;
  return <BiometricUnlockSectionImpl {...props} />;
}

function BiometricUnlockSectionImpl({ showToast }: BiometricUnlockSectionProps = {}) {
  const biometricUnlockEnabled = useSettingsStore(
    (s) => s.biometricUnlockEnabled,
  );
  const setBiometricUnlockEnabled = useSettingsStore(
    (s) => s.setBiometricUnlockEnabled,
  );
  // null = probing, true/false = result known. Show the row in a consistent
  // "unavailable" state while probing so the toggle doesn't flash-enable then
  // flash-disable on slow-responding devices.
  const [deviceSupportsBiometric, setDeviceSupportsBiometric] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await isBiometricAvailable();
      if (!cancelled) setDeviceSupportsBiometric(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!next) {
        // Unconditional OFF path.
        setBiometricUnlockEnabled(false);
        return;
      }
      // Optimistic ON: flip first, then prove with a prompt. If the prompt
      // fails for any reason we revert.
      setBiometricUnlockEnabled(true);
      const result = await promptBiometricUnlock('Enable Face ID unlock?');
      if (result !== 'success') {
        setBiometricUnlockEnabled(false);
        showToast?.('Face ID unavailable. Check Settings app.', 'error');
      }
    },
    [setBiometricUnlockEnabled, showToast],
  );

  const disabled = deviceSupportsBiometric === false;
  const subtitle = disabled
    ? 'Face ID unavailable on this device.'
    : 'Require Face ID when the app opens after being closed or backgrounded.';

  return (
    <View className="mb-2">
      <Text className="text-label text-text-secondary uppercase mb-3">
        SECURITY
      </Text>
      <View
        className="flex-row items-center justify-between py-4 border-b border-border"
        accessibilityRole="switch"
        accessibilityState={{ checked: biometricUnlockEnabled, disabled }}
        accessibilityLabel="Unlock with Face ID"
      >
        <View className="flex-1 pr-4">
          <Text className="text-body text-text-primary">
            Unlock with Face ID
          </Text>
          <Text className="text-body text-text-secondary">{subtitle}</Text>
        </View>
        <Switch
          value={biometricUnlockEnabled}
          onValueChange={handleToggle}
          disabled={disabled}
        />
      </View>
    </View>
  );
}
