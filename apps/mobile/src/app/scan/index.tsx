import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LocationPicker } from '../../components/pantry/LocationPicker';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { EMPTY_STATE_IMAGES } from '../../constants/emptyStateImages';
import { usePantryStore } from '../../stores/pantryStore';
import type { SourceLocation } from '../../types/pantry';
import { colors } from '../../design/tokens';

interface CapturedPhoto {
  id: string;
  base64: string;
  uri: string;
}

const MAX_PHOTOS = 5;
// Fit 6 slots (5 photos + add button) across screen width with gaps.
const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PADDING = 32; // 16px on each side
const SLOT_GAP = 6;
const SLOT_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING - SLOT_GAP * (MAX_PHOTOS + 1 - 1)) / (MAX_PHOTOS + 1));

export default function ScanScreen() {
  const [selectedLocation, setSelectedLocation] = useState<SourceLocation>('fridge');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const { startBatchScan, isScanning, scanResults } = usePantryStore();

  // Clear stale scan results on mount (Pitfall 3 mitigation)
  useEffect(() => {
    usePantryStore.setState({ scanResults: [] });
  }, []);

  // Navigate to review when scan results arrive
  useEffect(() => {
    if (scanResults.length > 0 && !isScanning) {
      router.push({
        pathname: '/scan/review',
        params: { sourceLocation: selectedLocation },
      });
    }
  }, [scanResults, isScanning, selectedLocation]);

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
      quality: 0.4,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }

    const photo: CapturedPhoto = {
      id: `photo-${Date.now()}`,
      base64: result.assets[0].base64!,
      uri: result.assets[0].uri,
    };
    setCapturedPhotos((prev) => [...prev, photo]);
  };

  const handleRemovePhoto = (photoId: string) => {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== photoId));
    if (previewPhoto?.id === photoId) {
      setPreviewPhoto(null);
    }
  };

  const handleSubmitBatch = async () => {
    try {
      await startBatchScan(
        capturedPhotos.map((p) => p.base64),
        selectedLocation
      );
    } catch {
      Alert.alert('Scan Failed', 'Could not analyze the images. Please try again.');
    }
  };

  if (isScanning) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text className="text-lg text-warmGray-600 mt-4">
          Analyzing {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''}...
        </Text>
        <Text className="text-sm text-warmGray-400 mt-2">
          This may take a few seconds
        </Text>
      </SafeAreaView>
    );
  }

  const hasPhotos = capturedPhotos.length > 0;
  const canAddMore = capturedPhotos.length < MAX_PHOTOS;

  const renderThumbnail = (item: CapturedPhoto) => (
    <View key={item.id} style={{ width: SLOT_SIZE, position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setPreviewPhoto(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.uri }}
          style={{ width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 8 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleRemovePhoto(item.id)}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 items-center justify-center"
        accessibilityLabel="Remove photo"
      >
        <SymbolIcon name="xmark" size={10} weight="bold" tintColor="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => {
    if (!canAddMore) return null;
    return (
      <TouchableOpacity
        key="add-button"
        onPress={handleTakePhoto}
        style={{
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          borderRadius: 8,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: '#D6D3D1',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.7}
      >
        <Text className="text-2xl text-warmGray-400">+</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 px-4 pt-6">
        <Text className="text-lg font-semibold text-warmGray-800 mb-4 px-4">
          Where are you scanning?
        </Text>

        <View pointerEvents={hasPhotos ? 'none' : 'auto'} className={hasPhotos ? 'opacity-50' : ''}>
          <LocationPicker
            selected={selectedLocation}
            onSelect={setSelectedLocation}
          />
        </View>
        {hasPhotos && (
          <Text className="text-xs text-warmGray-400 px-4 mt-1">
            Location applies to all photos in this session
          </Text>
        )}

        {!hasPhotos ? (
          <EmptyState
            visual={{ kind: 'image', uri: EMPTY_STATE_IMAGES.scanReady }}
            title="Ready to scan your kitchen"
            subtitle={`Take a photo of your ${selectedLocation} and we'll identify what's inside`}
            action={{ label: 'Take Photo', onPress: handleTakePhoto }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-4">
              <SymbolIcon name="camera.fill" size={56} weight="light" tintColor="#9CA3AF" />
            </View>
            <Text className="text-base text-warmGray-600 text-center mb-2 font-medium">
              {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''} ready
            </Text>
            <Text className="text-sm text-warmGray-400 text-center mb-8">
              {canAddMore
                ? `Add up to ${MAX_PHOTOS - capturedPhotos.length} more, or scan now`
                : 'Maximum photos reached'}
            </Text>
            <Button
              title="Submit"
              onPress={handleSubmitBatch}
              className="w-full mb-3"
            />
            <Button
              title="Clear All"
              variant="ghost"
              onPress={() => setCapturedPhotos([])}
              className="w-full"
            />
          </View>
        )}

        {/* Thumbnail strip — fixed row, fits MAX_PHOTOS + add button */}
        {hasPhotos && (
          <View className="pb-4 pt-2 border-t border-warmGray-200">
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                paddingVertical: 8,
                gap: SLOT_GAP,
              }}
            >
              {capturedPhotos.map(renderThumbnail)}
              {renderAddButton()}
            </View>
          </View>
        )}
      </View>

      {/* Full-size preview modal */}
      <Modal
        visible={previewPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <Pressable
          className="flex-1 bg-black/80 items-center justify-center"
          onPress={() => setPreviewPhoto(null)}
        >
          <Pressable onPress={() => {}} className="w-[90%] items-center">
            {previewPhoto && (
              <>
                <Image
                  source={{ uri: previewPhoto.uri }}
                  className="w-full aspect-[3/4] rounded-xl"
                  resizeMode="contain"
                />
                <View className="flex-row gap-4 mt-6">
                  <Button
                    title="Remove"
                    variant="outline"
                    onPress={() => {
                      handleRemovePhoto(previewPhoto.id);
                      setPreviewPhoto(null);
                    }}
                    className="flex-1 bg-white"
                  />
                  <Button
                    title="Close"
                    onPress={() => setPreviewPhoto(null)}
                    className="flex-1"
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
