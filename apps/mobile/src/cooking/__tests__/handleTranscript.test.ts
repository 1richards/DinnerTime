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
    // Phase 16 COOK-UX-05 deps (wired here so every test satisfies the
    // extended TranscriptDeps interface without boilerplate):
    onCommandToast: vi.fn(),
    onCommandHaptic: vi.fn(),
    onShowIngredients: vi.fn(),
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

  it('routes a timer phrase to deps.addTimer(ms) (Phase 16: no TTS echo — see Voice feedback principle)', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript(
      'set a timer for 10 minutes',
      deps as never
    );
    expect(intent.type).toBe('timer');
    expect(deps.addTimer).toHaveBeenCalledTimes(1);
    // UI-SPEC §Voice feedback principle: silent confirmation. Toast + haptic
    // only. The new toast/haptic assertions live in the Phase 16 describe block.
    expect(deps.speak).not.toHaveBeenCalled();
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

describe('handleTranscript — show_ingredients intent dispatch (Phase 16 COOK-UX-05)', () => {
  it('dispatches stopSpeech → haptic → toast("Ingredients") → onShowIngredients on "show ingredients"', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript('show ingredients', deps as never);

    expect(intent).toEqual({ type: 'show_ingredients' });
    expect(deps.stopSpeech).toHaveBeenCalledTimes(1);
    expect(deps.onCommandHaptic).toHaveBeenCalledTimes(1);
    expect(deps.onCommandToast).toHaveBeenCalledWith('Ingredients');
    expect(deps.onShowIngredients).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire deps.onAsk on show_ingredients intent (no network)', async () => {
    const deps = makeDeps();
    await handleTranscript('show ingredients', deps as never);
    expect(deps.onAsk).not.toHaveBeenCalled();
  });

  it('does NOT fire nav/timer deps on show_ingredients', async () => {
    const deps = makeDeps();
    await handleTranscript('list ingredients', deps as never);
    expect(deps.next).not.toHaveBeenCalled();
    expect(deps.back).not.toHaveBeenCalled();
    expect(deps.repeat).not.toHaveBeenCalled();
    expect(deps.addTimer).not.toHaveBeenCalled();
    expect(deps.speak).not.toHaveBeenCalled();
  });

  it('end-to-end integration: intentRouter + handleTranscript route "what are the ingredients" correctly', async () => {
    const deps = makeDeps();
    const intent = await handleTranscript(
      'what are the ingredients',
      deps as never
    );
    expect(intent).toEqual({ type: 'show_ingredients' });
    expect(deps.onShowIngredients).toHaveBeenCalledTimes(1);
    expect(deps.onAsk).not.toHaveBeenCalled();
  });
});
