import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Speech from 'expo-speech';
import { runStepSpeakerEffect } from '../useStepSpeaker';

// We can't mount React hooks in a node environment without a renderer, so
// we exercise the pure effect body directly. useStepSpeaker is a one-line
// wrapper: `useEffect(() => runStepSpeakerEffect(text, enabled), [text, enabled])`.
// Simulating mount/rerender/unmount means calling the function and invoking
// the returned cleanup in the same order React would.

const speakMock = vi.mocked(Speech.speak);
const stopMock = vi.mocked(Speech.stop);

describe('useStepSpeaker (runStepSpeakerEffect)', () => {
  beforeEach(() => {
    speakMock.mockClear();
    stopMock.mockClear();
  });

  it('calls Speech.speak once with cooking options when mounted enabled', () => {
    runStepSpeakerEffect('Chop onions', true);

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(
      'Chop onions',
      expect.objectContaining({
        language: 'en-US',
        rate: 0.95,
        pitch: 1.0,
        onError: expect.any(Function),
      }),
    );
  });

  it('calls Speech.stop before the next Speech.speak on text change (overlap prevention)', () => {
    const cleanup1 = runStepSpeakerEffect('Chop onions', true);
    // React runs cleanup BEFORE the next effect when deps change.
    cleanup1?.();
    runStepSpeakerEffect('Heat pan', true);

    // Two speak calls total, one stop in between.
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(stopMock).toHaveBeenCalledTimes(1);

    // Order: speak, stop, speak
    const speakOrders = speakMock.mock.invocationCallOrder;
    const stopOrders = stopMock.mock.invocationCallOrder;
    expect(speakOrders[0]).toBeLessThan(stopOrders[0]);
    expect(stopOrders[0]).toBeLessThan(speakOrders[1]);
    expect(speakMock.mock.calls[1][0]).toBe('Heat pan');
  });

  it('never calls Speech.speak when enabled=false', () => {
    runStepSpeakerEffect('Chop onions', false);
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('invokes Speech.stop on cleanup (unmount)', () => {
    const cleanup = runStepSpeakerEffect('Chop onions', true);
    expect(stopMock).not.toHaveBeenCalled();
    cleanup?.();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when text is undefined', () => {
    runStepSpeakerEffect(undefined, true);
    expect(speakMock).not.toHaveBeenCalled();
    expect(stopMock).not.toHaveBeenCalled();
  });
});
