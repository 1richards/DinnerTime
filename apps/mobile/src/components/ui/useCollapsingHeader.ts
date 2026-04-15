import { useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export const LARGE_HEADER_HEIGHT = 100;
export const COLLAPSED_HEADER_HEIGHT = 52;

export function useCollapsingHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, LARGE_HEADER_HEIGHT * 0.5, LARGE_HEADER_HEIGHT],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const largeTitleTranslate = scrollY.interpolate({
    inputRange: [0, LARGE_HEADER_HEIGHT],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [LARGE_HEADER_HEIGHT * 0.5, LARGE_HEADER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return { scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity };
}

export const collapsingHeaderStyles = StyleSheet.create({
  largeHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    minHeight: LARGE_HEADER_HEIGHT,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  largeSubtitle: {
    fontSize: 14,
    color: '#7A6651',
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COLLAPSED_HEADER_HEIGHT,
    backgroundColor: 'rgba(255,251,245,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  actionRow: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    height: COLLAPSED_HEADER_HEIGHT - 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    zIndex: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5D9CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFBF5',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
