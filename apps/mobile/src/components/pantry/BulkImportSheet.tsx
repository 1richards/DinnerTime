import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '../ui/SymbolIcon';

interface BulkImportSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface OptionRowProps {
  // SF Symbols has no typed glyphMap — plain string (Pitfall 5).
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function OptionRow({ icon, title, subtitle, onPress }: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={title}
      className="bg-white rounded-2xl p-4 flex-row items-center gap-4 mb-3 border border-warmGray-200"
    >
      <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center">
        <SymbolIcon name={icon as never} size={26} tintColor="#F97316" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-warmGray-800">{title}</Text>
        <Text className="text-sm text-warmGray-500 mt-0.5">{subtitle}</Text>
      </View>
      <SymbolIcon name="chevron.forward" size={20} tintColor="#9CA3AF" />
    </Pressable>
  );
}

export function BulkImportSheet({ visible, onClose }: BulkImportSheetProps) {
  const navigateTo = (path: '/scan' | '/scan/receipt' | '/scan/instacart') => {
    onClose();
    // Slight delay isn't necessary — expo-router pushes next tick.
    router.push(path);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View className="bg-warmWhite rounded-t-3xl p-6 pb-10">
            <View className="w-12 h-1 bg-warmGray-300 rounded-full self-center mb-4" />
            <Text className="text-lg font-semibold text-warmGray-800 mb-4">
              Add pantry items
            </Text>

            <OptionRow
              icon="camera.fill"
              title="Camera"
              subtitle="Scan your fridge, pantry, or freezer"
              onPress={() => navigateTo('/scan')}
            />
            <OptionRow
              icon="doc.text"
              title="Receipt"
              subtitle="Photograph a grocery receipt"
              onPress={() => navigateTo('/scan/receipt')}
            />
            <OptionRow
              icon="bag"
              title="Instacart"
              subtitle="Import from an Instacart screenshot"
              onPress={() => navigateTo('/scan/instacart')}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
