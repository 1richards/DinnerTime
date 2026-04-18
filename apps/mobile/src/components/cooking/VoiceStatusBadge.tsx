import React from 'react';
import { Pressable, Text } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';

interface VoiceStatusBadgeProps {
  listening: boolean;
  voiceEnabled: boolean;
  onToggle: () => void;
}

export default function VoiceStatusBadge({
  listening,
  voiceEnabled,
  onToggle,
}: VoiceStatusBadgeProps) {
  const active = voiceEnabled && listening;
  const label = !voiceEnabled ? 'Muted' : listening ? 'Listening' : 'Idle';
  const bg = active
    ? 'bg-green-100 border-green-300'
    : 'bg-warmGray-100 border-warmGray-300';
  const textColor = active ? 'text-green-800' : 'text-warmGray-600';
  const iconColor = active ? '#166534' : '#6B7280';
  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center rounded-full border px-3 py-2 ${bg}`}
      testID="voice-status-badge"
    >
      <SymbolIcon
        name={voiceEnabled ? 'mic.fill' : 'mic.slash.fill'}
        size={16}
        tintColor={iconColor}
      />
      <Text className={`ml-2 text-sm font-semibold ${textColor}`}>{label}</Text>
    </Pressable>
  );
}
