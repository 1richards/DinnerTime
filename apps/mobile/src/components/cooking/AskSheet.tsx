import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';

interface AskSheetProps {
  visible: boolean;
  question: string;
  answer: string | null;
  loading: boolean;
  onClose: () => void;
}

export default function AskSheet({
  visible,
  question,
  answer,
  loading,
  onClose,
}: AskSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-warmWhite rounded-t-3xl px-6 pt-6 pb-10"
          style={{ maxHeight: '70%' }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-warmGray-900 flex-1 mr-3">
              You asked
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>

          {question ? (
            <View className="mb-4 p-4 rounded-xl bg-warmGray-50">
              <Text className="text-base text-warmGray-700 italic">
                "{question}"
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="large" color="#F97316" />
              <Text className="text-sm text-warmGray-500 mt-2">Thinking…</Text>
            </View>
          ) : (
            <ScrollView className="mb-4" style={{ maxHeight: 240 }}>
              <Text className="text-xl leading-7 text-warmGray-900">
                {answer ?? ''}
              </Text>
            </ScrollView>
          )}

          <Button title="Close" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
