import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { useRecipeStore } from '../../stores/recipeStore';
import { colors } from '../../design/tokens';

const PLACEHOLDER = `Paste or type your recipe here...

Example:
Pasta Carbonara
1 lb spaghetti
4 eggs
1 cup parmesan
...`;

export default function ImportManualScreen() {
  const [text, setText] = useState('');
  const { importFromText, isImporting, importedRecipe, error } =
    useRecipeStore();

  useEffect(() => {
    if (importedRecipe) {
      router.push('/recipes/review');
    }
  }, [importedRecipe]);

  const handleParse = async () => {
    if (!text.trim()) return;
    await importFromText(text.trim());
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 px-4 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-base text-warmGray-500 mb-4">
            Paste recipe text and we'll parse it into structured form.
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={PLACEHOLDER}
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            editable={!isImporting}
            className="bg-warmGray-50 border border-warmGray-200 rounded-xl p-4 text-base text-warmGray-900 mb-4"
            style={{ minHeight: 260 }}
          />

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {isImporting ? (
            <View className="items-center py-6">
              <ActivityIndicator size="large" color={colors.brand} />
              <Text className="text-sm text-warmGray-500 mt-3">
                Parsing recipe...
              </Text>
            </View>
          ) : (
            <Button
              title="Parse Recipe"
              onPress={handleParse}
              disabled={!text.trim()}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
