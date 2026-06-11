import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  type ViewStyle,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { HeroImage } from './HeroImage';

interface HeroCarouselProps {
  /** Slide image URIs. The first is the finished-dish hero; the rest are
      preparation-step photos. A null entry renders the beige skeleton. */
  images: Array<string | null>;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** Overlay (title + meta) rendered on the FIRST slide only. */
  heroOverlay?: React.ReactNode;
  /** When true, null slides render a centered spinner over the beige
      skeleton — used for a "pending" step photo still generating in the
      background. The hero (index 0) is never treated as pending. */
  loadingPendingSlides?: boolean;
}

/**
 * Horizontal paged image slider built on HeroImage + FlatList — no extra
 * native dependency. Falls back to a single HeroImage when only one image
 * is provided, so callers can always pass it the full image list.
 *
 * Used by the recipe detail page: hero + lazily-generated preparation-step
 * photos. Page dots indicate position; the title overlay stays on the hero.
 */
export function HeroCarousel({
  images,
  height = 280,
  borderRadius = 0,
  style,
  heroOverlay,
  loadingPendingSlides = false,
}: HeroCarouselProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  // Single image (or not yet measured) → plain hero, preserves prior behavior.
  if (images.length <= 1) {
    return (
      <HeroImage
        uri={images[0] ?? null}
        height={height}
        borderRadius={borderRadius}
        style={style}
      >
        {heroOverlay}
      </HeroImage>
    );
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== active) setActive(idx);
  };

  return (
    <View
      style={[{ height }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <FlatList
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => (
            <HeroImage
              uri={item}
              height={height}
              borderRadius={borderRadius}
              style={{ width }}
              // Non-hero null slides are pending step photos generating in the
              // background — show a spinner so the slot reads as "loading".
              loadingWhenEmpty={loadingPendingSlides && index !== 0}
            >
              {index === 0 ? heroOverlay : null}
            </HeroImage>
          )}
        />
      )}

      {/* Page dots */}
      <View style={styles.dots} pointerEvents="none">
        {images.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === active ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
