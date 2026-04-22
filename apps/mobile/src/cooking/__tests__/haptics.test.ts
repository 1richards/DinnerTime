/**
 * Red test stub (Phase 16 Wave 0) — production module ships in 16-04.
 *
 * Imports `../haptics` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../haptics'" — that is the red signal.
 *
 * Requirement: COOK-UX-05 (voice commands + haptic confirmation).
 * Haptic contract source: 16-UI-SPEC.md §Haptic contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-04)
import {
  fireCommandHaptic,
  fireIngredientHaptic,
  fireTimerWarnHaptic,
  fireTimerExpireHaptic,
  fireExitConfirmHaptic,
  fireStopTTSHaptic,
} from '../haptics';
import * as Haptics from 'expo-haptics';

describe('haptics — Phase 16 helper surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fireCommandHaptic → impactAsync(Medium)', async () => {
    await fireCommandHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('fireIngredientHaptic → impactAsync(Light)', async () => {
    await fireIngredientHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('fireTimerWarnHaptic → impactAsync(Light)', async () => {
    await fireTimerWarnHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('fireTimerExpireHaptic → notificationAsync(Success)', async () => {
    await fireTimerExpireHaptic();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('fireExitConfirmHaptic → notificationAsync(Warning)', async () => {
    await fireExitConfirmHaptic();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning
    );
  });

  it('fireStopTTSHaptic → impactAsync(Medium)', async () => {
    await fireStopTTSHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });
});
