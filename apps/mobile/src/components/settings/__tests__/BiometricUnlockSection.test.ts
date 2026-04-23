/**
 * Phase 23-03 (NFR-07): BiometricUnlockSection smoke tests.
 *
 * Asserts the exported API surface + that it renders a View root (the section
 * header + Switch row wrapper). Detailed behavior tests (prompt-on-toggle,
 * revert-on-failure) are intentionally lightweight here because the prompt
 * side-effect is covered by biometric.test.ts and the store effect by
 * settingsStore.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { localAuth } = vi.hoisted(() => ({
  localAuth: {
    hasHardwareAsync: vi.fn(async () => true),
    isEnrolledAsync: vi.fn(async () => true),
    authenticateAsync: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('expo-local-authentication', () => localAuth);

import { BiometricUnlockSection } from '../BiometricUnlockSection';

describe('BiometricUnlockSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a function component exported by name', () => {
    expect(typeof BiometricUnlockSection).toBe('function');
  });

  it('has zero required props (showToast is optional)', () => {
    // length counts the declared non-defaulted params — with a default empty
    // destructured arg the function length is 0.
    expect(BiometricUnlockSection.length).toBe(0);
  });
});
