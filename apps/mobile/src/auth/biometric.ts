/**
 * Phase 23-03 (NFR-07): Pure wrapper around expo-local-authentication.
 *
 * Keeps the native-module surface area behind a discriminated-union result
 * so UI callers never see raw error strings. Two entry points:
 *
 *   - isBiometricAvailable(): capability + enrollment probe. Both must be
 *     true for the prompt to make sense (hardware alone means Face ID exists
 *     but the user hasn't enrolled — we still report false).
 *   - promptBiometricUnlock(reason): runs the actual Face ID prompt. If the
 *     device can't do biometrics at all, short-circuits to 'unavailable'
 *     WITHOUT calling authenticateAsync (which would throw on unsupported
 *     hardware). Otherwise maps expo-local-authentication's error strings
 *     to 'cancelled' (user/system/app cancel) or 'failed' (everything else
 *     including authentication_failed, lockout, unknown, and thrown errors).
 *
 * This module is intentionally UI-free — BiometricGate + BiometricUnlockSection
 * own all React concerns (state, AppState listening, toast/Alert). The helper
 * is the single chokepoint for the `expo-local-authentication` import so it's
 * easy to swap providers later if needed (e.g., LAContext directly via a
 * native module).
 *
 * Used by:
 *   - BiometricUnlockSection: on OFF→ON toggle to prove capability + that the
 *     user can actually authenticate before we persist the flag.
 *   - BiometricGate: on foreground transitions when the flag is enabled.
 */

// Lazy-load the native module so the app still boots on dev clients that
// haven't been rebuilt since expo-local-authentication was added.
let _LA: typeof import('expo-local-authentication') | null = null;
let _loadFailed = false;

function getLA(): typeof import('expo-local-authentication') | null {
  if (_LA) return _LA;
  if (_loadFailed) return null;
  try {
    _LA = require('expo-local-authentication');
    return _LA;
  } catch {
    _loadFailed = true;
    return null;
  }
}

export type BiometricResult = 'success' | 'cancelled' | 'failed' | 'unavailable';

export async function isBiometricAvailable(): Promise<boolean> {
  const LA = getLA();
  if (!LA) return false;
  try {
    const [hw, enrolled] = await Promise.all([
      LA.hasHardwareAsync(),
      LA.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function promptBiometricUnlock(
  reason: string,
): Promise<BiometricResult> {
  const LA = getLA();
  if (!LA) return 'unavailable';
  if (!(await isBiometricAvailable())) return 'unavailable';
  try {
    const result = await LA.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    const error = 'error' in result ? result.error : '';
    if (
      error === 'user_cancel' ||
      error === 'system_cancel' ||
      error === 'app_cancel'
    ) {
      return 'cancelled';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
