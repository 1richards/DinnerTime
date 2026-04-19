import React, { useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ReviewItemRow } from '../../components/pantry/ReviewItemRow';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useDirtyFormGuard } from '../../components/ui/useDirtyFormGuard';
import { usePantryStore } from '../../stores/pantryStore';
import { useAuthStore } from '../../stores/authStore';
import { useSuggestionsStore } from '../../stores/suggestionsStore';
import type { FoodCategory, ReviewItem, SourceLocation } from '../../types/pantry';

const CATEGORY_OPTIONS: FoodCategory[] = [
  'produce', 'protein', 'dairy', 'grain', 'condiment',
  'beverage', 'frozen', 'snack', 'other',
];

export default function ReviewScreen() {
  const {
    scanResults,
    updateReviewItem,
    addReviewItem,
    removeReviewItem,
    confirmScan,
  } = usePantryStore();
  const profile = useAuthStore((s) => s.profile);
  const { sourceLocation: locationParam } = useLocalSearchParams<{ sourceLocation?: string }>();
  const sourceLocation: SourceLocation = (
    ['fridge', 'pantry', 'freezer'].includes(locationParam ?? '')
      ? locationParam as SourceLocation
      : 'fridge'
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState('item');
  const [newCategory, setNewCategory] = useState<FoodCategory>('other');
  const [isConfirming, setIsConfirming] = useState(false);
  // Dirty flag flipped on any item toggle / add / remove after mount. The
  // initial scan-results render does NOT count as dirty.
  const [touched, setTouched] = useState(false);
  useDirtyFormGuard(touched && !isConfirming);

  const handleUpdateItem: typeof updateReviewItem = (...args) => {
    setTouched(true);
    updateReviewItem(...args);
  };
  const handleAddItemTouched: typeof addReviewItem = (item) => {
    setTouched(true);
    addReviewItem(item);
  };
  const handleRemoveItem: typeof removeReviewItem = (id) => {
    setTouched(true);
    removeReviewItem(id);
  };

  const acceptedCount = scanResults.filter((item) => item.accepted).length;

  const handleAddItem = () => {
    if (!newName.trim()) return;

    const item: ReviewItem = {
      id: `manual-${Date.now()}`,
      name: newName.trim(),
      quantity: parseFloat(newQuantity) || 1,
      unit: newUnit.trim() || 'item',
      confidence: 1.0,
      category: newCategory,
      // Manually-added items default to 'pantry'; user can tap the chip to
      // change. No aiLocation because the AI never classified them.
      source_location: 'pantry',
      accepted: true,
      userEdited: true,
    };

    handleAddItemTouched(item);
    setNewName('');
    setNewQuantity('1');
    setNewUnit('item');
    setNewCategory('other');
    setIsAdding(false);
  };

  const handleConfirm = async () => {
    if (!profile?.id) {
      Alert.alert('Error', 'Please sign in to save items.');
      return;
    }

    if (acceptedCount === 0) {
      Alert.alert('No Items Selected', 'Please accept at least one item to add to your pantry.');
      return;
    }

    setIsConfirming(true);
    try {
      await confirmScan(profile.id);

      Alert.alert(
        'Pantry Updated!',
        `${acceptedCount} items added. Want dinner ideas?`,
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => router.replace('/(tabs)/pantry'),
          },
          {
            text: 'Get Dinner Ideas',
            onPress: () => {
              useSuggestionsStore.getState().setAutoFetch(true);
              router.replace('/(tabs)/kitchen');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to save items. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Scan?',
      'All detected items will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            usePantryStore.setState({ scanResults: [] });
            // Reset dirty flag so the useDirtyFormGuard doesn't re-prompt
            // on top of the explicit Discard action.
            setTouched(false);
            router.back();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ReviewItem }) => (
    <ReviewItemRow
      item={item}
      onUpdate={handleUpdateItem}
      onRemove={handleRemoveItem}
    />
  );

  const renderHeader = () => (
    <View className="px-4 py-3">
      <Text className="text-sm text-warmGray-500">
        {acceptedCount} of {scanResults.length} items selected
      </Text>
    </View>
  );

  const renderFooter = () => (
    <View className="px-4 pt-2 pb-4">
      {isAdding ? (
        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold text-warmGray-800 mb-3">
            Add Missing Item
          </Text>
          <Input
            label="Item Name"
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g., Milk"
            autoFocus
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Quantity"
                value={newQuantity}
                onChangeText={setNewQuantity}
                keyboardType="numeric"
                placeholder="1"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Unit"
                value={newUnit}
                onChangeText={setNewUnit}
                placeholder="item"
              />
            </View>
          </View>
          <Text className="text-sm font-medium text-warmGray-700 mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CATEGORY_OPTIONS.map((cat) => (
              <Button
                key={cat}
                title={cat}
                variant={newCategory === cat ? 'primary' : 'outline'}
                onPress={() => setNewCategory(cat)}
                className="py-2 px-3"
              />
            ))}
          </View>
          <View className="flex-row gap-3">
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setIsAdding(false)}
              className="flex-1"
            />
            <Button
              title="Add"
              onPress={handleAddItem}
              className="flex-1"
            />
          </View>
        </View>
      ) : (
        <Button
          title="+ Add Missing Item"
          variant="outline"
          onPress={() => setIsAdding(true)}
          className="mb-3"
        />
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <FlatList
        data={scanResults}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Bottom action buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-warmWhite border-t border-warmGray-200 px-4 py-3 pb-8">
        <Button
          title={`Confirm ${acceptedCount} Items`}
          onPress={handleConfirm}
          loading={isConfirming}
          disabled={acceptedCount === 0}
          className="mb-2"
        />
        <Button
          title="Discard"
          variant="ghost"
          onPress={handleDiscard}
        />
      </View>
    </SafeAreaView>
  );
}
