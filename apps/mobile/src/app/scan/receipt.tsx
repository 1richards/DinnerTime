import React, { useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePantryStore } from '../../stores/pantryStore';
import { colors } from '../../design/tokens';

export default function ReceiptScanScreen() {
  const { startReceiptScan, isScanning, scanResults } = usePantryStore();

  // Clear stale scan results on mount (Pitfall 3 mitigation)
  useEffect(() => {
    usePantryStore.setState({ scanResults: [] });
  }, []);

  // Navigate to review when scan results arrive. Phase 18-04: AI classifies
  // per-item location automatically (dairy→fridge, shelf-stable→pantry,
  // frozen→freezer). No LocationPicker gating step.
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
      // Phase 18-04: AI classifies per item (receipt fan-out: dairy→fridge,
      // chips→pantry, ice cream→freezer). Review screen chip handles overrides.
      await startReceiptScan(result.assets[0].base64!);
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
        <ActivityIndicator size="large" color={colors.brand} />
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
        <EmptyState
          visual={{ kind: 'symbol', name: 'doc.text.viewfinder' }}
          title="Scan a grocery receipt"
          subtitle="Take a photo and we'll extract the items. Best results with fresh, flat receipts — faded receipts may miss items."
          action={{ label: 'Take Photo', onPress: handleTakePhoto }}
        />
      </View>
    </SafeAreaView>
  );
}
