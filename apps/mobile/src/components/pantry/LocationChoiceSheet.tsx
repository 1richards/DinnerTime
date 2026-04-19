import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import type { SourceLocation } from '../../types/pantry';

interface Option {
  value: SourceLocation;
  label: string;
  icon: string;
  subtitle: string;
}

// Mirrors BulkImportSheet's OptionRow pattern. Fridge + Freezer both use
// 'snowflake' per Phase 15 decision (iOS 15+ safe default).
const OPTIONS: Option[] = [
  { value: 'fridge', label: 'Fridge', icon: 'snowflake', subtitle: 'Dairy, fresh meat, produce' },
  { value: 'pantry', label: 'Pantry', icon: 'archivebox', subtitle: 'Shelf-stable, canned, dried' },
  { value: 'freezer', label: 'Freezer', icon: 'snowflake', subtitle: 'Frozen items, ice cream' },
];

interface LocationChoiceSheetProps {
  visible: boolean;
  currentValue: SourceLocation;
  onSelect: (value: SourceLocation) => void;
  onClose: () => void;
}

/**
 * 3-option bottom sheet for choosing an item's location. The current value is
 * highlighted with a brand-colored ring. Tapping an option fires onSelect
 * then onClose. Tapping the backdrop fires onClose without a selection.
 *
 * Structural template: components/pantry/BulkImportSheet.tsx (same slide
 * Modal + dim backdrop + tap-stop inner Pressable + rounded-top card).
 */
export function LocationChoiceSheet({
  visible,
  currentValue,
  onSelect,
  onClose,
}: LocationChoiceSheetProps) {
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
              Move to…
            </Text>

            {OPTIONS.map((opt) => {
              const isCurrent = opt.value === currentValue;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  accessibilityLabel={opt.label}
                  className={`bg-white rounded-2xl p-4 flex-row items-center gap-4 mb-3 ${
                    isCurrent
                      ? 'border-2 border-brand'
                      : 'border border-warmGray-200'
                  }`}
                >
                  <View className="w-12 h-12 rounded-full bg-brand/10 items-center justify-center">
                    <SymbolIcon
                      name={opt.icon as never}
                      size={26}
                      tintColor={colors.brand}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-warmGray-800">
                      {opt.label}
                    </Text>
                    <Text className="text-sm text-warmGray-500 mt-0.5">
                      {opt.subtitle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
