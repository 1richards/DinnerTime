import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

interface HeroImageProps {
  uri: string;
  /** Height of the hero container. Defaults to 220. */
  height?: number;
  /** Optional overlay content rendered on top of the gradient. */
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Gradient direction: 'top' (dark at top) | 'bottom' (dark at bottom, default) */
  gradientDirection?: 'top' | 'bottom';
  /** Border radius applied to the container. Defaults to 0. */
  borderRadius?: number;
}

/**
 * Full-bleed hero image with a warm dark gradient overlay.
 * Uses expo-image for caching + blurhash placeholder.
 *
 * Gradient is simulated with layered semi-transparent Views —
 * no native module required.
 */
export function HeroImage({
  uri,
  height = 220,
  children,
  style,
  gradientDirection = 'bottom',
  borderRadius = 0,
}: HeroImageProps) {
  const isBottom = gradientDirection === 'bottom';

  return (
    <View
      style={[styles.container, { height, borderRadius, overflow: 'hidden' }, style]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={400}
        placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
        cachePolicy="memory-disk"
      />

      {/* Simulate gradient with a subtle overall darkening + strong bottom strip */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,10,5,0.25)' }]} />
      {isBottom ? (
        <View style={styles.bottomOverlay} />
      ) : (
        <View style={styles.topOverlay} />
      )}

      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#2A221A',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(15,10,5,0.55)',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(15,10,5,0.55)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
});
