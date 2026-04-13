import React from 'react';
import { View, Text } from 'react-native';

interface StepDisplayProps {
  stepNumber: number;
  totalSteps: number;
  text: string;
}

export default function StepDisplay({
  stepNumber,
  totalSteps,
  text,
}: StepDisplayProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-lg text-warmGray-500 mb-4">
        Step {stepNumber} of {totalSteps}
      </Text>
      <Text className="text-4xl leading-snug font-semibold text-warmGray-900 text-center">
        {text}
      </Text>
    </View>
  );
}
