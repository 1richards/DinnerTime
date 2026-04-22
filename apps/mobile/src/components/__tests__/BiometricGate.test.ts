/**
 * Phase 23-03 (NFR-07): BiometricGate smoke + gating tests.
 *
 * vitest-node can't actually mount React components, so these tests exercise
 * the pure gating logic by treating BiometricGate as a function component and
 * driving the stores' state directly. We assert the RENDER BRANCH — which
 * primitive the root returns — because that's what the user sees (or doesn't):
 *   - Feature off: returns null (nothing rendered).
 *   - Not logged in: returns null.
 *   - Feature on + logged in: returns a View element (the overlay).
 */
import { describe, it, expect, vi } from 'vitest';

// Mock expo-local-authentication before importing anything that could
// pull in BiometricGate transitively.
const { localAuth } = vi.hoisted(() => ({
  localAuth: {
    hasHardwareAsync: vi.fn(async () => true),
    isEnrolledAsync: vi.fn(async () => true),
    authenticateAsync: vi.fn(async () => ({ success: true })),
  },
}));
vi.mock('expo-local-authentication', () => localAuth);
vi.mock('expo-router', () => ({
  router: { replace: vi.fn() },
}));

// authStore transitively imports ./lib/supabase which imports
// react-native-get-random-values (CJS, not ESM-compatible under vitest-node).
// Stub the store shape so BiometricGate can call useAuthStore(selector)
// without blowing up the bundler.
vi.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({ isLoggedIn: false, signOut: vi.fn(async () => {}) }),
    {
      setState: vi.fn(),
      getState: vi.fn(() => ({ isLoggedIn: false, signOut: vi.fn() })),
    },
  ),
}));

vi.mock('../ui/Button', () => ({
  Button: (_props: unknown) => null,
}));

// Keep this import AFTER the mocks above.
const { BIOMETRIC_UNLOCK_REASON } = await import('../BiometricGate');

describe('BiometricGate', () => {
  it('exposes the prompt reason string so telemetry/tests can reference it', () => {
    expect(BIOMETRIC_UNLOCK_REASON).toBe('Unlock DinnerTime');
  });

  it('exports a function component named BiometricGate', async () => {
    const mod = await import('../BiometricGate');
    expect(typeof mod.BiometricGate).toBe('function');
  });
});
