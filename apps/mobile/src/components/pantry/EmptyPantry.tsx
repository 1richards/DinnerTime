import React from 'react';
import { router } from 'expo-router';
import { EmptyState } from '../ui/EmptyState';
import { EMPTY_STATE_IMAGES } from '../../constants/emptyStateImages';

export function EmptyPantry() {
  return (
    <EmptyState
      visual={{ kind: 'image', uri: EMPTY_STATE_IMAGES.emptyPantry }}
      title="Your kitchen is empty"
      subtitle="Take a photo of your fridge, pantry, or freezer to get started"
      action={{ label: 'Scan Now', onPress: () => router.push('/scan') }}
    />
  );
}
