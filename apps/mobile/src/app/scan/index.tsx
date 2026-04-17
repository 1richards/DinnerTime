import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LocationPicker } from '../../components/pantry/LocationPicker';
import { Button } from '../../components/ui/Button';
import { usePantryStore } from '../../stores/pantryStore';
import type { SourceLocation } from '../../types/pantry';

interface CapturedPhoto {
  id: string;
  base64: string;
  uri: string;
}

const MAX_PHOTOS = 5;

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
        <ActivityIndicator size="large" color="#F97316" />
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

  const renderThumbnail = ({ item }: { item: CapturedPhoto }) => (
    <View className="mr-3 relative">
      <TouchableOpacity
        onPress={() => setPreviewPhoto(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.uri }}
          className="w-[72px] h-[72px] rounded-lg"
          resizeMode="cover"
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleRemovePhoto(item.id)}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 items-center justify-center"
      >
        <Text className="text-white text-xs font-bold">X</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => {
    if (!canAddMore) return null;
    return (
      <TouchableOpacity
        onPress={handleTakePhoto}
        className="w-[72px] h-[72px] rounded-lg border-2 border-dashed border-warmGray-300 items-center justify-center"
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

        <View className="flex-1 items-center justify-center px-6">
          {!hasPhotos ? (
            <>
              <Text className="text-6xl mb-6">📸</Text>
              <Text className="text-base text-warmGray-500 text-center mb-8 leading-6">
                Take a photo of your {selectedLocation} and we'll identify what's inside
              </Text>
              <Button
                title="Take Photo"
                onPress={handleTakePhoto}
                className="w-full"
              />
            </>
          ) : (
            <>
              <Text className="text-5xl mb-4">📸</Text>
              <Text className="text-base text-warmGray-600 text-center mb-2 font-medium">
                {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''} ready
              </Text>
              <Text className="text-sm text-warmGray-400 text-center mb-8">
                {canAddMore
                  ? `Add up to ${MAX_PHOTOS - capturedPhotos.length} more, or scan now`
                  : 'Maximum photos reached'}
              </Text>
              <Button
                title="Scan All Photos"
                onPress={handleSubmitBatch}
                className="w-full mb-3"
              />
              <Button
                title="Clear All"
                variant="ghost"
                onPress={() => setCapturedPhotos([])}
                className="w-full"
              />
            </>
          )}
        </View>

        {/* Thumbnail strip */}
        {hasPhotos && (
          <View className="pb-4 pt-2 border-t border-warmGray-200">
            <FlatList
              data={capturedPhotos}
              keyExtractor={(item) => item.id}
              renderItem={renderThumbnail}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
              ListFooterComponent={renderAddButton}
            />
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
