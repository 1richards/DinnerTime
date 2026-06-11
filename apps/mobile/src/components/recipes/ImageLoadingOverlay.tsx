/**
 * ImageLoadingOverlay — a clean centered spinner shown over a recipe card's
 * hero image area while the generated image isn't ready yet (deferred OR
 * loading).
 *
 * Replaces the earlier AI sparkle/shimmer placeholder (build #27): the
 * animated-opacity sparkle read as busy/gimmicky, so this is just a muted
 * ActivityIndicator centered over the flat placeholder background
 * (#F1EAE0 — the same beige tone the empty Image background uses).
 *
 * Rendered only when the recipe has no image_url AND no resolved generated
 * url — saved recipes (image_url) and the immediate top cards swap straight
 * to the photo with no spinner once loaded.
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export function ImageLoadingOverlay() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.container]}
      accessibilityLabel="Generating recipe image"
    >
      <ActivityIndicator size="small" color="#9A8C7A" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Same flat beige tone the empty Image background renders, so the spinner
    // sits on a calm surface rather than a loosely-matched stock photo.
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
