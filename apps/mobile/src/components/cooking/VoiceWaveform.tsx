/**
 * VoiceWaveform — Phase 16 Wave 2 (16-03).
 *
 * 3 visual states covering COOK-UX-05 "at-a-glance listening state":
 *   enabled=false        -> mic-slash SF Symbol (voice off, idle).
 *   enabled && !listening -> pulse dot (armed but not currently listening).
 *   enabled && listening -> 3 animated bars driven by `useVoiceAmplitude`.
 *
 * Pressable outer wrapper fires `onToggle` so the same component serves as
 * the voice-toggle affordance in the sticky header. `onToggle` is optional
 * because the Wave 0 test harness invokes the component as a pure
 * function — the component must render without a tap handler.
 *
 * Styling: Phase 19 tokens only. Accent color (`brand`) is reserved here by
 * UI-SPEC §Color for the waveform mic fill + the StopTTSButton fill.
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useVoiceAmplitude } from '../../cooking/useVoiceAmplitude';

export interface VoiceWaveformProps {
  listening: boolean;
  enabled: boolean;
  onToggle?: () => void;
}

const BAR_OFFSETS = [0, Math.PI / 3, (2 * Math.PI) / 3] as const;

function barHeightFromPhase(phase: number, offsetPi: number): number {
  // Peak 20pt, floor 4pt — matches UI-SPEC §Voice waveform dimensions.
  const amp = Math.abs(Math.sin(phase * 2 * Math.PI + offsetPi));
  return 4 + amp * 16;
}

export function VoiceWaveform({
  listening,
  enabled,
  onToggle,
}: VoiceWaveformProps) {
  const { phase } = useVoiceAmplitude({ listening: enabled && listening });

  if (!enabled) {
    return (
      <Pressable
        onPress={onToggle}
        accessibilityLabel="Voice commands: off"
        accessibilityRole="button"
        className="items-center justify-center w-10 h-10"
        hitSlop={8}
      >
        <SymbolIcon
          name="mic.slash.fill"
          size="body"
          tintColor={colors.textTertiary}
        />
      </Pressable>
    );
  }

  if (!listening) {
    return (
      <Pressable
        onPress={onToggle}
        accessibilityLabel="Voice commands: on"
        accessibilityRole="button"
        className="items-center justify-center w-10 h-10"
        hitSlop={8}
      >
        <View
          data-role="pulse-dot-outer"
          className="w-6 h-6 rounded-full bg-brand/30 items-center justify-center"
        >
          <View
            data-role="pulse-dot"
            className="w-2 h-2 rounded-full bg-brand"
          />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onToggle}
      accessibilityLabel="Voice commands: listening"
      accessibilityRole="button"
      className="flex-row items-end justify-center w-10 h-10"
      hitSlop={8}
    >
      {BAR_OFFSETS.map((offset, index) => (
        <View
          key={index}
          data-role="waveform-bar"
          className="w-1 mx-0.5 rounded-full bg-brand"
          style={{ height: barHeightFromPhase(phase.value, offset) }}
        />
      ))}
    </Pressable>
  );
}

export default VoiceWaveform;
