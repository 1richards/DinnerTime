import React, { useEffect, useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LocationPicker } from '../../components/pantry/LocationPicker';
import { Button } from '../../components/ui/Button';
import { usePantryStore } from '../../stores/pantryStore';
import type { SourceLocation } from '../../types/pantry';

export default function ReceiptScanScreen() {
  // CONTEXT locked decision: default source_location = 'pantry' for receipts
  const [sourceLocation, setSourceLocation] = useState<SourceLocation>('pantry');
  const { startReceiptScan, isScanning, scanResults } = usePantryStore();

  // Clear stale scan results on mount (Pitfall 3 mitigation)
  useEffect(() => {
    usePantryStore.setState({ scanResults: [] });
  }, []);

  // Navigate to review when scan results arrive
  useEffect(() => {
    if (scanResults.length > 0 && !isScanning) {
      router.push({
        pathname: '/scan/review',
        params: { sourceLocation },
      });
    }
  }, [scanResults, isScanning, sourceLocation]);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to scan receipts.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.4,
      mediaTypes: ['images'],
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }

    try {
      await startReceiptScan(result.assets[0].base64!, sourceLocation);
      // Pitfall 2 mitigation: inspect result length after resolution.
      const results = usePantryStore.getState().scanResults;
      if (results.length === 0) {
        Alert.alert(
          'Could not read this receipt',
          'Try again with better lighting and a flat, unwrinkled receipt.'
        );
      }
    } catch {
      Alert.alert(
        'Scan Failed',
        'Could not analyze the receipt. Please try again.'
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
        <Text className="text-lg font-semibold text-warmGray-800 mb-4 px-4">
          Scan Receipt
        </Text>

        <Text className="text-sm text-warmGray-500 mb-3 px-4">
          Where do most items go?
        </Text>
        <LocationPicker selected={sourceLocation} onSelect={setSourceLocation} />

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">🧾</Text>
          <Text className="text-base text-warmGray-500 text-center mb-2 leading-6">
            Take a photo of your grocery receipt and we'll extract the items.
          </Text>
          <Text className="text-xs text-warmGray-400 text-center mb-8">
            Best results with fresh, flat receipts. Faded receipts may miss items.
          </Text>
          <Button title="Take Photo" onPress={handleTakePhoto} className="w-full" />
        </View>
      </View>
    </SafeAreaView>
  );
}
