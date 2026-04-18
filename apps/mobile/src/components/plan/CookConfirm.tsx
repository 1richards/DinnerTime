import React from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import type { MealPlanEntry, MealPlanIngredient } from '../../types/mealPlan';
import { colors } from '../../design/tokens';

interface CookConfirmProps {
  visible: boolean;
  entry: MealPlanEntry | null;
  loading: boolean;
  pantryDelta: MealPlanIngredient[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CookConfirm({
  visible,
  entry,
  loading,
  pantryDelta,
  onConfirm,
  onCancel,
}: CookConfirmProps) {
  const showDelta = pantryDelta != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable onPress={onCancel} className="flex-1 bg-black/40 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-warmWhite rounded-t-3xl px-6 pt-6 pb-10 max-h-[80%]"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-warmGray-900">
              {showDelta ? 'Cooked!' : 'Mark as cooked?'}
            </Text>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Close">
              <SymbolIcon name="xmark" size={24} tintColor="#6B7280" />
            </Pressable>
          </View>

          {!showDelta && entry && (
            <>
              <Text className="text-base text-warmGray-700 mb-2">
                Mark{' '}
                <Text className="font-semibold text-warmGray-900">
                  {entry.title}
                </Text>{' '}
                as cooked?
              </Text>
              <Text className="text-sm text-warmGray-500 mb-6">
                This will deduct the ingredients from your pantry.
              </Text>

              {loading ? (
                <View className="items-center py-4">
                  <ActivityIndicator size="large" color={colors.brand} />
                </View>
              ) : (
                <View className="gap-3">
                  <Button title="Yes, mark cooked" onPress={onConfirm} />
                  <Button title="Cancel" variant="secondary" onPress={onCancel} />
                </View>
              )}
            </>
          )}

          {showDelta && (
            <>
              <View className="flex-row items-center mb-4">
                <SymbolIcon name="checkmark.circle.fill" size={24} tintColor="#16A34A" />
                <Text className="text-sm text-green-700 ml-2">
                  Pantry updated
                </Text>
              </View>
              <Text className="text-xs font-semibold text-warmGray-500 uppercase mb-2">
                Deducted from pantry
              </Text>
              <ScrollView className="max-h-64 mb-6">
                {pantryDelta && pantryDelta.length > 0 ? (
                  pantryDelta.map((item, idx) => (
                    <View
                      key={`${item.name}-${idx}`}
                      className="flex-row items-center py-2 border-b border-warmGray-100"
                    >
                      <SymbolIcon name="minus.circle" size={18} tintColor={colors.brand} />
                      <Text className="text-sm text-warmGray-700 ml-2 flex-1">
                        {item.name}
                      </Text>
                      {item.quantity != null && (
                        <Text className="text-xs text-warmGray-500">
                          {item.quantity}
                          {item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text className="text-sm text-warmGray-500 italic">
                    No pantry changes
                  </Text>
                )}
              </ScrollView>
              <Button title="Done" onPress={onCancel} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
