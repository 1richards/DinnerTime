import React from 'react';
import { Pressable, ActionSheetIOS } from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '../ui/SymbolIcon';

/**
 * Pantry "add" FAB. The plus glyph signals that multiple add flows exist
 * (camera, receipt). Tapping shows an iOS action sheet; picking Camera
 * routes straight into /scan which auto-launches the capture UI on mount.
 */
export function ScanButton() {
  const handlePress = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Take Photo', 'Scan Receipt', 'Cancel'],
        cancelButtonIndex: 2,
        title: 'Add items to pantry',
      },
      (idx) => {
        if (idx === 0) router.push('/scan');
        else if (idx === 1) router.push('/scan/receipt');
      },
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      className="absolute bottom-6 right-6 w-16 h-16 bg-brand rounded-full items-center justify-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      }}
      accessibilityLabel="Add items to pantry"
    >
      <SymbolIcon name="plus" size={30} weight="bold" tintColor="#FFFFFF" />
    </Pressable>
  );
}
