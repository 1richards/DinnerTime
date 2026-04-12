import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LocationPicker } from '../../components/pantry/LocationPicker';
import { Button } from '../../components/ui/Button';
import { usePantryStore } from '../../stores/pantryStore';
import type { SourceLocation } from '../../types/pantry';

export default function ScanScreen() {
  const [selectedLocation, setSelectedLocation] = useState<SourceLocation>('fridge');
  const { startScan, isScanning, scanResults } = usePantryStore();

  useEffect(() => {
    if (scanResults.length > 0 && !isScanning) {
      router.push('/scan/review');
    }
  }, [scanResults, isScanning]);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to scan your kitchen.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }

    try {
      await startScan(result.assets[0].base64, selectedLocation);
    } catch {
      Alert.alert('Scan Failed', 'Could not analyze the image. Please try again.');
    }
  };

  if (isScanning) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-lg text-warmGray-600 mt-4">
          Analyzing your {selectedLocation}...
        </Text>
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
          Where are you scanning?
        </Text>

        <LocationPicker
          selected={selectedLocation}
          onSelect={setSelectedLocation}
        />

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">📸</Text>
          <Text className="text-base text-warmGray-500 text-center mb-8 leading-6">
            Take a photo of your {selectedLocation} and we'll identify what's inside
          </Text>

          <Button
            title="Take Photo"
            onPress={handleTakePhoto}
            className="w-full"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
