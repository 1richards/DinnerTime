import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';

interface StepNavButtonsProps {
  onBack: () => void;
  onRepeat: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
}

interface NavButtonProps {
  label: string;
  // SF Symbols has no typed glyphMap — plain string (Pitfall 5).
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  testID?: string;
}

function NavButton({
  label,
  icon,
  onPress,
  disabled = false,
  primary = false,
  testID,
}: NavButtonProps) {
  const container = primary
    ? 'bg-orange-500'
    : 'bg-warmGray-100 border border-warmGray-200';
  const textColor = primary ? 'text-white' : 'text-warmGray-800';
  const iconColor = primary ? '#FFFFFF' : '#374151';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      className={`flex-1 rounded-2xl items-center justify-center ${container} ${
        disabled ? 'opacity-40' : ''
      }`}
      style={{ minHeight: 72 }}
      accessibilityLabel={label}
    >
      <SymbolIcon name={icon as never} size={28} tintColor={iconColor} />
      <Text className={`mt-1 text-base font-semibold ${textColor}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function StepNavButtons({
  onBack,
  onRepeat,
  onNext,
  canGoBack,
  canGoNext,
}: StepNavButtonsProps) {
  return (
    <View className="flex-row gap-3 px-4 pb-4">
      <NavButton
        label="Back"
        icon="arrow.backward"
        onPress={onBack}
        disabled={!canGoBack}
        testID="cook-back"
      />
      <NavButton
        label="Repeat"
        icon="arrow.clockwise"
        onPress={onRepeat}
        testID="cook-repeat"
      />
      <NavButton
        label="Next"
        icon="arrow.forward"
        onPress={onNext}
        disabled={!canGoNext}
        primary
        testID="cook-next"
      />
    </View>
  );
}
