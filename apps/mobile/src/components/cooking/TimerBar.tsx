import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { Timer } from '../../types/cooking';

interface TimerBarProps {
  timers: Timer[];
  onCancel: (id: string) => void;
}

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
      {timers.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => onCancel(t.id)}
          className="flex-row items-center bg-orange-100 border border-orange-300 rounded-full px-4 py-2"
          accessibilityLabel="Cancel timer"
        >
          <SymbolIcon name="timer" size={18} tintColor="#C2410C" />
          <Text className="ml-2 text-base font-semibold text-orange-800">
            {formatRemaining(t.remainingMs)}
          </Text>
          <SymbolIcon
            name="xmark.circle.fill"
            size={16}
            tintColor="#C2410C"
            style={{ marginLeft: 6 }}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}
