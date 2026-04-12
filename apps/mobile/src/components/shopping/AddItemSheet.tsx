import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';

interface AddItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
  }) => Promise<void>;
}

export function AddItemSheet({ visible, onClose, onSubmit }: AddItemSheetProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setQuantity('');
    setUnit('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [onClose, reset, submitting]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const qty =
        quantity.trim() === '' ? null : Number(quantity);
      await onSubmit({
        name: trimmed,
        quantity: qty !== null && !Number.isNaN(qty) ? qty : null,
        unit: unit.trim() === '' ? null : unit.trim(),
      });
      reset();
      onClose();
    } catch {
      setSubmitting(false);
    }
  }, [name, quantity, unit, onSubmit, onClose, reset]);

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          onPress={handleClose}
          className="flex-1 bg-black/40 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-warmWhite rounded-t-3xl px-6 pt-6 pb-10"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-warmGray-900">
                Add item
              </Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            <Text className="text-xs font-semibold text-warmGray-500 uppercase mb-1">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Oranges"
              autoFocus
              className="bg-white border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900 mb-3"
              returnKeyType="next"
            />

            <View className="flex-row mb-5">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-semibold text-warmGray-500 uppercase mb-1">
                  Quantity
                </Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="6"
                  keyboardType="numeric"
                  className="bg-white border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-semibold text-warmGray-500 uppercase mb-1">
                  Unit
                </Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="each"
                  className="bg-white border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900"
                />
              </View>
            </View>

            <Button
              title="Add to list"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
