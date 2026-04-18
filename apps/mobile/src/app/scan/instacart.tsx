import React, { useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/ui/Button';
import { usePantryStore } from '../../stores/pantryStore';

export default function InstacartImportScreen() {
  const { startInstacartImport, isScanning, scanResults } = usePantryStore();

  // Clear stale results on mount
  useEffect(() => {
    usePantryStore.setState({ scanResults: [] });
  }, []);

  // Navigate to review when results arrive (pantry is locked server-side).
  useEffect(() => {
    if (scanResults.length > 0 && !isScanning) {
      router.push({
        pathname: '/scan/review',
        params: { sourceLocation: 'pantry' },
      });
    }
  }, [scanResults, isScanning]);

  const handleChoose = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photos Permission Required',
        'Please allow photos access in Settings to import Instacart screenshots.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.4,
      mediaTypes: ['images'],
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }

    try {
      await startInstacartImport(result.assets[0].base64!);
      const results = usePantryStore.getState().scanResults;
      if (results.length === 0) {
        Alert.alert(
          'Could not read this screenshot',
          'Try a clearer image of the Instacart order page with items expanded.'
        );
      }
    } catch {
      Alert.alert(
        'Import Failed',
        'Could not analyze the screenshot. Please try again.'
      );
    }
  };

  if (isScanning) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-lg text-warmGray-600 mt-4">Analyzing photo…</Text>
        <Text className="text-sm text-warmGray-400 mt-2">
          This may take a few seconds
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 px-4 pt-6">
        <View className="bg-white rounded-2xl p-4 mx-4 mb-6 border border-warmGray-200">
          <Text className="text-sm font-semibold text-warmGray-800 mb-2">
            Works best with:
          </Text>
          <Text className="text-sm text-warmGray-600 mb-1">
            • Order confirmation email
          </Text>
          <Text className="text-sm text-warmGray-600 mb-1">
            • Order details page with items expanded
          </Text>
          <Text className="text-sm text-warmGray-600">
            • Final receipt page from a completed order
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">🛒</Text>
          <Text className="text-base text-warmGray-500 text-center mb-2 leading-6">
            Pick an Instacart screenshot from your Photos and we'll extract the
            items into your pantry.
          </Text>
          <Text className="text-xs text-warmGray-400 text-center mb-8">
            Imported items are added to your pantry by default.
          </Text>
          <Button
            title="Choose Screenshot"
            onPress={handleChoose}
            className="w-full"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
