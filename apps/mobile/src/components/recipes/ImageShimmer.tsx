/**
 * ImageShimmer — AI-style shimmer/skeleton overlay for a recipe card's hero
 * image area while the generated image isn't ready yet (deferred OR loading).
 *
 * Reuses the EXACT shimmer pattern established by SuggestionSkeleton: an
 * Animated.Value(0.3) opacity looped 0.3↔0.7 over 800ms with useNativeDriver,
 * over a `bg-warmGray-200` tone. Here it fills the hero (absoluteFill) and adds
 * a sparkles glyph so users read it as "AI image generating", not "broken".
 *
 * Rendered only when the recipe has no image_url AND no resolved generated
 * url — saved recipes (image_url) and the immediate top-2 swap straight to the
 * photo with no shimmer once loaded.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';

export function ImageShimmer() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
      className="bg-warmGray-200 items-center justify-center"
      accessibilityLabel="Generating recipe image"
    >
      <View className="bg-warmGray-300 rounded-full p-3">
        <SymbolIcon name="sparkles" size={24} tintColor="#9A8C7A" />
      </View>
    </Animated.View>
  );
}
