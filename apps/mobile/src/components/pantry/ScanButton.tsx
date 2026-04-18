import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '../ui/SymbolIcon';

export function ScanButton() {
  return (
    <Pressable
      onPress={() => router.push('/scan')}
      className="absolute bottom-6 right-6 w-16 h-16 bg-orange-500 rounded-full items-center justify-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      }}
      accessibilityLabel="Scan"
    >
      <SymbolIcon name="camera.fill" size={28} tintColor="#FFFFFF" />
    </Pressable>
  );
}
