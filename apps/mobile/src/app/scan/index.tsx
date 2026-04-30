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
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { EMPTY_STATE_IMAGES } from '../../constants/emptyStateImages';
import { usePantryStore } from '../../stores/pantryStore';
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
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  // Tracks whether the mount-time auto-camera has already been triggered, so
  // we don't re-open the camera every time capturedPhotos is cleared.
  const [autoLaunched, setAutoLaunched] = useState(false);
  const { startBatchScan, isScanning, scanResults } = usePantryStore();

  // Clear stale scan results on mount (Pitfall 3 mitigation)
  useEffect(() => {
    usePantryStore.setState({ scanResults: [] });
  }, []);

  // Navigate to review when scan results FIRST arrive. We watch the
  // length, not the array reference, so subsequent updateReviewItem
  // calls (toggle accepted, edit name, location override) inside the
  // review screen don't keep firing this effect and pushing duplicate
  // /scan/review routes onto the stack — that bug surfaced as "the
  // whole page slides in from the right every time I tap an item".
  // We also `replace` instead of `push` so a stale scan state can't
  // accumulate a back-stack of review screens.
  const hasResults = scanResults.length > 0;
  useEffect(() => {
    if (hasResults && !isScanning) {
      router.replace('/scan/review');
    }
  }, [hasResults, isScanning]);

  const handleTakePhoto = async (): Promise<CapturedPhoto | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to scan your kitchen.'
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.4,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets?.[0]?.base64) {
      return null;
    }

    const photo: CapturedPhoto = {
      id: `photo-${Date.now()}`,
      base64: result.assets[0].base64!,
      uri: result.assets[0].uri,
    };
    setCapturedPhotos((prev) => [...prev, photo]);
    return photo;
  };

  // Auto-launch the camera on first mount so the user lands directly in
  // the capture UI instead of having to tap a "Take Photo" button first.
  // We DON'T auto-submit after a single-photo capture anymore — users
  // told us the immediate jump-to-review felt like the app skipped the
  // "review your batch / add more photos" step. Now the camera takes a
  // shot, drops the user back on the multi-photo selection screen, and
  // they tap "Submit" or "+ Add another" deliberately.
  useEffect(() => {
    if (autoLaunched) return;
    setAutoLaunched(true);
    void handleTakePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLaunched]);

  const handleRemovePhoto = (photoId: string) => {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== photoId));
    if (previewPhoto?.id === photoId) {
      setPreviewPhoto(null);
    }
  };

  const handleSubmitBatch = async () => {
    try {
      // Phase 18-04: AI classifies each item's location independently.
      // No session-level lock, no LocationPicker — the per-item chip on
      // the review screen is the single point of override.
      await startBatchScan(capturedPhotos.map((p) => p.base64));
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
        {!hasPhotos ? (
          <EmptyState
            visual={{ kind: 'image', uri: EMPTY_STATE_IMAGES.scanReady }}
            title="Ready to scan your kitchen"
            subtitle="Take photos of your fridge, pantry, or freezer — we'll sort each item automatically."
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
