import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

interface HeroImageProps {
  /** When null, renders a beige skeleton instead of the Image. */
  uri: string | null;
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
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={400}
          placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#F1EAE0' },
          ]}
        />
      )}

      {/* Three-step stacked overlay simulates a soft gradient without
          requiring expo-linear-gradient (no native module). The previous
          version stacked a 25% full-bleed darkening UNDER a 55% half-image
          strip, which made the entire upper half of the photo look hazy
          and washed-out. Now the photo is clean above the title; only the
          ~40% strip directly behind the text steps darker progressively. */}
      {isBottom ? (
        <>
          <View style={styles.fadeOuterBottom} />
          <View style={styles.fadeMidBottom} />
          <View style={styles.fadeInnerBottom} />
        </>
      ) : (
        <>
          <View style={styles.fadeOuterTop} />
          <View style={styles.fadeMidTop} />
          <View style={styles.fadeInnerTop} />
        </>
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
  // Outer (lightest) fade — widest band, gentlest tint. Anchors the
  // gradient so the transition into the unshaded photo is gradual.
  fadeOuterBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  fadeMidBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  fadeInnerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  fadeOuterTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  fadeMidTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  fadeInnerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
});
