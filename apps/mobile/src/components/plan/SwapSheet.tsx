import React from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import type { MealPlanEntry } from '../../types/mealPlan';

interface SwapSheetProps {
  visible: boolean;
  currentEntry: MealPlanEntry | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SwapSheet({
  visible,
  currentEntry,
  loading,
  onConfirm,
  onCancel,
}: SwapSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        className="flex-1 bg-black/40 justify-end"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-warmWhite rounded-t-3xl px-6 pt-6 pb-10"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-warmGray-900">
              Swap this meal?
            </Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>

          {currentEntry && (
            <View className="mb-6 p-4 rounded-xl bg-warmGray-50">
              <Text className="text-xs text-warmGray-500 mb-1">
                Currently planned
              </Text>
              <Text
                className="text-base font-semibold text-warmGray-900"
                numberOfLines={2}
              >
                {currentEntry.title}
              </Text>
            </View>
          )}

          <Text className="text-sm text-warmGray-500 mb-6">
            We'll pick another dinner that fits your pantry and preferences.
          </Text>

          {loading ? (
            <View className="items-center py-4">
              <ActivityIndicator size="large" color="#F97316" />
              <Text className="text-sm text-warmGray-500 mt-2">
                Finding an alternative...
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              <Button
                title="Pick something else"
                onPress={onConfirm}
              />
              <Button title="Cancel" variant="outline" onPress={onCancel} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
