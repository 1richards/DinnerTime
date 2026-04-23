/**
 * Red test stub (Phase 23 Wave 0) — module ships in 23-03.
 *
 * Imports `../biometric.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../biometric.js'" — that is the red signal.
 *
 * Wave 2 creates `apps/mobile/src/auth/biometric.ts` wrapping
 * expo-local-authentication with:
 *   export async function isBiometricAvailable(): Promise<boolean>;
 *   export async function promptBiometricUnlock(
 *     reason: string,
 *   ): Promise<'success' | 'cancelled' | 'failed' | 'unavailable'>;
 *
 * Requirement: NFR-08 (biometric unlock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { localAuth } = vi.hoisted(() => {
  const localAuth = {
    hasHardwareAsync: vi.fn(async () => true),
    isEnrolledAsync: vi.fn(async () => true),
    authenticateAsync: vi.fn(async () => ({ success: true })),
  };
  return { localAuth };
});

vi.mock('expo-local-authentication', () => localAuth);

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-03)
const { isBiometricAvailable, promptBiometricUnlock } = await import('../biometric.js');

describe('isBiometricAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localAuth.hasHardwareAsync.mockResolvedValue(true);
    localAuth.isEnrolledAsync.mockResolvedValue(true);
  });

  it('returns true when hasHardwareAsync && isEnrolledAsync both true', async () => {
    await expect(isBiometricAvailable()).resolves.toBe(true);
  });

  it('returns false when hasHardwareAsync is false', async () => {
    localAuth.hasHardwareAsync.mockResolvedValueOnce(false);
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });

  it('returns false when isEnrolledAsync is false', async () => {
    localAuth.isEnrolledAsync.mockResolvedValueOnce(false);
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });
});

describe('promptBiometricUnlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localAuth.hasHardwareAsync.mockResolvedValue(true);
    localAuth.isEnrolledAsync.mockResolvedValue(true);
  });

  it("returns 'success' on authenticateAsync { success: true }", async () => {
    localAuth.authenticateAsync.mockResolvedValueOnce({ success: true });
    await expect(promptBiometricUnlock('unlock')).resolves.toBe('success');
  });

  it("returns 'cancelled' on { success: false, error: 'user_cancel' }", async () => {
    localAuth.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    await expect(promptBiometricUnlock('unlock')).resolves.toBe('cancelled');
  });

  it("returns 'unavailable' when hardware missing", async () => {
    localAuth.hasHardwareAsync.mockResolvedValueOnce(false);
    await expect(promptBiometricUnlock('unlock')).resolves.toBe('unavailable');
  });

  it("returns 'failed' on any other error", async () => {
    localAuth.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'authentication_failed',
    });
    await expect(promptBiometricUnlock('unlock')).resolves.toBe('failed');
  });
});
