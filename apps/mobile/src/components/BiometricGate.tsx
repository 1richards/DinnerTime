/**
 * Phase 23-03 (NFR-07): Root-level biometric unlock overlay.
 *
 * Composes at the very top of the app tree (after QueryClientProvider, before
 * RootNavigator in the render order but z-indexed over it) so nothing — not
 * even the tab bar or modals — shows until Face ID succeeds when the feature
 * is enabled.
 *
 * Behavior (from 23-03 PLAN <behavior>):
 *   - No visual when settingsStore.biometricUnlockEnabled is false OR user
 *     isn't signed in OR internal `locked` state is false.
 *   - Cold-start: if enabled && logged in → start locked so Face ID runs
 *     before any tab is visible.
 *   - AppState transition 'background' → 'active' with enabled+loggedIn:
 *     flip locked=true, trigger prompt.
 *   - On 'success' result: locked=false, overlay dismisses.
 *   - On 'cancelled'/'failed'/'unavailable': stay locked and surface a
 *     "Use password" CTA that signs out and routes to /(auth)/login.
 *
 * This component does NOT own persistence or Face ID capability probing — it
 * delegates both to biometric.ts + settingsStore. If the user somehow has
 * biometricUnlockEnabled=true on a device where Face ID has been disabled
 * after-the-fact, promptBiometricUnlock returns 'unavailable' → the overlay
 * stays up with the "Use password" escape hatch, preventing a bricked app.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { promptBiometricUnlock } from '../auth/biometric';
import { Button } from './ui/Button';
import { colors } from '../design/tokens';

/**
 * Exposed so tests (and future telemetry) can assert the prompt reason
 * string without string-spreading it through the function body.
 */
export const BIOMETRIC_UNLOCK_REASON = 'Unlock DinnerTime';

export function BiometricGate() {
  const biometricUnlockEnabled = useSettingsStore(
    (s) => s.biometricUnlockEnabled,
  );
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const signOut = useAuthStore((s) => s.signOut);

  // Cold-start lock: if the feature is enabled and user is already logged in
  // when the app mounts, start locked so Face ID runs before any tab paints.
  const [locked, setLocked] = useState<boolean>(
    () => biometricUnlockEnabled && isLoggedIn,
  );
  // 'idle' = haven't prompted yet in this lock cycle.
  // 'pending' = prompt in-flight.
  // 'declined' = user cancelled/prompt failed; showing "Use password" CTA.
  const [promptStatus, setPromptStatus] = useState<
    'idle' | 'pending' | 'declined'
  >('idle');
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // Foreground transitions: when the app returns from background, if enabled
  // and logged in, re-lock so the user re-authenticates. The overlay's own
  // useEffect picks up the lock transition and triggers the prompt.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = prevAppState.current;
      // Treat both 'background' and 'inactive' as "was away" — iOS emits
      // 'inactive' during phone calls, control center pulls, and other
      // transient overlays. We only lock on true background exits, though:
      // inactive → active is noisy and would re-prompt on every control-center
      // swipe. Keep it strictly background → active.
      if (prev === 'background' && next === 'active') {
        if (biometricUnlockEnabled && isLoggedIn) {
          setLocked(true);
          setPromptStatus('idle');
        }
      }
      prevAppState.current = next;
    });
    return () => sub.remove();
  }, [biometricUnlockEnabled, isLoggedIn]);

  // Auto-run the prompt whenever we enter a locked+idle state. Guard with the
  // pending flag so React strict-mode double-invocations don't stack prompts.
  const runPrompt = useCallback(async () => {
    setPromptStatus('pending');
    const result = await promptBiometricUnlock(BIOMETRIC_UNLOCK_REASON);
    if (result === 'success') {
      setLocked(false);
      setPromptStatus('idle');
    } else {
      // cancelled / failed / unavailable — stay locked, show password CTA.
      setPromptStatus('declined');
    }
  }, []);

  useEffect(() => {
    if (locked && promptStatus === 'idle') {
      void runPrompt();
    }
  }, [locked, promptStatus, runPrompt]);

  const handleUsePassword = useCallback(async () => {
    await signOut();
    setLocked(false);
    setPromptStatus('idle');
    router.replace('/(auth)/login');
  }, [signOut]);

  const handleRetry = useCallback(() => {
    setPromptStatus('idle'); // will re-trigger the effect → re-prompt
  }, []);

  // Render nothing when not locked (or feature off / not signed in — the
  // cold-start initializer already guards this, but a belt-and-suspenders
  // check here keeps the component safe if state drifts).
  if (!locked || !biometricUnlockEnabled || !isLoggedIn) return null;

  return (
    <View
      accessibilityLabel="Biometric unlock overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: colors.brand,
          marginBottom: 12,
        }}
      >
        DinnerTime
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: colors.textSecondary,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        {promptStatus === 'pending' ? 'Unlocking…' : 'Locked'}
      </Text>
      {promptStatus === 'declined' ? (
        <View style={{ width: '100%', gap: 12 }}>
          <Button title="Try Face ID again" onPress={handleRetry} />
          <Button
            title="Use password"
            variant="secondary"
            onPress={handleUsePassword}
          />
        </View>
      ) : null}
    </View>
  );
}
