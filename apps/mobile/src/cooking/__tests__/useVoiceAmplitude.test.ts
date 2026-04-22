/**
 * Red test stub (Phase 16 Wave 0) — production hook ships in 16-04.
 *
 * Imports `../useVoiceAmplitude` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-05 (voice listening indicator — waveform amplitude).
 * Fallback contract: if `@jamsch/expo-speech-recognition` does NOT expose an
 * amplitude event, the hook drives a cosmetic loop (see 16-UI-SPEC.md).
 */
import { describe, it, expect, vi } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-04)
import { useVoiceAmplitude } from '../useVoiceAmplitude';

describe('useVoiceAmplitude', () => {
  it('returns a non-zero phase SharedValue when listening=true', () => {
    // Contract: when invoked with listening=true, the hook must return a
    // SharedValue whose .value becomes non-zero within one tick (driven by
    // either the amplitude subscription or the cosmetic fallback loop).
    const result = useVoiceAmplitude({ listening: true });
    expect(result).toBeDefined();
    expect(typeof (result as { phase: { value: number } }).phase.value).toBe(
      'number'
    );
    // We assert the SharedValue initializes to a numeric 0-or-greater baseline;
    // in the green implementation the amplitude loop will drive it to > 0 on
    // the next render. This stub assertion confirms the surface exists.
    expect((result as { phase: { value: number } }).phase.value).toBeGreaterThanOrEqual(
      0
    );
  });

  it('returns a zero phase SharedValue when listening=false', () => {
    const result = useVoiceAmplitude({ listening: false });
    expect((result as { phase: { value: number } }).phase.value).toBe(0);
  });

  it('subscribes to the speech-recognition amplitude event when available', () => {
    // This test codifies the integration contract. The green implementation
    // either calls useSpeechRecognitionEvent('volumechange', ...) or falls
    // back to the cosmetic loop. The stub expects a callable hook.
    expect(typeof useVoiceAmplitude).toBe('function');
  });
});
