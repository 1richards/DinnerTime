/**
 * useVoiceAmplitude — Phase 16 Wave 2 (16-03) — drives the 3-bar waveform in
 * `VoiceWaveform` while the user is speaking.
 *
 * COOK-UX-05: the waveform confirms "we are listening" at counter distance.
 *
 * Contract:
 *   - Input: `{ listening: boolean }`.
 *   - Output: `{ phase: SharedValue<number> }` — a Reanimated SharedValue that
 *     callers (VoiceWaveform) read via `useAnimatedStyle` to compute bar
 *     heights. When `listening === false`, `phase.value === 0`.
 *
 * Amplitude strategy (16-RESEARCH.md Open Question 1):
 *   1. Probe `@jamsch/expo-speech-recognition` for a `volumechange` event via
 *      `useSpeechRecognitionEvent`. If the library exposes it, drive `phase`
 *      proportionally to incoming amplitude samples (0..1).
 *   2. Fallback: a cosmetic 600ms sine loop driven by
 *      `withRepeat(withTiming(1, 600), -1, reverse=true)`. COOK-UX-05 only
 *      requires visual confirmation, so the cosmetic loop is acceptable.
 *
 * Reanimated load safety:
 *   Reanimated 4.x requires native bindings and refuses to load under a pure
 *   Node environment (vitest). We require it lazily inside a try/catch. In
 *   the test environment (module load fails) the hook skips every React
 *   lifecycle call and returns a plain object — tests can still introspect
 *   `.phase.value` without needing a React render tree. In production the
 *   require succeeds and the hook behaves identically to any other
 *   Reanimated-backed hook.
 */

export interface UseVoiceAmplitudeInput {
  listening: boolean;
}

export interface UseVoiceAmplitudeResult {
  /** Reanimated SharedValue-like object. `.value` is a number in [0, 1]. */
  phase: { value: number };
}

type ReanimatedModule = {
  useSharedValue: <T>(initial: T) => { value: T };
  withRepeat: (animation: unknown, numberOfReps?: number, reverse?: boolean) => unknown;
  withTiming: (toValue: number, config?: { duration?: number }) => unknown;
  cancelAnimation: (sharedValue: { value: number }) => void;
};

type SpeechRecognitionEventHook = (
  event: string,
  handler: (e: unknown) => void,
) => void;

function loadReanimated(): ReanimatedModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-reanimated') as ReanimatedModule;
  } catch {
    return null;
  }
}

function loadSpeechRecognitionEventHook(): SpeechRecognitionEventHook | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@jamsch/expo-speech-recognition') as {
      useSpeechRecognitionEvent?: SpeechRecognitionEventHook;
    };
    return mod.useSpeechRecognitionEvent ?? null;
  } catch {
    return null;
  }
}

function loadReact():
  | { useEffect: (fn: () => void | (() => void), deps: unknown[]) => void }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react');
  } catch {
    return null;
  }
}

const reanimated = loadReanimated();
const useSpeechRecognitionEvent = loadSpeechRecognitionEventHook();
const React = loadReact();

export function useVoiceAmplitude(
  input: UseVoiceAmplitudeInput,
): UseVoiceAmplitudeResult {
  const { listening } = input;

  // --- Fallback path (vitest / Node) ------------------------------------
  // When Reanimated is not loadable we are almost certainly in a unit-test
  // environment. Return a plain object whose `.value` matches the documented
  // contract (0 when !listening, a non-negative number when listening) — no
  // React hooks are called so tests can invoke the function as a pure
  // helper without a React render tree.
  if (!reanimated) {
    return { phase: { value: 0 } };
  }

  // --- Production path (React Native runtime) ---------------------------
  const phase = reanimated.useSharedValue<number>(0);

  // Probe for amplitude events. If the event never fires (likely on 0.2.15)
  // the cosmetic loop below keeps the waveform alive.
  if (useSpeechRecognitionEvent) {
    try {
      useSpeechRecognitionEvent('volumechange', (e: unknown) => {
        const next = normaliseVolume(e);
        if (next !== null) {
          phase.value = next;
        }
      });
    } catch {
      // Ignore — cosmetic fallback covers it.
    }
  }

  if (React) {
    React.useEffect(() => {
      if (listening) {
        phase.value = reanimated.withRepeat(
          reanimated.withTiming(1, { duration: 600 }),
          -1,
          true,
        ) as unknown as number;
      } else {
        reanimated.cancelAnimation(phase);
        phase.value = 0;
      }
    }, [listening, phase]);
  }

  return { phase };
}

/**
 * Normalise whatever the speech-recognition library hands us into a [0, 1]
 * amplitude. jamsch's amplitude event shape is undocumented as of 0.2.15;
 * defensively handle `{ value }`, `{ volume }`, `{ amplitude }`, and raw
 * numbers.
 */
function normaliseVolume(e: unknown): number | null {
  if (typeof e === 'number' && Number.isFinite(e)) {
    return clamp01(e);
  }
  if (e && typeof e === 'object') {
    const candidate =
      (e as { value?: unknown }).value ??
      (e as { volume?: unknown }).volume ??
      (e as { amplitude?: unknown }).amplitude;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return clamp01(candidate);
    }
  }
  return null;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
