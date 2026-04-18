import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRecipeStore } from '../../stores/recipeStore';

export default function ImportUrlScreen() {
  const [url, setUrl] = useState('');
  const {
    importFromUrl,
    isImporting,
    importedRecipe,
    error,
    isDuplicate,
    clearImport,
  } = useRecipeStore();

  useEffect(() => {
    if (importedRecipe && !isDuplicate) {
      router.push('/recipes/review');
    }
  }, [importedRecipe, isDuplicate]);

  const handleImport = async () => {
    if (!url.trim()) return;
    await importFromUrl(url.trim());
  };

  const handleReimport = async () => {
    clearImport();
    await importFromUrl(url.trim());
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ScrollView className="flex-1 px-4 pt-6" keyboardShouldPersistTaps="handled">
        <Text className="text-base text-warmGray-500 mb-4">
          Paste a link to any recipe page and we'll extract the details.
        </Text>

        <Input
          label="Recipe URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/recipe"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isImporting}
        />

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        {isDuplicate && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <Text className="text-sm text-amber-800 mb-3">
              This recipe is already in your collection.
            </Text>
            <View className="flex-row gap-3">
              <Button
                title="View Existing"
                variant="outline"
                className="flex-1"
                onPress={() => {
                  clearImport();
                  router.replace('/(tabs)/kitchen?segment=library');
                }}
              />
              <Button
                title="Import Again"
                className="flex-1"
                onPress={handleReimport}
              />
            </View>
          </View>
        )}

        {isImporting ? (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color="#F97316" />
            <Text className="text-sm text-warmGray-500 mt-3">
              Fetching and parsing recipe...
            </Text>
          </View>
        ) : (
          <Button
            title="Import"
            onPress={handleImport}
            disabled={!url.trim()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
