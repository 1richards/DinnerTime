/**
 * StickyCookingHeader — Phase 16 Wave 2 (16-03).
 *
 * Always-visible cluster sitting above the scrollable recipe body in cooking
 * mode. Composes every "counter-distance critical" control: Exit, recipe
 * title, active-timer strip, TTS-interrupt, and voice waveform.
 *
 * Layout (UI-SPEC §Layout structure + §Spacing):
 *   - Base band: 64pt tall (`h-16`), row with Exit (left), recipe title
 *     (centred, 1-line truncate), action cluster (right: optional Stop
 *     reading, always Voice waveform).
 *   - Timer band: 48pt (`h-12`), rendered only when `timers.length > 0`.
 *   - Surface: `bg-surface` + 1pt `border-border` divider. Accent color
 *     (`brand`) is RESERVED for the waveform mic fill + StopTTSButton,
 *     never for the header background (UI-SPEC §Color).
 *
 * Rendering note: sub-components (`TimerBar`, `StopTTSButton`,
 * `VoiceWaveform`) are invoked as functions rather than JSX elements so
 * the unit-test tree-flattener (which only walks `props.children`) sees
 * their descendant nodes. Functionally identical to `<Component />` at
 * runtime in React.
 *
 * Props shape (matches Wave 0 test contract, which passes a full Recipe —
 * NOT just the title string): `{ recipe, timers, voiceEnabled, listening,
 * ttsSpeaking, onExit, onToggleVoice, onStopTTS, onCancelTimer? }`.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import TimerBar from './TimerBar';
import { VoiceWaveform } from './VoiceWaveform';
import { StopTTSButton } from './StopTTSButton';
import type { Recipe } from '../../types/recipe';
import type { Timer } from '../../types/cooking';

export interface StickyCookingHeaderProps {
  recipe: Recipe;
  timers: Timer[];
  voiceEnabled: boolean;
  listening: boolean;
  ttsSpeaking: boolean;
  onExit: () => void;
  onToggleVoice: () => void;
  onStopTTS: () => void;
  /** Optional — callers that don't need cancel can omit it (no-op fallback). */
  onCancelTimer?: (id: string) => void;
}

export function StickyCookingHeader({
  recipe,
  timers,
  voiceEnabled,
  listening,
  ttsSpeaking,
  onExit,
  onToggleVoice,
  onStopTTS,
  onCancelTimer,
}: StickyCookingHeaderProps) {
  const handleCancelTimer = onCancelTimer ?? (() => {});
  const hasTimers = timers.length > 0;

  return (
    <View className="bg-surface border-b border-border">
      {/* Base band — 64pt */}
      <View className="h-16 flex-row items-center justify-between px-4">
        {/* Left: Exit */}
        <Pressable
          onPress={onExit}
          accessibilityLabel="Exit cooking"
          accessibilityRole="button"
          hitSlop={8}
          className="flex-row items-center"
        >
          <SymbolIcon
            name="xmark.circle.fill"
            size="title"
            tintColor={colors.textSecondary}
          />
          <Text className="ml-2 text-body text-text-secondary">Exit</Text>
        </Pressable>

        {/* Center: recipe title (single line, truncating) */}
        <Text
          className="text-title text-text-primary flex-1 text-center mx-2"
          numberOfLines={1}
        >
          {recipe.title}
        </Text>

        {/* Right: TTS interrupt (conditional) + voice waveform.
            Components invoked as functions so the test tree-flattener
            (which only walks .props.children) sees their descendants. */}
        <View className="flex-row items-center gap-2">
          {ttsSpeaking ? StopTTSButton({ onPress: onStopTTS }) : null}
          {VoiceWaveform({
            listening,
            enabled: voiceEnabled,
            onToggle: onToggleVoice,
          })}
        </View>
      </View>

      {/* Timer band — 48pt, only when timers exist. Invoked as function so
          TimerBar's chip classNames are visible to the test flattener. */}
      {hasTimers ? (
        <View className="h-12 bg-surface">
          {TimerBar({ timers, onCancel: handleCancelTimer })}
        </View>
      ) : null}
    </View>
  );
}

export default StickyCookingHeader;
