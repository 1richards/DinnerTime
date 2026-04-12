import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ServingSizeStepperProps {
  servings: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}

export function ServingSizeStepper({
  servings,
  onChange,
  min = 1,
  max = 24,
}: ServingSizeStepperProps) {
  const dec = () => {
    if (servings > min) onChange(servings - 1);
  };
  const inc = () => {
    if (servings < max) onChange(servings + 1);
  };

  const disabledDec = servings <= min;
  const disabledInc = servings >= max;

  return (
    <View className="flex-row items-center bg-warmGray-100 rounded-full px-2 py-1 self-start">
      <Pressable
        onPress={dec}
        disabled={disabledDec}
        hitSlop={8}
        className={`w-9 h-9 rounded-full items-center justify-center ${
          disabledDec ? 'opacity-40' : ''
        }`}
      >
        <Ionicons name="remove" size={22} color="#1F2937" />
      </Pressable>
      <Text className="mx-3 text-base font-semibold text-warmGray-900 min-w-[80px] text-center">
        {servings} {servings === 1 ? 'serving' : 'servings'}
      </Text>
      <Pressable
        onPress={inc}
        disabled={disabledInc}
        hitSlop={8}
        className={`w-9 h-9 rounded-full items-center justify-center ${
          disabledInc ? 'opacity-40' : ''
        }`}
      >
        <Ionicons name="add" size={22} color="#1F2937" />
      </Pressable>
    </View>
  );
}
