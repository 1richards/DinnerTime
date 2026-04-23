/**
 * TimerBar — Phase 16 Wave 2 (16-03) retoken.
 *
 * Horizontal row of timer chips shown inside the sticky cooking header.
 * Every visual property resolves through a Phase 19 token (NativeWind class
 * or `colors.*`) — no hardcoded hex literals remain. Legacy accent-hex
 * fills have been replaced with the `brand` / `brand-pressed` tokens.
 *
 * T-10s warn transition (COOK-UX-04):
 *   When a timer's `remainingMs < 10_000` the chip swaps to the warning tone
 *   (`bg-warning/20`, `border-warning`, `text-warning`). Higher-level
 *   cooking screens pair the transition with `fireTimerWarnHaptic` — that
 *   wiring lives in the Wave 3 integration, not this primitive.
 *
 * Props (preserved from pre-Phase-16 contract): `{ timers, onCancel }`.
 */
import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import type { Timer } from '../../types/cooking';

interface TimerBarProps {
  timers: Timer[];
  onCancel: (id: string) => void;
}

const WARNING_THRESHOLD_MS = 10_000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function TimerBar({ timers, onCancel }: TimerBarProps) {
  if (timers.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="px-4 py-2"
      contentContainerStyle={{ gap: 8 }}
    >
      {timers.map((t) => {
        const warn = t.remainingMs < WARNING_THRESHOLD_MS;
        const chipClass = warn
          ? 'flex-row items-center bg-warning/20 border border-warning rounded-full px-4 py-2'
          : 'flex-row items-center bg-brand/15 border border-brand rounded-full px-4 py-2';
        const labelClass = warn
          ? 'ml-2 text-base font-semibold text-warning'
          : 'ml-2 text-base font-semibold text-brand-pressed';
        const iconTint = warn ? colors.warning : colors.brandPressed;
        return (
          <Pressable
            key={t.id}
            onPress={() => onCancel(t.id)}
            className={chipClass}
            accessibilityLabel="Cancel timer"
            accessibilityRole="button"
          >
            <SymbolIcon name="timer" size={18} tintColor={iconTint} />
            <Text className={labelClass}>{formatRemaining(t.remainingMs)}</Text>
            <SymbolIcon
              name="xmark.circle.fill"
              size={16}
              tintColor={iconTint}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
