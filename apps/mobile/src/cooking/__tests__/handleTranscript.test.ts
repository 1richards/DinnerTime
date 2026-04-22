/**
 * handleTranscript tests.
 *
 * Phase 9 shipped the dispatcher module but no dedicated vitest file existed
 * (only intentRouter and the screen-level tests covered it). Phase 16 Wave 0
 * establishes this file with:
 *   1. Baseline coverage of the current shipped dispatch behavior (GREEN).
 *   2. New onCommandToast + onCommandHaptic describe block (RED — the
 *      production TranscriptDeps signature doesn't include those callbacks
 *      yet; Wave 3 plan 16-04 adds them and flips these cases green).
 *
 * Requirement: COOK-UX-05 (voice commands + visual confirmation feedback).
 */
import { describe, it, expect, vi } from 'vitest';
import { handleTranscript } from '../handleTranscript';

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    stopSpeech: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    repeat: vi.fn(),
    addTimer: vi.fn(),
    speak: vi.fn(),
    onAsk: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('handleTranscript — existing dispatch behavior', () => {
  it('routes "next step" to deps.next()', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript('next step', deps as never);
    expect(intent).toEqual({ type: 'next' });
    expect(deps.next).toHaveBeenCalledTimes(1);
    expect(deps.stopSpeech).toHaveBeenCalledTimes(1);
  });

  it('routes "go back" to deps.back()', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript('go back', deps as never);
    expect(intent).toEqual({ type: 'back' });
    expect(deps.back).toHaveBeenCalledTimes(1);
  });

  it('routes "repeat" to deps.repeat()', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript('repeat', deps as never);
    expect(intent).toEqual({ type: 'repeat' });
    expect(deps.repeat).toHaveBeenCalledTimes(1);
  });

  it('routes a timer phrase to deps.addTimer(ms) and speaks confirmation', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript(
      'set a timer for 10 minutes',
      deps as never
    );
    expect(intent.type).toBe('timer');
    expect(deps.addTimer).toHaveBeenCalledTimes(1);
    expect(deps.speak).toHaveBeenCalledTimes(1);
  });

  it('routes unrecognized input to deps.onAsk(question)', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript(
      'is the chicken done yet',
      deps as never
    );
    expect(intent.type).toBe('ask');
    expect(deps.onAsk).toHaveBeenCalledTimes(1);
    expect(deps.onAsk).toHaveBeenCalledWith('is the chicken done yet');
  });
});

describe('handleTranscript — onCommandToast + onCommandHaptic (Phase 16 red)', () => {
  it('calls onCommandToast("Next step") when intent is next', async () => {
    const onCommandToast = vi.fn();
    const onCommandHaptic = vi.fn();
    const deps = makeDeps({ onCommandToast, onCommandHaptic });
    await handleTranscript('next step', deps as never);
    expect(onCommandToast).toHaveBeenCalledWith('Next step');
    expect(onCommandHaptic).toHaveBeenCalledTimes(1);
  });

  it('calls onCommandToast("Previous step") on back', async () => {
    const onCommandToast = vi.fn();
    const onCommandHaptic = vi.fn();
    const deps = makeDeps({ onCommandToast, onCommandHaptic });
    await handleTranscript('go back', deps as never);
    expect(onCommandToast).toHaveBeenCalledWith('Previous step');
    expect(onCommandHaptic).toHaveBeenCalledTimes(1);
  });

  it('calls onCommandToast("Repeating") on repeat', async () => {
    const onCommandToast = vi.fn();
    const onCommandHaptic = vi.fn();
    const deps = makeDeps({ onCommandToast, onCommandHaptic });
    await handleTranscript('repeat', deps as never);
    expect(onCommandToast).toHaveBeenCalledWith('Repeating');
    expect(onCommandHaptic).toHaveBeenCalledTimes(1);
  });

  it('calls onCommandToast("Timer set · 10 min") on timer intent', async () => {
    const onCommandToast = vi.fn();
    const onCommandHaptic = vi.fn();
    const deps = makeDeps({ onCommandToast, onCommandHaptic });
    await handleTranscript('set a timer for 10 minutes', deps as never);
    expect(onCommandToast).toHaveBeenCalledWith('Timer set · 10 min');
    expect(onCommandHaptic).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire toast or haptic on ask fall-through', async () => {
    const onCommandToast = vi.fn();
    const onCommandHaptic = vi.fn();
    const deps = makeDeps({ onCommandToast, onCommandHaptic });
    await handleTranscript('is the chicken done yet', deps as never);
    expect(onCommandToast).not.toHaveBeenCalled();
    expect(onCommandHaptic).not.toHaveBeenCalled();
  });
});
