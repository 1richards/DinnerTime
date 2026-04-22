/**
 * StopTTSButton — Phase 16 Wave 2 (16-03).
 *
 * Icon-only Pressable that interrupts the active TTS read-out. UI-SPEC
 * §Copywriting explicitly mandates the accessibility label "Stop reading"
 * because "Stop" alone is ambiguous at counter distance (stop recipe?
 * stop timer? stop listening?).
 *
 * Ergonomics:
 *   - 44pt min tap target via `hitSlop`.
 *   - SF Symbol `stop.circle.fill` — tinted with Phase 19 `brand` accent.
 *   - Fires `fireStopTTSHaptic()` (Medium impact) alongside the onPress
 *     callback so the user gets a physical confirmation that the read-out
 *     stopped, mirroring COOK-UX-05's voice-command haptic contract.
 *
 * Visibility: rendered by `StickyCookingHeader` only while `ttsSpeaking === true`.
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { fireStopTTSHaptic } from '../../cooking/haptics';

export interface StopTTSButtonProps {
  onPress: () => void;
}

export function StopTTSButton({ onPress }: StopTTSButtonProps) {
  const handlePress = () => {
    void fireStopTTSHaptic();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel="Stop reading"
      accessibilityRole="button"
      hitSlop={8}
      className="items-center justify-center w-11 h-11"
    >
      <View
        data-role="stop-tts-icon-surface"
        className="w-8 h-8 items-center justify-center rounded-full bg-brand/10"
      >
        <SymbolIcon
          name="stop.circle.fill"
          size="title"
          tintColor={colors.brand}
        />
      </View>
    </Pressable>
  );
}

export default StopTTSButton;
