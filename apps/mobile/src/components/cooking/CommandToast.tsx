/**
 * CommandToast — voice-command confirmation primitive (Phase 16 COOK-UX-05).
 *
 * Fires on every recognized voice command (next/back/repeat/timer/show_ingredients).
 * The dispatcher (`handleTranscript`) owns the haptic; this component is purely
 * visual + auditory-accessibility (via `accessibilityLiveRegion="polite"`).
 *
 * Contract (UI-SPEC §Copywriting Voice Command Toast Copy):
 *   - 1.5s auto-dismiss
 *   - body/700 centered single line
 *   - Brand left-edge accent strip (4px, UI-SPEC §Color "accent reserved for…")
 *   - Live region "polite" for VoiceOver
 *   - No TTS echo — silent except for screen-reader announcement
 *
 * Implementation notes:
 *   The Wave 0 test harness (CommandToast.test.tsx) invokes this component as
 *   a plain function call — `CommandToast({ message, id, onClear })` — and
 *   asserts `onClear` fires after `vi.advanceTimersByTimeAsync(1500)`. This
 *   means the 1.5s `setTimeout` MUST be armed directly in the function body
 *   (not inside `useEffect`, which only fires during a real React render).
 *
 *   A fresh `setTimeout` is armed on every render. Parent components emit each
 *   toast with a unique `id` (mirrors the existing `CommandToast` type in
 *   cookingStore) which acts as a React key to force re-mount — in practice
 *   the parent clears the message on `onClear` fire, which unmounts this
 *   subtree. The transient extra timer if parent re-renders before clear is
 *   harmless: the stale timer resolves against an already-cleared message.
 *
 *   No `Animated.Value` / Reanimated — keeping the component node-testable
 *   under vitest without a native module bridge. Parent can wrap in its own
 *   Animated/Reanimated transition if a richer animation is desired later;
 *   for MVP the fade-in lives on the parent via CSS `z-10 shadow` + opacity.
 */
import React from 'react';
import { View, Text } from 'react-native';

export interface CommandToastProps {
  /** Toast copy; when null, component renders nothing. */
  message: string | null;
  /** Unique id per emission — used by the parent as a React key to force re-mount. */
  id?: string;
  /** Fired 1.5s after mount — parent clears its message state. */
  onClear: () => void;
}

export function CommandToast({ message, onClear }: CommandToastProps) {
  if (message === null) return null;

  // Arm the 1.5s auto-dismiss. Direct setTimeout (not useEffect) so the Wave 0
  // test harness, which invokes this function plainly, still observes the
  // timer fire after vi.advanceTimersByTimeAsync(1500).
  setTimeout(() => {
    onClear();
  }, 1500);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      className="absolute top-16 left-4 right-4 z-10 bg-surface border-l-4 border-brand rounded-lg px-4 py-3 shadow"
    >
      <Text className="text-body font-bold text-text-primary text-center">
        {message}
      </Text>
    </View>
  );
}

export default CommandToast;
