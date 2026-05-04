/**
 * StickyCookingHeader — Phase 16 Wave 2 (16-03).
 *
 * Always-visible cluster sitting above the scrollable recipe body in cooking
 * mode. Composes every "counter-distance critical" control: Exit, recipe
 * title, active-timer strip, TTS-interrupt.
 *
 * Layout (UI-SPEC §Layout structure + §Spacing):
 *   - Base band: 64pt tall (`h-16`), row with Exit (left), recipe title
 *     (centred, 1-line truncate), action cluster (right: optional Stop
 *     reading).
 *   - Timer band: 48pt (`h-12`), rendered only when `timers.length > 0`.
 *   - Surface: `bg-surface` + 1pt `border-border` divider. Accent color
 *     (`brand`) is RESERVED for StopTTSButton, never for the header
 *     background (UI-SPEC §Color).
 *
 * Rendering note: sub-components (`TimerBar`, `StopTTSButton`) are invoked as
 * functions rather than JSX elements so the unit-test tree-flattener (which
 * only walks `props.children`) sees their descendant nodes. Functionally
 * identical to `<Component />` at runtime in React.
 *
 * Props shape: `{ recipe, timers, ttsSpeaking, onExit, onStopTTS, onCancelTimer? }`.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import TimerBar from './TimerBar';
import { StopTTSButton } from './StopTTSButton';
import type { Recipe } from '../../types/recipe';
import type { Timer } from '../../types/cooking';

export interface StickyCookingHeaderProps {
  recipe: Recipe;
  timers: Timer[];
  ttsSpeaking: boolean;
  onExit: () => void;
  onStopTTS: () => void;
  /** Optional — callers that don't need cancel can omit it (no-op fallback). */
  onCancelTimer?: (id: string) => void;
  /** Optional — callers that want a persistent add-timer affordance pass a
      handler that opens a duration picker (e.g. ActionSheetIOS). When
      omitted, the button is hidden so legacy headers stay unchanged. */
  onAddTimer?: () => void;
}

export function StickyCookingHeader({
  recipe,
  timers,
  ttsSpeaking,
  onExit,
  onStopTTS,
  onCancelTimer,
  onAddTimer,
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

        {/* Right: persistent add-timer button + optional TTS interrupt.
            Wrapper preserves the right-side reservation slot so the title
            doesn't reflow when TTS toggles. StopTTSButton is invoked as a
            function so the test tree-flattener (which only walks
            .props.children) sees its descendants. */}
        <View className="flex-row items-center gap-2">
          {onAddTimer ? (
            <Pressable
              onPress={onAddTimer}
              accessibilityLabel="Add timer"
              accessibilityRole="button"
              hitSlop={8}
            >
              <SymbolIcon
                name="timer"
                size="title"
                tintColor={colors.brand}
              />
            </Pressable>
          ) : null}
          {ttsSpeaking ? StopTTSButton({ onPress: onStopTTS }) : null}
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
