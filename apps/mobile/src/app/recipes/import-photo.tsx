import React, { useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/ui/Button';
import { useRecipeStore } from '../../stores/recipeStore';

export default function ImportPhotoScreen() {
  const { importFromPhoto, isImporting, importedRecipe, error } =
    useRecipeStore();

  useEffect(() => {
    if (importedRecipe) {
      router.push('/recipes/review');
    }
  }, [importedRecipe]);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to capture recipes.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;
    await importFromPhoto(result.assets[0].base64);
  };

  const handleChooseLibrary = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please allow photo library access in Settings.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;
    await importFromPhoto(result.assets[0].base64);
  };

  if (isImporting) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-lg text-warmGray-600 mt-4">
          Extracting recipe...
        </Text>
        <Text className="text-sm text-warmGray-400 mt-2">
          Reading ingredients and instructions
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 px-6 pt-6 items-center">
        <Text className="text-6xl mb-6">📷</Text>
        <Text className="text-base text-warmGray-500 text-center mb-8 leading-6">
          Take a clear photo of a recipe card, cookbook page, or printed recipe
          and we'll extract the details.
        </Text>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 w-full">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        <View className="w-full gap-3">
          <Button title="Take Photo" onPress={handleTakePhoto} />
          <Button
            title="Choose from Library"
            variant="outline"
            onPress={handleChooseLibrary}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
